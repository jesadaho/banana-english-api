import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, Prisma } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { getUserLocalTime, isSameDateKey } from '../common/timezone.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  avatarSeedCost,
  avatarMinPerfectStars,
  FREE_AVATAR_IDS,
  isKnownAvatarId,
} from './avatar-catalog';
import {
  AcquisitionSourceSurveyDto,
  CompleteOnboardingDto,
  EnglishLevelSurveyDto,
  UpsertUserDto,
} from './dto/users.dto';

export type SelfReportedEnglishLevel =
  | 'beginner'
  | 'elementary'
  | 'intermediate'
  | 'advanced';

export type AcquisitionSource =
  | 'tiktok'
  | 'facebook'
  | 'friend_line'
  | 'google'
  | 'app_store'
  | 'other'
  | 'skipped';

const SELF_REPORTED_ENGLISH_LEVELS = new Set<SelfReportedEnglishLevel>([
  'beginner',
  'elementary',
  'intermediate',
  'advanced',
]);

const ACQUISITION_SOURCES = new Set<AcquisitionSource>([
  'tiktok',
  'facebook',
  'friend_line',
  'google',
  'app_store',
  'other',
  'skipped',
]);

export interface UserProfileResponse {
  anonymousId: string;
  displayName: string;
  onboardingCompleted: boolean;
  bananaBalance: number;
  xpBalance: number;
  bananaSeedBalance: number;
  streakDays: number;
  /** Lifetime Daily Speak completions (once per local day). */
  dailySpeakCount: number;
  dailyUsedToday: boolean;
  timezone: string;
  unlockedAvatarIds: string[];
  lessonTeachingLanguage: 'thai' | 'english';
  email?: string | null;
  isGuest?: boolean;
  linkedProviders?: ('google' | 'apple')[];
  /**
   * Self-reported English level from onboarding survey:
   * beginner | elementary | intermediate | advanced
   */
  selfReportedEnglishLevel?: string | null;
  /**
   * How the learner found Banana English:
   * tiktok | facebook | friend_line | google | app_store | other | skipped
   */
  acquisitionSource?: string | null;
  /** Banana Ticket sheet copy — kept in sync with economy env/defaults. */
  bananaTicket: {
    dailyDrop: number;
    maxBalance: number;
    missionCost: number;
  };
}

export interface DebugRefillBananasByNameResponse {
  displayName: string;
  bananaBalance: number;
  credited: number;
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

