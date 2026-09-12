import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Currency, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DAILY_BANANA_DROP,
  DAILY_SPEAK_REWARD_SEEDS,
  DAILY_SPEAK_REWARD_XP,
  DEBUG_BANANA_REFILL,
  ENV_DAILY_BANANA_DROP,
  ENV_DEBUG_BANANA_REFILL,
  ENV_MAX_BANANA_BALANCE,
  ENV_ONBOARDING_BANANA_BONUS,
  LESSON_REWARD_SEEDS,
  LESSON_REWARD_XP,
  LESSON_REVIEW_REWARD_SEEDS,
  LESSON_REVIEW_REWARD_XP,
  MAX_BANANA_BALANCE,
  MISSION_BANANA_COST,
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
  streakIncreased?: boolean;
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

  /** Rules shown in the Banana Ticket UI — env-overridable where applicable. */
  ticketRules(): {
    dailyDrop: number;
    maxBalance: number;
    missionCost: number;
  } {
    return {
      dailyDrop: this.dailyBananaDrop(),
      maxBalance: this.maxBananaBalance(),
      missionCost: MISSION_BANANA_COST,
    };
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
        user.freeBananaBalance,
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
          ...(credit > 0
            ? {
                bananaBalance: { increment: credit },
                freeBananaBalance: { increment: credit },
              }
            : {}),
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
    if (local.hour < 9) {
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
        fresh.freeBananaBalance,
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
          ...(credit > 0
            ? {
                bananaBalance: { increment: credit },
                freeBananaBalance: { increment: credit },
              }
            : {}),
          lastDailyBananaDate: parseDateKey(local.dateKey),
        },
      });
    });
  }

  /**
   * Credit IAP bananas if this store transaction has not been ledgered yet.
   * Call inside an existing Prisma transaction (with PurchaseRecord writes).
   */
  async creditIapIfNeeded(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    storeTransactionId: string,
  ): Promise<{ user: User; credited: boolean }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid purchase amount');
    }
    const rounded = Math.floor(amount);
    const existing = await tx.economyTransaction.findFirst({
      where: {
        userId,
        source: 'iap_purchase',
        referenceId: storeTransactionId,
        currency: Currency.BANANA,
      },
    });
    if (existing) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return { user, credited: false };
    }

    await this.recordTransaction(tx, {
      userId,
      currency: Currency.BANANA,
      amount: rounded,
      source: 'iap_purchase',
      referenceId: storeTransactionId,
    });
    const user = await tx.user.update({
      where: { id: userId },
      data: { bananaBalance: { increment: rounded } },
    });
    return { user, credited: true };
  }

  /** IAP credits bypass the free-earn soft cap. */
  async creditPurchasedBananas(
    userId: string,
    amount: number,
    referenceId: string,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const { user } = await this.creditIapIfNeeded(
        tx,
        userId,
        amount,
        referenceId,
      );
      return user;
    });
  }

  /** Comment bonus on a rating — uncapped (not [cappedBananaCredit]). */
  async creditRatingCommentBonus(
    userId: string,
    amount: number,
    referenceId: string,
  ): Promise<User> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid rating bonus amount');
    }
    const rounded = Math.floor(amount);
    return this.prisma.$transaction(async (tx) => {
      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA,
        amount: rounded,
        source: 'rating_comment_bonus',
        referenceId,
      });

      return tx.user.update({
        where: { id: userId },
        data: { bananaBalance: { increment: rounded } },
      });
    });
  }

  async creditDebugBananas(userId: string, amount?: number): Promise<User> {
    const requested = amount ?? this.debugBananaRefill();
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const credit = cappedBananaCredit(
        user.freeBananaBalance,
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
        data: {
          bananaBalance: { increment: credit },
          freeBananaBalance: { increment: credit },
        },
      });
    });
  }

  async spendBananas(
    userId: string,
    amount: number,
    referenceId: string,
    source: 'mission_start' | 'lesson_start' | 'free_talk_start' | 'say_it_start' | 'explain_it_start' | 'emoji_speak_start' = 'mission_start',
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.bananaBalance < amount) {
        throw new BadRequestException('Insufficient banana balance');
      }

      const fromFree = Math.min(Math.max(0, user.freeBananaBalance), amount);

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA,
        amount: -amount,
        source,
        referenceId,
      });
      if (fromFree > 0) {
        await this.recordTransaction(tx, {
          userId,
          currency: Currency.BANANA,
          amount: fromFree,
          source: 'banana_free_leg',
          referenceId,
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          bananaBalance: { decrement: amount },
          ...(fromFree > 0
            ? { freeBananaBalance: { decrement: fromFree } }
            : {}),
        },
      });
    });
  }

  /**
   * Refund a prior banana spend if the session never became playable.
   * Idempotent on (userId, source, referenceId).
   */
  async refundBananas(
    userId: string,
    amount: number,
    referenceId: string,
    source:
      | 'lesson_start_refund'
      | 'mission_start_refund'
      | 'free_talk_start_refund'
      | 'say_it_start_refund'
      | 'explain_it_start_refund'
      | 'emoji_speak_start_refund',
  ): Promise<User> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.economyTransaction.findFirst({
        where: {
          userId,
          source,
          referenceId,
          currency: Currency.BANANA,
        },
      });
      if (existing) {
        return tx.user.findUniqueOrThrow({ where: { id: userId } });
      }

      const freeLeg = await tx.economyTransaction.findFirst({
        where: {
          userId,
          source: 'banana_free_leg',
          referenceId,
          currency: Currency.BANANA,
        },
      });
      const fromFree = Math.min(
        amount,
        Math.max(0, freeLeg?.amount ?? 0),
      );

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA,
        amount,
        source,
        referenceId,
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          bananaBalance: { increment: amount },
          ...(fromFree > 0
            ? { freeBananaBalance: { increment: fromFree } }
            : {}),
        },
      });
    });
  }

  /**
   * Zero-banana activity marker for metrics (free minigame plays, etc.).
   * Does not change balances.
   */
  async logPlayActivity(
    userId: string,
    source: string,
    referenceId: string,
  ): Promise<void> {
    await this.prisma.economyTransaction.create({
      data: {
        userId,
        currency: Currency.BANANA,
        amount: 0,
        source,
        referenceId,
      },
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
      const local = getUserLocalTime(user.timezone);
      const todayKey = local.dateKey;
      const isReview = Boolean(priorCompletion);

      let xpEarned = 0;
      let seedsEarned = 0;
      let rewardSource: 'lesson_reward' | 'lesson_review' = 'lesson_reward';

      if (isReview) {
        const reviewRef = `lesson_review:${todayKey}`;
        const alreadyReviewedToday = await tx.economyTransaction.findFirst({
          where: {
            userId,
            source: 'lesson_review',
            referenceId: reviewRef,
            currency: Currency.XP,
          },
        });
        if (!alreadyReviewedToday) {
          xpEarned = LESSON_REVIEW_REWARD_XP;
          seedsEarned = LESSON_REVIEW_REWARD_SEEDS;
          rewardSource = 'lesson_review';
        }
      } else {
        xpEarned = LESSON_REWARD_XP;
        seedsEarned = LESSON_REWARD_SEEDS;
      }

      if (xpEarned > 0) {
        await this.recordTransaction(tx, {
          userId,
          currency: Currency.XP,
          amount: xpEarned,
          source: rewardSource,
          referenceId: isReview ? `lesson_review:${todayKey}` : sessionId,
        });
      }
      if (seedsEarned > 0) {
        await this.recordTransaction(tx, {
          userId,
          currency: Currency.BANANA_SEED,
          amount: seedsEarned,
          source: rewardSource,
          referenceId: isReview ? `lesson_review:${todayKey}` : sessionId,
        });
      }

      const streak = await this.applyStreakAndMilestone(tx, user, todayKey);
      const totalSeeds = seedsEarned + streak.milestoneSeeds;
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...streak.userUpdate,
          ...(xpEarned > 0 ? { xpBalance: { increment: xpEarned } } : {}),
          ...(totalSeeds > 0
            ? { bananaSeedBalance: { increment: totalSeeds } }
            : {}),
        },
      });

      await tx.userSession.update({
        where: { id: sessionId },
        data: {
          rewardsApplied: true,
          completedAt: new Date(),
          xpEarned,
          seedsEarned: totalSeeds,
          scoreLabel: 'Lesson Complete',
        },
      });

      return {
        xpEarned,
        seedsEarned: totalSeeds,
        ratingLabel: 'Lesson Complete',
        streakDays: streak.streakDays,
        previousStreakDays: streak.previousStreakDays,
        streakIncreased: streak.streakDays !== streak.previousStreakDays,
        streakBonus: streak.streakBonus,
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
      const local = getUserLocalTime(user.timezone);
      const todayKey = local.dateKey;

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

      const streak = await this.applyStreakAndMilestone(tx, user, todayKey);
      const seedsEarned = reward.seeds + streak.milestoneSeeds;

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...streak.userUpdate,
          xpBalance: { increment: reward.xp },
          bananaSeedBalance: { increment: seedsEarned },
          ...(isDailyMission
            ? { dailyMissionUsedDate: parseDateKey(todayKey) }
            : {}),
        },
      });

      await tx.userSession.update({
        where: { id: sessionId },
        data: {
          rewardsApplied: true,
          completedAt: new Date(),
          overallScore,
          scoreLabel: reward.ratingLabel,
          xpEarned: reward.xp,
          seedsEarned,
        },
      });

      return {
        xpEarned: reward.xp,
        seedsEarned,
        ratingLabel: reward.ratingLabel,
        streakDays: streak.streakDays,
        previousStreakDays: streak.previousStreakDays,
        streakIncreased: streak.streakDays !== streak.previousStreakDays,
        streakBonus: streak.streakBonus,
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

  /**
   * Shared streak + one unclaimed milestone grant per qualifying completion.
   */
  private async applyStreakAndMilestone(
    tx: Prisma.TransactionClient,
    user: User,
    todayKey: string,
  ): Promise<{
    previousStreakDays: number;
    streakDays: number;
    streakBonus?: StreakBonus;
    milestoneSeeds: number;
    userUpdate: Prisma.UserUpdateInput;
  }> {
    const previousStreakDays = user.streakDays;
    const { streakDays } = this.computeStreakUpdate(user, todayKey);
    let milestones = [...user.streakMilestonesClaimed];
    let streakBonus: StreakBonus | undefined;
    let milestoneSeeds = 0;

    const milestone = STREAK_MILESTONES.find(
      (item) => streakDays >= item.days && !milestones.includes(item.days),
    );
    if (milestone) {
      milestones = [...milestones, milestone.days];
      milestoneSeeds = milestone.seeds;
      streakBonus = {
        days: milestone.days,
        seedsEarned: milestone.seeds,
      };
      await this.recordTransaction(tx, {
        userId: user.id,
        currency: Currency.BANANA_SEED,
        amount: milestone.seeds,
        source: 'streak_milestone',
        referenceId: String(milestone.days),
      });
    }

    return {
      previousStreakDays,
      streakDays,
      streakBonus,
      milestoneSeeds,
      userUpdate: {
        streakDays,
        longestStreakDays: Math.max(user.longestStreakDays, streakDays),
        lastSessionDate: parseDateKey(todayKey),
        ...(milestone ? { streakMilestonesClaimed: milestones } : {}),
      },
    };
  }

  /**
   * Daily Speak: once-per-local-day XP/seeds + streak update.
   * Idempotent via economyTransaction referenceId `daily_speak:YYYY-MM-DD`.
   */
  async applyDailySpeakRewards(params: {
    userId: string;
  }): Promise<{
    xpEarned: number;
    seedsEarned: number;
    ratingLabel: string;
    streakDays: number;
    previousStreakDays: number;
    streakIncreased: boolean;
    streakBonus?: StreakBonus;
    dailySpeakCount: number;
    balances: UserBalances;
    isDailyMission: boolean;
    alreadyClaimed: boolean;
  }> {
    const { userId } = params;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const local = getUserLocalTime(user.timezone);
      const todayKey = local.dateKey;
      const referenceId = `daily_speak:${todayKey}`;

      const prior = await tx.economyTransaction.findFirst({
        where: {
          userId,
          source: 'daily_speak_reward',
          referenceId,
          currency: Currency.XP,
        },
      });

      const streak = await this.applyStreakAndMilestone(tx, user, todayKey);
      const dailySpeakCount =
        (user as User & { dailySpeakCount?: number }).dailySpeakCount ?? 0;

      if (prior) {
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            ...streak.userUpdate,
            ...(streak.milestoneSeeds > 0
              ? { bananaSeedBalance: { increment: streak.milestoneSeeds } }
              : {}),
          },
        });

        return {
          xpEarned: 0,
          seedsEarned: streak.milestoneSeeds,
          ratingLabel: 'Speak Today',
          streakDays: streak.streakDays,
          previousStreakDays: streak.previousStreakDays,
          streakIncreased: streak.streakDays !== streak.previousStreakDays,
          streakBonus: streak.streakBonus,
          dailySpeakCount,
          balances: this.toBalances(updated),
          isDailyMission: false,
          alreadyClaimed: true,
        };
      }

      const xpEarned = DAILY_SPEAK_REWARD_XP;
      const seedsEarned = DAILY_SPEAK_REWARD_SEEDS + streak.milestoneSeeds;

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.XP,
        amount: xpEarned,
        source: 'daily_speak_reward',
        referenceId,
      });
      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA_SEED,
        amount: DAILY_SPEAK_REWARD_SEEDS,
        source: 'daily_speak_reward',
        referenceId,
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...streak.userUpdate,
          xpBalance: { increment: xpEarned },
          bananaSeedBalance: { increment: seedsEarned },
          dailySpeakCount: { increment: 1 },
        } as Prisma.UserUpdateInput,
      });

      return {
        xpEarned,
        seedsEarned,
        ratingLabel: 'Speak Today',
        streakDays: streak.streakDays,
        previousStreakDays: streak.previousStreakDays,
        streakIncreased: streak.streakDays !== streak.previousStreakDays,
        streakBonus: streak.streakBonus,
        dailySpeakCount:
          (updated as typeof updated & { dailySpeakCount?: number })
            .dailySpeakCount ??
          dailySpeakCount + 1,
        balances: this.toBalances(updated),
        isDailyMission: false,
        alreadyClaimed: false,
      };
    });
  }

  async applyMiniGameRewards(params: {
    userId: string;
    gameId: string;
  }): Promise<{
    xpEarned: number;
    seedsEarned: number;
    balances: UserBalances;
    alreadyClaimed: boolean;
    streakDays: number;
    previousStreakDays: number;
    streakIncreased: boolean;
    streakBonus?: StreakBonus;
  }> {
    const { userId, gameId } = params;
    const referenceId = `mini_game:${gameId}`;

    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.economyTransaction.findFirst({
        where: {
          userId,
          source: 'mini_game_reward',
          referenceId,
          currency: Currency.XP,
        },
      });

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const local = getUserLocalTime(user.timezone);
      const todayKey = local.dateKey;
      const streak = await this.applyStreakAndMilestone(tx, user, todayKey);

      if (prior) {
        const streakOnly = await tx.user.update({
          where: { id: userId },
          data: {
            ...streak.userUpdate,
            ...(streak.milestoneSeeds > 0
              ? { bananaSeedBalance: { increment: streak.milestoneSeeds } }
              : {}),
          },
        });
        return {
          xpEarned: 0,
          seedsEarned: streak.milestoneSeeds,
          balances: this.toBalances(streakOnly),
          alreadyClaimed: true,
          streakDays: streakOnly.streakDays,
          previousStreakDays: streak.previousStreakDays,
          streakIncreased: streak.streakDays !== streak.previousStreakDays,
          streakBonus: streak.streakBonus,
        };
      }

      const xpEarned = LESSON_REWARD_XP;
      const seedsEarned = LESSON_REWARD_SEEDS + streak.milestoneSeeds;

      await this.recordTransaction(tx, {
        userId,
        currency: Currency.XP,
        amount: xpEarned,
        source: 'mini_game_reward',
        referenceId,
      });
      await this.recordTransaction(tx, {
        userId,
        currency: Currency.BANANA_SEED,
        amount: LESSON_REWARD_SEEDS,
        source: 'mini_game_reward',
        referenceId,
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...streak.userUpdate,
          xpBalance: { increment: xpEarned },
          bananaSeedBalance: { increment: seedsEarned },
        },
      });

      return {
        xpEarned,
        seedsEarned,
        balances: this.toBalances(updated),
        alreadyClaimed: false,
        streakDays: updated.streakDays,
        previousStreakDays: streak.previousStreakDays,
        streakIncreased: streak.streakDays !== streak.previousStreakDays,
        streakBonus: streak.streakBonus,
      };
    });
  }

  /** Record a qualifying play day for streak (mini-games, etc.). */
  async recordStreakActivity(userId: string): Promise<{
    streakDays: number;
    previousStreakDays: number;
    streakIncreased: boolean;
    streakBonus?: StreakBonus;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const local = getUserLocalTime(user.timezone);
      const todayKey = local.dateKey;
      const streak = await this.applyStreakAndMilestone(tx, user, todayKey);

      await tx.user.update({
        where: { id: userId },
        data: {
          ...streak.userUpdate,
          ...(streak.milestoneSeeds > 0
            ? { bananaSeedBalance: { increment: streak.milestoneSeeds } }
            : {}),
        },
      });

      return {
        streakDays: streak.streakDays,
        previousStreakDays: streak.previousStreakDays,
        streakIncreased: streak.streakDays !== streak.previousStreakDays,
        streakBonus: streak.streakBonus,
      };
    });
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
