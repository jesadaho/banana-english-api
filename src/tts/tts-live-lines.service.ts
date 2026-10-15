import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { liveSpeechLines, ttsLiveLineKey, type LiveSpeechInput } from './tts-live-lines';

@Injectable()
export class TtsLiveLinesService {
  private readonly logger = new Logger(TtsLiveLinesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget. A counter miss must not fail the lesson turn. */
  observe(source: string, input: LiveSpeechInput): void {
    const lines = liveSpeechLines(input);
    if (lines.length === 0) return;
    void this.recordLines(source, lines).catch((error) => {
      this.logger.warn(
        `TTS live line record failed: ${String(error).slice(0, 180)}`,
      );
    });
  }

  async listForAdmin(from: Date, to: Date, source?: string) {
    const seen = { gte: from, lte: to };
    const sourceFilter = source && source !== 'all' ? source : undefined;

    const [grouped, lines] = await Promise.all([
      this.prisma.ttsLiveLine.groupBy({
        by: ['source'],
        where: { lastSeenAt: seen },
        _count: { _all: true },
        _sum: { hitCount: true },
      }),
      this.prisma.ttsLiveLine.findMany({
        where: {
          lastSeenAt: seen,
          ...(sourceFilter ? { source: sourceFilter } : {}),
        },
        orderBy: [{ hitCount: 'desc' }, { lastSeenAt: 'desc' }],
        take: 200,
        select: {
          text: true,
          source: true,
          hitCount: true,
          firstSeenAt: true,
          lastSeenAt: true,
        },
      }),
    ]);

    const sources = grouped
      .map((row) => ({
        source: row.source,
        lines: row._count._all,
        hits: row._sum.hitCount ?? 0,
      }))
      .sort((a, b) => b.hits - a.hits);

    return {
      lines,
      totalLines: sources.reduce((sum, row) => sum + row.lines, 0),
      totalHits: sources.reduce((sum, row) => sum + row.hits, 0),
      sources,
    };
  }

  private async recordLines(source: string, lines: string[]): Promise<void> {
    const now = new Date();
    await Promise.all(lines.map((text) => this.upsertLine(source, text, now)));
  }

  private async upsertLine(source: string, text: string, now: Date): Promise<void> {
    const textKey = ttsLiveLineKey(text);
    try {
      await this.prisma.ttsLiveLine.upsert({
        where: { textKey },
        create: { textKey, text, source, hitCount: 1, firstSeenAt: now, lastSeenAt: now },
        update: { hitCount: { increment: 1 }, lastSeenAt: now, source },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await this.prisma.ttsLiveLine.update({
          where: { textKey },
          data: { hitCount: { increment: 1 }, lastSeenAt: now, source },
        });
        return;
      }
      throw error;
    }
  }
}
