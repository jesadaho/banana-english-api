import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Currency, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DAILY_BANANA_DROP,
  DEBUG_BANANA_REFILL,
  ENV_DAILY_BANANA_DROP,
  ENV_DEBUG_BANANA_REFILL,
  ENV_MAX_BANANA_BALANCE,
  ENV_ONBOARDING_BANANA_BONUS,
  LESSON_REWARD_SEEDS,
  LESSON_REWARD_XP,
  MAX_BANANA_BALANCE,
  ONBOARDING_BANANA_BONUS,
  STREAK_MILESTONES,
  cappedBananaCredit,
  getMissionReward,
} from './economy.constants';
import {
  getUserLocalTime,
  isSameDateKey,
  parseDateKey,
  previousDateKey,
} from '../common/timezone.util';

export interface UserBalances {
  bananas: number;
  xp: number;
  seeds: number;
}

export interface StreakBonus {
  days: number;
  seedsEarned: number;
}

export interface SessionRewardResult {
  xpEarned: number;
  seedsEarned: number;
  ratingLabel: string;
  streakDays: number;
  previousStreakDays: number;
  streakBonus?: StreakBonus;
  balances: UserBalances;
  isDailyMission: boolean;
}

@Injectable()
export class EconomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private envInt(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (raw == null || raw.trim() === '') {
      return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    return parsed;
  }

  private onboardingBananaBonus(): number {
    return this.envInt(ENV_ONBOARDING_BANANA_BONUS, ONBOARDING_BANANA_BONUS);
  }

  private dailyBananaDrop(): number {
    return this.envInt(ENV_DAILY_BANANA_DROP, DAILY_BANANA_DROP);
  }

  private debugBananaRefill(): number {
    return this.envInt(ENV_DEBUG_BANANA_REFILL, DEBUG_BANANA_REFILL);
  }

  private maxBananaBalance(): number {
    return this.envInt(ENV_MAX_BANANA_BALANCE, MAX_BANANA_BALANCE);
  }

  async creditOnboardingBonus(userId: string): Promise<User> {
    const bonus = this.onboardingBananaBonus();
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const existingBonus = await tx.economyTransaction.findFirst({
        where: { userId, source: 'onboarding_bonus' },
      });

      if (existingBonus) {
        if (user.onboardingCompleted) {
          return user;
        }

        return tx.user.update({
          where: { id: userId },
          data: { onboardingCompleted: true },
        });
      }

      const credit = cappedBananaCredit(
        user.bananaBalance,
        bonus,
        this.maxBananaBalance(),
      );

      // Always record so ensureOnboardingBonus does not retry when already at cap.
      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA,
        amount: credit,
        source: 'onboarding_bonus',
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          onboardingCompleted: true,
          ...(credit > 0 ? { bananaBalance: { increment: credit } } : {}),
        },
      });
    });
  }

  async ensureOnboardingBonus(userId: string): Promise<User> {
    const existingBonus = await this.prisma.economyTransaction.findFirst({
      where: { userId, source: 'onboarding_bonus' },
    });
    if (existingBonus) {
      return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.onboardingCompleted) {
      return user;
    }

    return this.creditOnboardingBonus(userId);
  }

  async maybeCreditDailyBanana(user: User, now = new Date()): Promise<User> {
    const local = getUserLocalTime(user.timezone, now);
    if (local.hour < 8) {
      return user;
    }
    if (isSameDateKey(user.lastDailyBananaDate, local.dateKey)) {
      return user;
    }

    const drop = this.dailyBananaDrop();
    return this.prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (isSameDateKey(fresh.lastDailyBananaDate, local.dateKey)) {
        return fresh;
      }

      const credit = cappedBananaCredit(
        fresh.bananaBalance,
        drop,
        this.maxBananaBalance(),
      );

      if (credit > 0) {
        await this.recordTransaction(tx, {
          userId: user.id,
          currency: Currency.BANANA,
          amount: credit,
          source: 'daily_drop',
        });
      }

      return tx.user.update({
        where: { id: user.id },
        data: {
          ...(credit > 0 ? { bananaBalance: { increment: credit } } : {}),
          lastDailyBananaDate: parseDateKey(local.dateKey),
        },
      });
    });
  }

  async creditDebugBananas(userId: string, amount?: number): Promise<User> {
    const requested = amount ?? this.debugBananaRefill();
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const credit = cappedBananaCredit(
        user.bananaBalance,
        requested,
        this.maxBananaBalance(),
      );

      if (credit <= 0) {
        return user;
      }

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA,
        amount: credit,
        source: 'debug_refill',
      });

      return tx.user.update({
        where: { id: userId },
        data: { bananaBalance: { increment: credit } },
      });
    });
  }

  async spendBananas(
    userId: string,
    amount: number,
    referenceId: string,
    source: 'mission_start' | 'lesson_start' = 'mission_start',
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.bananaBalance < amount) {
        throw new BadRequestException('Insufficient banana balance');
      }

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA,
        amount: -amount,
        source,
        referenceId,
      });

      return tx.user.update({
        where: { id: userId },
        data: { bananaBalance: { decrement: amount } },
      });
    });
  }

  async spendSeeds(
    userId: string,
    amount: number,
    referenceId: string,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.bananaSeedBalance < amount) {
        throw new BadRequestException('Insufficient banana seed balance');
      }

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA_SEED,
        amount: -amount,
        source: 'avatar_unlock',
        referenceId,
      });

      return tx.user.update({
        where: { id: userId },
        data: { bananaSeedBalance: { decrement: amount } },
      });
    });
  }

  async applyLessonRewards(params: {
    userId: string;
    sessionId: string;
    lessonId: string;
  }): Promise<SessionRewardResult | null> {
    const { userId, sessionId, lessonId } = params;

    return this.prisma.$transaction(async (tx) => {
      const priorCompletion = await tx.userSession.findFirst({
        where: {
          userId,
          lessonId,
          rewardsApplied: true,
          id: { not: sessionId },
        },
      });

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const previousStreakDays = user.streakDays;

      if (priorCompletion) {
        await tx.userSession.update({
          where: { id: sessionId },
          data: {
            rewardsApplied: true,
            completedAt: new Date(),
            xpEarned: 0,
            seedsEarned: 0,
            scoreLabel: 'Lesson Complete',
          },
        });

        return {
          xpEarned: 0,
          seedsEarned: 0,
          ratingLabel: 'Lesson Complete',
          streakDays: user.streakDays,
          previousStreakDays,
          balances: this.toBalances(user),
          isDailyMission: false,
        };
      }

      const xpEarned = LESSON_REWARD_XP;
      const seedsEarned = LESSON_REWARD_SEEDS;
      const local = getUserLocalTime(user.timezone);
      const todayKey = local.dateKey;
      const streakUpdate = this.computeStreakUpdate(user, todayKey);
      const streakDays = streakUpdate.streakDays;

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.XP,
        amount: xpEarned,
        source: 'lesson_reward',
        referenceId: sessionId,
      });
      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA_SEED,
        amount: seedsEarned,
        source: 'lesson_reward',
        referenceId: sessionId,
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          xpBalance: { increment: xpEarned },
          bananaSeedBalance: { increment: seedsEarned },
          streakDays,
          lastSessionDate: parseDateKey(todayKey),
        },
      });

      await tx.userSession.update({
        where: { id: sessionId },
        data: {
          rewardsApplied: true,
          completedAt: new Date(),
          xpEarned,
          seedsEarned,
          scoreLabel: 'Lesson Complete',
        },
      });

      return {
        xpEarned,
        seedsEarned,
        ratingLabel: 'Lesson Complete',
        streakDays,
        previousStreakDays,
        balances: this.toBalances(updated),
        isDailyMission: false,
      };
    });
  }

  async applyMissionRewards(params: {
    userId: string;
    sessionId: string;
    overallScore: number;
    isDailyMission: boolean;
  }): Promise<SessionRewardResult> {
    const { userId, sessionId, overallScore, isDailyMission } = params;
    const reward = getMissionReward(overallScore);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const previousStreakDays = user.streakDays;
      let streakDays = user.streakDays;
      let streakBonus: StreakBonus | undefined;
      let milestones = [...user.streakMilestonesClaimed];
      const local = getUserLocalTime(user.timezone);
      const todayKey = local.dateKey;

      let xpEarned = reward.xp;
      let seedsEarned = reward.seeds;

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.XP,
        amount: reward.xp,
        source: 'mission_reward',
        referenceId: sessionId,
      });
      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA_SEED,
        amount: reward.seeds,
        source: 'mission_reward',
        referenceId: sessionId,
      });

      const updateData: Prisma.UserUpdateInput = {
        xpBalance: { increment: reward.xp },
        bananaSeedBalance: { increment: reward.seeds },
      };

      if (isDailyMission) {
        const streakUpdate = this.computeStreakUpdate(user, todayKey);
        streakDays = streakUpdate.streakDays;
        updateData.streakDays = streakDays;
        updateData.lastSessionDate = parseDateKey(todayKey);
        updateData.dailyMissionUsedDate = parseDateKey(todayKey);

        const milestone = STREAK_MILESTONES.find(
          (item) =>
            streakDays >= item.days && !milestones.includes(item.days),
        );
        if (milestone) {
          milestones = [...milestones, milestone.days];
          seedsEarned += milestone.seeds;
          streakBonus = {
            days: milestone.days,
            seedsEarned: milestone.seeds,
          };
          await this.recordTransaction(tx, {
            userId,
            currency: Currency.BANANA_SEED,
            amount: milestone.seeds,
            source: 'streak_milestone',
            referenceId: String(milestone.days),
          });
          updateData.bananaSeedBalance = {
            increment: reward.seeds + milestone.seeds,
          };
          updateData.streakMilestonesClaimed = milestones;
        }
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      await tx.userSession.update({
        where: { id: sessionId },
        data: {
          rewardsApplied: true,
          completedAt: new Date(),
          overallScore,
          scoreLabel: reward.ratingLabel,
          xpEarned,
          seedsEarned,
        },
      });

      return {
        xpEarned,
        seedsEarned,
        ratingLabel: reward.ratingLabel,
        streakDays,
        previousStreakDays,
        streakBonus,
        balances: this.toBalances(updated),
        isDailyMission,
      };
    });
  }

  private computeStreakUpdate(
    user: User,
    todayKey: string,
  ): { streakDays: number } {
    if (!user.lastSessionDate) {
      return { streakDays: 1 };
    }

    if (isSameDateKey(user.lastSessionDate, todayKey)) {
      return { streakDays: user.streakDays };
    }

    const yesterdayKey = previousDateKey(todayKey);
    if (isSameDateKey(user.lastSessionDate, yesterdayKey)) {
      return { streakDays: user.streakDays + 1 };
    }

    return { streakDays: 1 };
  }

  toBalances(user: User): UserBalances {
    return {
      bananas: user.bananaBalance,
      xp: user.xpBalance,
      seeds: user.bananaSeedBalance,
    };
  }

  private async recordTransaction(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      currency: Currency;
      amount: number;
      source: string;
      referenceId?: string;
    },
  ) {
    await tx.economyTransaction.create({
      data: {
        userId: params.userId,
        currency: params.currency,
        amount: params.amount,
        source: params.source,
        referenceId: params.referenceId,
      },
    });
  }
}
