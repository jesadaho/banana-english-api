import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { getUserLocalTime, isSameDateKey } from '../common/timezone.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  avatarSeedCost,
  FREE_AVATAR_IDS,
  isKnownAvatarId,
} from './avatar-catalog';
import { CompleteOnboardingDto, UpsertUserDto } from './dto/users.dto';

export interface UserProfileResponse {
  anonymousId: string;
  displayName: string;
  onboardingCompleted: boolean;
  bananaBalance: number;
  xpBalance: number;
  bananaSeedBalance: number;
  streakDays: number;
  dailyUsedToday: boolean;
  timezone: string;
  unlockedAvatarIds: string[];
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly config: ConfigService,
  ) {}

  async upsertProfile(user: User, dto: UpsertUserDto): Promise<UserProfileResponse> {
    let updated = user;

    if (dto.displayName || dto.timezone || dto.fcmToken) {
      updated = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: dto.displayName ?? undefined,
          timezone: dto.timezone ?? undefined,
        },
      });

      if (dto.fcmToken) {
        await this.prisma.userFcmToken.upsert({
          where: { token: dto.fcmToken },
          create: {
            userId: user.id,
            token: dto.fcmToken,
            platform: dto.platform,
          },
          update: {
            userId: user.id,
            platform: dto.platform,
          },
        });
      }
    }

    return this.getProfile(updated);
  }

  async syncProfile(user: User): Promise<UserProfileResponse> {
    const local = getUserLocalTime(user.timezone);
    let updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastAppOpenDate: new Date(
          Date.UTC(
            Number(local.dateKey.slice(0, 4)),
            Number(local.dateKey.slice(5, 7)) - 1,
            Number(local.dateKey.slice(8, 10)),
          ),
        ),
      },
    });

    updated = await this.economy.maybeCreditDailyBanana(updated);
    updated = await this.economy.ensureOnboardingBonus(updated.id);
    return this.getProfile(updated);
  }

  async completeOnboarding(
    user: User,
    dto: CompleteOnboardingDto,
  ): Promise<UserProfileResponse> {
    if (dto.displayName) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { displayName: dto.displayName },
      });
    }

    const updated = await this.economy.creditOnboardingBonus(user.id);
    return this.getProfile(updated);
  }

  async refillBananasDebug(user: User): Promise<UserProfileResponse> {
    if (!this.isDebugEndpointsEnabled()) {
      throw new ForbiddenException('Debug endpoints are disabled');
    }

    const updated = await this.economy.creditDebugBananas(user.id);
    return this.getProfile(updated);
  }

  async resetStreakDebug(user: User): Promise<UserProfileResponse> {
    if (!this.isDebugEndpointsEnabled()) {
      throw new ForbiddenException('Debug endpoints are disabled');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        streakDays: 0,
        lastSessionDate: null,
        dailyMissionUsedDate: null,
        streakMilestonesClaimed: [],
      },
    });

    return this.getProfile(updated);
  }

  async resetProgressDebug(user: User): Promise<UserProfileResponse> {
    if (!this.isDebugEndpointsEnabled()) {
      throw new ForbiddenException('Debug endpoints are disabled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId: user.id } });
      return tx.user.update({
        where: { id: user.id },
        data: {
          streakDays: 0,
          lastSessionDate: null,
          dailyMissionUsedDate: null,
          streakMilestonesClaimed: [],
        },
      });
    });

    return this.getProfile(updated);
  }

  async unlockAvatar(
    user: User,
    avatarId: string,
  ): Promise<UserProfileResponse> {
    const id = avatarId.trim();
    if (!isKnownAvatarId(id)) {
      throw new BadRequestException('Unknown avatar');
    }

    const cost = avatarSeedCost(id);
    const alreadyUnlocked =
      (FREE_AVATAR_IDS as readonly string[]).includes(id) ||
      user.unlockedAvatarIds.includes(id);

    if (alreadyUnlocked) {
      if (cost <= 0 && !user.unlockedAvatarIds.includes(id)) {
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            unlockedAvatarIds: {
              set: [...new Set([...user.unlockedAvatarIds, id])],
            },
          },
        });
        return this.getProfile(updated);
      }
      return this.getProfile(user);
    }

    if (cost <= 0) {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          unlockedAvatarIds: {
            set: [...new Set([...user.unlockedAvatarIds, id])],
          },
        },
      });
      return this.getProfile(updated);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (current.unlockedAvatarIds.includes(id)) {
        return current;
      }
      if (current.bananaSeedBalance < cost) {
        throw new BadRequestException('Insufficient banana seed balance');
      }

      await tx.economyTransaction.create({
        data: {
          userId: user.id,
          currency: 'BANANA_SEED',
          amount: -cost,
          source: 'avatar_unlock',
          referenceId: `avatar:${id}`,
        },
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          bananaSeedBalance: { decrement: cost },
          unlockedAvatarIds: {
            set: [...new Set([...current.unlockedAvatarIds, id])],
          },
        },
      });
    });

    return this.getProfile(updated);
  }

  private isDebugEndpointsEnabled(): boolean {
    return (
      this.config.get<string>('NODE_ENV') !== 'production' ||
      this.config.get<string>('ENABLE_DEBUG_ENDPOINTS') === 'true'
    );
  }

  async updateDisplayName(userId: string, displayName: string) {
    if (!displayName.trim()) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: displayName.trim() },
    });
  }

  getProfile(user: User): UserProfileResponse {
    const local = getUserLocalTime(user.timezone);
    const unlockedAvatarIds = [
      ...new Set([...FREE_AVATAR_IDS, ...user.unlockedAvatarIds]),
    ];
    return {
      anonymousId: user.anonymousId,
      displayName: user.displayName ?? 'เพื่อน',
      onboardingCompleted: user.onboardingCompleted,
      bananaBalance: user.bananaBalance,
      xpBalance: user.xpBalance,
      bananaSeedBalance: user.bananaSeedBalance,
      streakDays: user.streakDays,
      dailyUsedToday: isSameDateKey(user.dailyMissionUsedDate, local.dateKey),
      timezone: user.timezone,
      unlockedAvatarIds,
    };
  }
}
