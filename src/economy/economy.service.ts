import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Currency, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DAILY_BANANA_DROP,
  DEBUG_BANANA_REFILL,
  ENV_DAILY_BANANA_DROP,
  ENV_DEBUG_BANANA_REFILL,
  ENV_ONBOARDING_BANANA_BONUS,
  ONBOARDING_BANANA_BONUS,
  STREAK_MILESTONES,
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

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA,
        amount: bonus,
        source: 'onboarding_bonus',
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          onboardingCompleted: true,
          bananaBalance: { increment: bonus },
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

      await this.recordTransaction(tx, {
        userId: user.id,
        currency: Currency.BANANA,
        amount: drop,
        source: 'daily_drop',
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          bananaBalance: { increment: drop },
          lastDailyBananaDate: parseDateKey(local.dateKey),
        },
      });
    });
  }

  async creditDebugBananas(userId: string, amount?: number): Promise<User> {
    const credit = amount ?? this.debugBananaRefill();
    return this.prisma.$transaction(async (tx) => {
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
        source: 'mission_start',
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
        data: { rewardsApplied: true },
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
