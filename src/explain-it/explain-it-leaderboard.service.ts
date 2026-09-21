import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { explainItTopicById } from './explain-it.data';

export type ExplainItLeaderboardEntry = {
  rank: number;
  name: string;
  score: number;
  avatarId: string | null;
  isYou?: boolean;
};

@Injectable()
export class ExplainItLeaderboardService {
  static readonly LEADERBOARD_TOP_SIZE = 10;

  constructor(private readonly prisma: PrismaService) {}

  requireTopicId(topicId: string): string {
    const id = topicId.trim().toLowerCase();
    if (!explainItTopicById(id)) {
      throw new NotFoundException(`Explain It topic not found: ${topicId}`);
    }
    return id;
  }

  async submitScore(
    user: User,
    topicId: string,
    score: number,
    avatarId?: string | null,
  ): Promise<{ topicId: string; bestScore: number; improved: boolean }> {
    const topic = this.requireTopicId(topicId);
    if (!Number.isFinite(score) || score < 0 || score > 2000) {
      throw new BadRequestException('Invalid score');
    }
    const rounded = Math.floor(score);
    const displayName = user.displayName?.trim() || null;
    const avatar = avatarId?.trim() || null;

    const existing = await this.prisma.explainItTopicScore.findUnique({
      where: { userId_topicId: { userId: user.id, topicId: topic } },
    });

    if (!existing) {
      const created = await this.prisma.explainItTopicScore.create({
        data: {
          userId: user.id,
          topicId: topic,
          bestScore: rounded,
          displayName,
          avatarId: avatar,
        },
      });
      return { topicId: topic, bestScore: created.bestScore, improved: true };
    }

    const improved = rounded > existing.bestScore;
    const updated = await this.prisma.explainItTopicScore.update({
      where: { id: existing.id },
      data: {
        bestScore: improved ? rounded : existing.bestScore,
        displayName: displayName ?? existing.displayName,
        avatarId: avatar ?? existing.avatarId,
      },
    });
    return { topicId: topic, bestScore: updated.bestScore, improved };
  }

  async syncDisplayName(userId: string, displayName: string): Promise<void> {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    await this.prisma.explainItTopicScore.updateMany({
      where: { userId },
      data: { displayName: trimmed },
    });
  }

  async board(
    user: User,
    topicId: string,
  ): Promise<{
    topicId: string;
    top: ExplainItLeaderboardEntry[];
    me: ExplainItLeaderboardEntry | null;
  }> {
    const topic = this.requireTopicId(topicId);

    const topRows = await this.prisma.explainItTopicScore.findMany({
      where: { topicId: topic },
      orderBy: [{ bestScore: 'desc' }, { updatedAt: 'asc' }],
      take: ExplainItLeaderboardService.LEADERBOARD_TOP_SIZE,
      include: { user: { select: { displayName: true } } },
    });

    const top: ExplainItLeaderboardEntry[] = topRows.map((row, i) => ({
      rank: i + 1,
      name: row.user.displayName?.trim() || row.displayName?.trim() || 'Player',
      score: row.bestScore,
      avatarId: row.avatarId,
      isYou: row.userId === user.id,
    }));

    const mine = await this.prisma.explainItTopicScore.findUnique({
      where: { userId_topicId: { userId: user.id, topicId: topic } },
      include: { user: { select: { displayName: true } } },
    });

    let me: ExplainItLeaderboardEntry | null = null;
    if (mine) {
      const better = await this.prisma.explainItTopicScore.count({
        where: {
          topicId: topic,
          OR: [
            { bestScore: { gt: mine.bestScore } },
            {
              bestScore: mine.bestScore,
              updatedAt: { lt: mine.updatedAt },
            },
          ],
        },
      });
      me = {
        rank: better + 1,
        name:
          mine.user.displayName?.trim() ||
          user.displayName?.trim() ||
          mine.displayName?.trim() ||
          'You',
        score: mine.bestScore,
        avatarId: mine.avatarId,
        isYou: true,
      };
    }

    return { topicId: topic, top, me };
  }
}
