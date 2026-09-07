import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AVATAR_SEED_COSTS,
  isKnownAvatarId,
} from '../users/avatar-catalog';

export type RecentActivityKind = 'mission' | 'minigame';

@Injectable()
export class RecentLearnersService {
  constructor(private readonly prisma: PrismaService) {}

  async markActivity(
    userId: string,
    kind: RecentActivityKind,
    contentId: string,
  ): Promise<void> {
    const id = contentId.trim();
    if (!id) return;
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lastActivityKind: kind,
          lastActivityId: id,
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      console.warn('Failed to mark last activity', { userId, kind, id, error });
    }
  }

  async getRecent(
    kind: RecentActivityKind,
    contentId: string,
    viewerUserId: string,
  ): Promise<{ total: number; avatarIds: string[] }> {
    const trimmed = contentId.trim();
    if (!trimmed) {
      return { total: 0, avatarIds: [] };
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where = {
      lastActivityKind: kind,
      lastActivityId: trimmed,
      lastActivityAt: { gte: since },
      id: { not: viewerUserId },
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        take: 5,
        select: {
          id: true,
          avatarId: true,
          unlockedAvatarIds: true,
        },
      }),
    ]);

    return {
      total,
      avatarIds: rows.map((row) =>
        this.resolveLearnerAvatarId(
          row.avatarId,
          row.unlockedAvatarIds,
          row.id,
        ),
      ),
    };
  }

  private resolveLearnerAvatarId(
    avatarId: string | null | undefined,
    unlockedAvatarIds: string[],
    userId: string,
  ): string {
    const trimmed = avatarId?.trim();
    if (trimmed && isKnownAvatarId(trimmed)) return trimmed;
    for (const unlocked of unlockedAvatarIds) {
      const id = unlocked.trim();
      if (id && isKnownAvatarId(id)) return id;
    }
    const catalog = Object.keys(AVATAR_SEED_COSTS);
    let hash = 0;
    for (let i = 0; i < userId.length; i += 1) {
      hash = (hash + userId.charCodeAt(i) * (i + 1)) % catalog.length;
    }
    return catalog[hash] ?? 'bogy';
  }
}
