import { BadRequestException, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { EndlessLeaderboardEntry } from './emoji-speak-endless-leaderboard.service';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO week in Bangkok time, e.g. `2026-W44`. Weeks start Monday 00:00. */
export function wordCardsWeekKey(now: Date = new Date()): string {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const day = local.getUTCDay() || 7; // Mon=1 … Sun=7
  const thursday = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 4 - day),
  );
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Thai countdown to next Monday 00:00 Bangkok, e.g. `3 วัน 5 ชม.` */
export function wordCardsResetsIn(now: Date = new Date()): string {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const day = local.getUTCDay() || 7;
  const nextMonday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + (8 - day),
  );
  const ms = nextMonday - local.getTime();
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / (60 * 60 * 1000));
  if (days > 0) return `${days} วัน ${hours} ชม.`;
  const minutes = Math.max(1, Math.floor((ms % (60 * 60 * 1000)) / 60000));
  return hours > 0 ? `${hours} ชม. ${minutes} นาที` : `${minutes} นาที`;
}

/** Weekly Word Cards Endless board (best score per user per week). */
@Injectable()
export class WordCardsLeaderboardService {
  static readonly TOP_SIZE = 20;

  constructor(private readonly prisma: PrismaService) {}

  async submitScore(
    user: User,
    score: number,
    avatarId?: string | null,
  ): Promise<{ weekKey: string; bestScore: number; improved: boolean; rank: number }> {
    if (!Number.isFinite(score) || score < 0 || score > 100000) {
      throw new BadRequestException('Invalid score');
    }
    const rounded = Math.floor(score);
    const weekKey = wordCardsWeekKey();
    const displayName = user.displayName?.trim() || null;
    const avatar = avatarId?.trim() || null;

    const existing = await this.prisma.wordCardsEndlessScore.findUnique({
      where: { userId_weekKey: { userId: user.id, weekKey } },
    });
    const improved = !existing || rounded > existing.bestScore;
    const saved = existing
      ? await this.prisma.wordCardsEndlessScore.update({
          where: { id: existing.id },
          data: {
            ...(improved ? { bestScore: rounded } : {}),
            displayName: displayName ?? existing.displayName,
            avatarId: avatar ?? existing.avatarId,
          },
        })
      : await this.prisma.wordCardsEndlessScore.create({
          data: { userId: user.id, weekKey, bestScore: rounded, displayName, avatarId: avatar },
        });
    return {
      weekKey,
      bestScore: saved.bestScore,
      improved,
      rank: await this.rankOf(weekKey, saved.bestScore, saved.updatedAt),
    };
  }

  async weeklyBoard(user: User): Promise<{
    weekKey: string;
    resetsIn: string;
    top: EndlessLeaderboardEntry[];
    me: EndlessLeaderboardEntry | null;
  }> {
    const weekKey = wordCardsWeekKey();
    const rows = await this.prisma.wordCardsEndlessScore.findMany({
      where: { weekKey },
      orderBy: [{ bestScore: 'desc' }, { updatedAt: 'asc' }],
      take: WordCardsLeaderboardService.TOP_SIZE,
      include: { user: { select: { displayName: true } } },
    });
    const top: EndlessLeaderboardEntry[] = rows.map((row, i) => ({
      rank: i + 1,
      name: row.user.displayName?.trim() || row.displayName?.trim() || 'Player',
      score: row.bestScore,
      avatarId: row.avatarId,
      isYou: row.userId === user.id,
    }));

    const mine = await this.prisma.wordCardsEndlessScore.findUnique({
      where: { userId_weekKey: { userId: user.id, weekKey } },
    });
    const me: EndlessLeaderboardEntry | null = mine
      ? {
          rank: await this.rankOf(weekKey, mine.bestScore, mine.updatedAt),
          name: user.displayName?.trim() || mine.displayName?.trim() || 'You',
          score: mine.bestScore,
          avatarId: mine.avatarId,
          isYou: true,
        }
      : null;

    return { weekKey, resetsIn: wordCardsResetsIn(), top, me };
  }

  /** Higher score first; ties go to whoever reached it earlier. */
  private async rankOf(weekKey: string, bestScore: number, updatedAt: Date): Promise<number> {
    const better = await this.prisma.wordCardsEndlessScore.count({
      where: {
        weekKey,
        OR: [
          { bestScore: { gt: bestScore } },
          { bestScore, updatedAt: { lt: updatedAt } },
        ],
      },
    });
    return better + 1;
  }
}
