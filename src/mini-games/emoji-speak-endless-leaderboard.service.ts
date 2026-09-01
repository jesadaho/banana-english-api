import { BadRequestException, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type EndlessLeaderboardEntry = {
  rank: number;
  name: string;
  score: number;
  avatarId: string | null;
  isYou?: boolean;
};

/**
 * All-time Endless board for now (few players).
 * Uses fixed weekKey "all" so we can switch back to weekly later without schema change.
 */
@Injectable()
export class EmojiSpeakEndlessLeaderboardService {
  /** Sentinel board bucket — not a real ISO week. */
  static readonly ALL_TIME_KEY = 'all';

  static readonly LEADERBOARD_TOP_SIZE = 5;

  constructor(private readonly prisma: PrismaService) {}

  async submitScore(
    user: User,
    score: number,
    avatarId?: string | null,
  ): Promise<{ weekKey: string; bestScore: number; improved: boolean }> {
    if (!Number.isFinite(score) || score < 0 || score > 100000) {
      throw new BadRequestException('Invalid score');
    }
    const rounded = Math.floor(score);
    const weekKey = EmojiSpeakEndlessLeaderboardService.ALL_TIME_KEY;
    const displayName = user.displayName?.trim() || null;
    const avatar = avatarId?.trim() || null;

    const existing = await this.prisma.emojiSpeakEndlessWeeklyScore.findUnique({
      where: { userId_weekKey: { userId: user.id, weekKey } },
    });

    if (!existing) {
      const created = await this.prisma.emojiSpeakEndlessWeeklyScore.create({
        data: {
          userId: user.id,
          weekKey,
          bestScore: rounded,
          displayName,
          avatarId: avatar,
        },
      });
      return { weekKey, bestScore: created.bestScore, improved: true };
    }

    const improved = rounded > existing.bestScore;
    const updated = await this.prisma.emojiSpeakEndlessWeeklyScore.update({
      where: { id: existing.id },
      data: {
        bestScore: improved ? rounded : existing.bestScore,
        // Always refresh name/avatar snapshot from current profile.
        displayName: displayName ?? existing.displayName,
        avatarId: avatar ?? existing.avatarId,
      },
    });
    return { weekKey, bestScore: updated.bestScore, improved };
  }

  /** Keep leaderboard name in sync when the user renames. */
  async syncDisplayName(userId: string, displayName: string): Promise<void> {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    await this.prisma.emojiSpeakEndlessWeeklyScore.updateMany({
      where: { userId },
      data: { displayName: trimmed },
    });
  }

  async weeklyBoard(user: User): Promise<{
    weekKey: string;
    resetsIn: string;
    top: EndlessLeaderboardEntry[];
    me: EndlessLeaderboardEntry | null;
  }> {
    const weekKey = EmojiSpeakEndlessLeaderboardService.ALL_TIME_KEY;
    // Empty while all-time — hub hides the reset chip.
    const resetsIn = '';

    const topRows = await this.prisma.emojiSpeakEndlessWeeklyScore.findMany({
      where: { weekKey },
      orderBy: [{ bestScore: 'desc' }, { updatedAt: 'asc' }],
      take: EmojiSpeakEndlessLeaderboardService.LEADERBOARD_TOP_SIZE,
      include: { user: { select: { displayName: true } } },
    });

    const top: EndlessLeaderboardEntry[] = topRows.map((row, i) => ({
      rank: i + 1,
      name:
        row.user.displayName?.trim() ||
        row.displayName?.trim() ||
        'Player',
      score: row.bestScore,
      avatarId: row.avatarId,
      isYou: row.userId === user.id,
    }));

    const mine = await this.prisma.emojiSpeakEndlessWeeklyScore.findUnique({
      where: { userId_weekKey: { userId: user.id, weekKey } },
      include: { user: { select: { displayName: true } } },
    });

    let me: EndlessLeaderboardEntry | null = null;
    if (mine) {
      const better = await this.prisma.emojiSpeakEndlessWeeklyScore.count({
        where: {
          weekKey,
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

    return { weekKey, resetsIn, top, me };
  }
}