    if (
      dto.displayName ||
      dto.timezone ||
      dto.fcmToken ||
      dto.lessonTeachingLanguage
    ) {
      updated = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: dto.displayName ?? undefined,
          timezone: dto.timezone ?? undefined,
          lessonTeachingLanguage: dto.lessonTeachingLanguage ?? undefined,
        } as Prisma.UserUpdateInput,
      });

      if (dto.displayName?.trim()) {
        await this.prisma.emojiSpeakEndlessWeeklyScore.updateMany({
          where: { userId: user.id },
          data: { displayName: dto.displayName.trim() },
        });
      }

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
      const trimmed = dto.displayName.trim();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { displayName: trimmed },
      });
      if (trimmed) {
        await this.prisma.emojiSpeakEndlessWeeklyScore.updateMany({
          where: { userId: user.id },
          data: { displayName: trimmed },
        });
      }
    }

    const updated = await this.economy.creditOnboardingBonus(user.id);
    return this.getProfile(updated);
  }

  async saveEnglishLevelSurvey(
    user: User,
    dto: EnglishLevelSurveyDto,
  ): Promise<UserProfileResponse> {
    if (!SELF_REPORTED_ENGLISH_LEVELS.has(dto.level)) {
      throw new BadRequestException('Invalid English level');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { selfReportedEnglishLevel: dto.level },
    });
    return this.getProfile(updated);
  }

  async saveAcquisitionSourceSurvey(
    user: User,
    dto: AcquisitionSourceSurveyDto,
  ): Promise<UserProfileResponse> {
    if (!ACQUISITION_SOURCES.has(dto.source)) {
      throw new BadRequestException('Invalid acquisition source');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { acquisitionSource: dto.source },
    });
    return this.getProfile(updated);
  }

  async refillBananasDebug(user: User): Promise<UserProfileResponse> {
    if (!this.isDebugEndpointsEnabled()) {
      throw new ForbiddenException('Debug endpoints are disabled');
    }

    const updated = await this.economy.creditDebugBananas(user.id);
    return this.getProfile(updated);
  }

  async refillBananasDebugByDisplayName(
    displayName: string,
  ): Promise<DebugRefillBananasByNameResponse> {
    if (!this.isDebugEndpointsEnabled()) {
      throw new ForbiddenException('Debug endpoints are disabled');
    }

    const trimmed = displayName.trim();
    if (!trimmed) {
      throw new BadRequestException('displayName is required');
    }

    const matches = await this.prisma.user.findMany({
      where: { displayName: trimmed },
    });

    if (matches.length === 0) {
      throw new NotFoundException(`No user found with displayName "${trimmed}"`);
    }
    if (matches.length > 1) {
      throw new ConflictException(
        `displayName "${trimmed}" matches ${matches.length} users — use a unique name`,
      );
    }

    const target = matches[0];
    const before = target.bananaBalance;
    const updated = await this.economy.creditDebugBananas(target.id);

    return {
      displayName: updated.displayName ?? trimmed,
      bananaBalance: updated.bananaBalance,
      credited: updated.bananaBalance - before,
    };
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
      await tx.userAchievement.deleteMany({ where: { userId: user.id } });
      await tx.userOutfit.deleteMany({ where: { userId: user.id } });
      await tx.userSession.deleteMany({ where: { userId: user.id } });
      return tx.user.update({
        where: { id: user.id },
        data: {
          streakDays: 0,
          lastSessionDate: null,
          dailyMissionUsedDate: null,
          streakMilestonesClaimed: [],
          longestStreakDays: 0,
          perfectVocabDrillCompleted: false,
          dailySpeakCount: 0,
        } as Prisma.UserUpdateInput,
      });
    });

    return this.getProfile(updated);
  }

  /** Clears today's Daily Speak claim so the banner / reward can be tested again. */
  async resetDailySpeakDebug(user: User): Promise<UserProfileResponse> {
    if (!this.isDebugEndpointsEnabled()) {
      throw new ForbiddenException('Debug endpoints are disabled');
    }

    const local = getUserLocalTime(user.timezone);
    const referenceId = `daily_speak:${local.dateKey}`;

    const deleted = await this.prisma.economyTransaction.deleteMany({
      where: {
        userId: user.id,
        source: 'daily_speak_reward',
        referenceId,
      },
    });

    let updated = user;
    const currentCount =
      (user as User & { dailySpeakCount?: number }).dailySpeakCount ?? 0;
    if (deleted.count > 0 && currentCount > 0) {
      updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { dailySpeakCount: { decrement: 1 } } as Prisma.UserUpdateInput,
      });
    }

    return this.getProfile(updated);
  }

  async unlockAvatar(
    user: User,
    avatarId: string,
    perfectMinigameStars = 0,
  ): Promise<UserProfileResponse> {
    const id = avatarId.trim();
    if (!isKnownAvatarId(id)) {
      throw new BadRequestException('Unknown avatar');
    }

    const cost = avatarSeedCost(id);
    const minPerfectStars = avatarMinPerfectStars(id);
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

    if (minPerfectStars > 0 && perfectMinigameStars < minPerfectStars) {
      throw new BadRequestException('Not enough Perfect Stars');
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
    const trimmed = displayName.trim();
    await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: trimmed },
    });
    await this.prisma.emojiSpeakEndlessWeeklyScore.updateMany({
      where: { userId },
      data: { displayName: trimmed },
    });
  }

  async getFreeTalkMemories(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { freeTalkMemories: true },
    });
    return (user?.freeTalkMemories ?? []).slice(0, 5);
  }

  async setFreeTalkMemories(userId: string, memories: string[]): Promise<void> {
    const cleaned = memories
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 5);
    await this.prisma.user.update({
      where: { id: userId },
      data: { freeTalkMemories: cleaned },
    });
  }

  getProfile(user: User): UserProfileResponse {
    const local = getUserLocalTime(user.timezone);
    const unlockedAvatarIds = [
      ...new Set([...FREE_AVATAR_IDS, ...user.unlockedAvatarIds]),
    ];
    const rawLang = (user as User & { lessonTeachingLanguage?: string })
      .lessonTeachingLanguage;
    const lessonTeachingLanguage =
      rawLang === 'english' ? 'english' : 'thai';
    const rawLevel = (user as User & { selfReportedEnglishLevel?: string | null })
      .selfReportedEnglishLevel;
    const selfReportedEnglishLevel =
      rawLevel && SELF_REPORTED_ENGLISH_LEVELS.has(rawLevel as SelfReportedEnglishLevel)
        ? rawLevel
        : null;
    const rawAcquisition = (
      user as User & { acquisitionSource?: string | null }
    ).acquisitionSource;
    const acquisitionSource =
      rawAcquisition && ACQUISITION_SOURCES.has(rawAcquisition as AcquisitionSource)
        ? rawAcquisition
        : null;
    return {
      anonymousId: user.anonymousId,
      displayName: user.displayName ?? 'เพื่อน',
      onboardingCompleted: user.onboardingCompleted,
      bananaBalance: user.bananaBalance,
      xpBalance: user.xpBalance,
      bananaSeedBalance: user.bananaSeedBalance,
      streakDays: user.streakDays,
      dailySpeakCount:
        (user as User & { dailySpeakCount?: number }).dailySpeakCount ?? 0,
      dailyUsedToday: isSameDateKey(user.dailyMissionUsedDate, local.dateKey),
      timezone: user.timezone,
      unlockedAvatarIds,
      lessonTeachingLanguage,
      selfReportedEnglishLevel,
      acquisitionSource,
      email: user.email,
      bananaTicket: this.economy.ticketRules(),
    };
  }
}
