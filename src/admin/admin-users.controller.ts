import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AVATAR_GRANT_ONLY_IDS,
  AVATAR_SEED_COSTS,
  isGrantOnlyAvatar,
  isKnownAvatarId,
} from '../users/avatar-catalog';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminMetricsService } from './admin-metrics.service';

const AVATAR_LABELS: Record<string, string> = {
  frog_chick: 'Frog Chick (Live Talk)',
};

@Controller('admin/users')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: AdminMetricsService,
  ) {}

  /** Catalog for the admin assign UI (grant-only rewards first). */
  @Get('avatars')
  listAvatars() {
    const grantOnly = new Set<string>(AVATAR_GRANT_ONLY_IDS);
    const ids = Object.keys(AVATAR_SEED_COSTS).sort((a, b) => {
      const ga = grantOnly.has(a) ? 0 : 1;
      const gb = grantOnly.has(b) ? 0 : 1;
      return ga - gb || a.localeCompare(b);
    });
    return {
      avatars: ids.map((id) => ({
        id,
        label: AVATAR_LABELS[id] ?? id,
        grantOnly: isGrantOnlyAvatar(id),
        seedCost: AVATAR_SEED_COSTS[id],
      })),
    };
  }

  @Patch(':id/community-admin')
  async setCommunityAdmin(
    @Param('id') id: string,
    @Body() body: { enabled?: boolean },
  ) {
    const userId = id?.trim();
    if (!userId) throw new BadRequestException('Missing userId');
    if (typeof body.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be boolean');
    }
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { communityAdmin: body.enabled },
        select: { id: true, communityAdmin: true, displayName: true },
      });
      this.metrics.invalidateUsers();
      return user;
    } catch {
      throw new NotFoundException('user not found');
    }
  }

  /**
   * Unlock a catalog avatar for a learner (Live Talk / goodwill rewards).
   * Optionally wear it immediately. Does not spend banana seeds.
   */
  @Post(':id/avatars')
  async grantAvatar(
    @Param('id') id: string,
    @Body()
    body: { avatarId?: string; wear?: boolean; note?: string },
    @Req() req: { adminEmail?: string },
  ) {
    const userId = id?.trim();
    const avatarId = body.avatarId?.trim() ?? '';
    if (!userId) throw new BadRequestException('Missing userId');
    if (!isKnownAvatarId(avatarId)) {
      throw new BadRequestException('Unknown avatar');
    }
    const wear = body.wear !== false;
    const note = (body.note ?? '').trim();
    const adminEmail = req.adminEmail ?? 'unknown';

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        avatarId: true,
        unlockedAvatarIds: true,
      },
    });
    if (!user) throw new NotFoundException('user not found');

    const alreadyUnlocked = user.unlockedAvatarIds.includes(avatarId);
    const unlockedAvatarIds = [
      ...new Set([...user.unlockedAvatarIds, avatarId]),
    ];
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        unlockedAvatarIds: { set: unlockedAvatarIds },
        ...(wear ? { avatarId } : {}),
      },
      select: {
        id: true,
        displayName: true,
        avatarId: true,
        unlockedAvatarIds: true,
      },
    });

    this.metrics.invalidateUsers();
    return {
      id: updated.id,
      displayName: updated.displayName,
      avatarId: updated.avatarId,
      unlockedAvatarIds: updated.unlockedAvatarIds,
      grantedAvatarId: avatarId,
      alreadyUnlocked,
      wore: wear,
      note: note || null,
      adminEmail,
    };
  }
}
