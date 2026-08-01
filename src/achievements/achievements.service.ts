import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  OutfitItemView,
  getOutfitById,
  toOutfitItemView,
} from '../outfits/outfit-catalog';
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_CATEGORY_ORDER,
  ACHIEVEMENT_RARITY_ORDER,
  AchievementCategory,
  AchievementDef,
  AchievementRarity,
  getAchievementById,
  getAllAchievements,
} from './achievements.data';

/** Learner turns a mission needs before its "clean run" badges count. */
const MIN_SKILL_BADGE_TURNS = 3;

/**
 * Badges a zero-effort mission used to hand out for free. Sync re-checks these
 * so accounts that banked a wrong unlock lose it instead of keeping it forever.
 */
const REVOCABLE_ACHIEVEMENT_IDS = [
  'crystal_clear',
  'no_hint_hero',
  'english_only',
];

export interface AchievementRewardView {
  seeds: number;
  bananas: number;
  outfitId: string | null;
  outfitNameEn: string | null;
  outfitNameTh: string | null;
  outfitIconKey: string | null;
}

export interface AchievementItemView {
  achievementId: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  titleEn: string;
  titleTh: string;
  descriptionEn: string;
  descriptionTh: string;
  iconKey: string;
  target: number;
  progress: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
  isClaimed: boolean;
  claimedAt: string | null;
  reward: AchievementRewardView | null;
}

export interface AchievementsView {
  unlockedCount: number;
  totalCount: number;
  /** Unlocked badges whose reward has not been claimed yet. */
  claimableCount: number;
  items: AchievementItemView[];
  /** Newly unlocked in this sync call (empty on GET if nothing new). */
  newlyUnlocked: AchievementItemView[];
}

export interface AchievementClaimResult {
  achievementId: string;
  reward: AchievementRewardView;
  outfit: OutfitItemView | null;
  balances: { bananas: number; xp: number; seeds: number };
}

interface UnlockState {
  unlockedAt: Date;
  claimedAt: Date | null;
}

interface UserProgressSnapshot {
  onboardingCompleted: boolean;
  streakDays: number;
  streakMilestonesClaimed: number[];
  lessonCount: number;
  missionCount: number;
  anySessionCount: number;
  clearPronunciationMission: boolean;
  noHintMission: boolean;
  englishOnlyMission: boolean;
  perfectMission: boolean;
  completedSimulationIds: Set<string>;
  completedLessonIds: Set<string>;
}

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncForUser(userId: string): Promise<AchievementsView> {
    const snapshot = await this.buildSnapshot(userId);
    const existing = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const existingMap = new Set(existing.map((row) => row.achievementId));

    const toRevoke = REVOCABLE_ACHIEVEMENT_IDS.filter((achievementId) => {
      if (!existingMap.has(achievementId)) return false;
      const def = getAchievementById(achievementId);
      return def != null && this.metricProgress(def, snapshot) < def.target;
    });

    if (toRevoke.length > 0) {
      await this.prisma.userAchievement.deleteMany({
        where: { userId, achievementId: { in: toRevoke } },
      });
      for (const achievementId of toRevoke) {
        existingMap.delete(achievementId);
      }
      this.logger.log(
        `Revoked unearned achievements for ${userId}: ${toRevoke.join(', ')}`,
      );
    }

    const toUnlock: string[] = [];
    for (const def of ACHIEVEMENT_CATALOG) {
      if (existingMap.has(def.achievementId)) continue;
      const progress = this.metricProgress(def, snapshot);
      if (progress >= def.target) {
        toUnlock.push(def.achievementId);
      }
    }

    if (toUnlock.length > 0) {
      await this.prisma.userAchievement.createMany({
        data: toUnlock.map((achievementId) => ({
          userId,
          achievementId,
        })),
        skipDuplicates: true,
      });
    }

    const unlockedRows = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true, claimedAt: true },
    });
    const unlockedMap = new Map<string, UnlockState>(
      unlockedRows.map((row) => [
        row.achievementId,
        { unlockedAt: row.unlockedAt, claimedAt: row.claimedAt },
      ]),
    );

    const items = this.buildItems(snapshot, unlockedMap);
    const newlyUnlocked = items.filter(
      (item) =>
        item.isUnlocked && toUnlock.includes(item.achievementId),
    );

    return {
      unlockedCount: items.filter((i) => i.isUnlocked).length,
      totalCount: items.length,
      claimableCount: items.filter(
        (i) => i.isUnlocked && !i.isClaimed && i.reward != null,
      ).length,
      items,
      newlyUnlocked,
    };
  }

  /** Safe wrapper — never throws so session end is not blocked. */
  async syncForUserSafe(userId: string): Promise<AchievementsView | null> {
    try {
      return await this.syncForUser(userId);
    } catch (err) {
      this.logger.error(
        `Achievement sync failed for user ${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      return null;
    }
  }

  async claimReward(
    userId: string,
    achievementId: string,
  ): Promise<AchievementClaimResult> {
    const def = getAchievementById(achievementId);
    if (!def) {
      throw new NotFoundException('Unknown achievement');
    }

    const reward = this.rewardView(def);
    if (!reward) {
      throw new BadRequestException('Achievement has no reward');
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId } },
        select: { claimedAt: true },
      });
      if (!row) {
        throw new BadRequestException('Achievement is not unlocked yet');
      }
      if (row.claimedAt) {
        throw new ConflictException('Reward already claimed');
      }

      // Guards against a double tap racing two claims through at once.
      const marked = await tx.userAchievement.updateMany({
        where: { userId, achievementId, claimedAt: null },
        data: { claimedAt: new Date() },
      });
      if (marked.count === 0) {
        throw new ConflictException('Reward already claimed');
      }

      const userUpdate: Prisma.UserUpdateInput = {};
      if (reward.seeds > 0) {
        userUpdate.bananaSeedBalance = { increment: reward.seeds };
        await tx.economyTransaction.create({
          data: {
            userId,
            currency: Currency.BANANA_SEED,
            amount: reward.seeds,
            source: 'achievement_reward',
            referenceId: achievementId,
          },
        });
      }
      if (reward.bananas > 0) {
        userUpdate.bananaBalance = { increment: reward.bananas };
        await tx.economyTransaction.create({
          data: {
            userId,
            currency: Currency.BANANA,
            amount: reward.bananas,
            source: 'achievement_reward',
            referenceId: achievementId,
          },
        });
      }

      const user =
        Object.keys(userUpdate).length > 0
          ? await tx.user.update({ where: { id: userId }, data: userUpdate })
          : await tx.user.findUniqueOrThrow({ where: { id: userId } });

      let outfit: OutfitItemView | null = null;
      if (reward.outfitId) {
        const outfitDef = getOutfitById(reward.outfitId);
        if (outfitDef) {
          const owned = await tx.userOutfit.upsert({
            where: {
              userId_outfitId: { userId, outfitId: outfitDef.outfitId },
            },
            create: {
              userId,
              outfitId: outfitDef.outfitId,
              sourceAchievementId: achievementId,
            },
            update: {},
          });
          outfit = toOutfitItemView(outfitDef, owned.acquiredAt);
        }
      }

      return {
        achievementId,
        reward,
        outfit,
        balances: {
          bananas: user.bananaBalance,
          xp: user.xpBalance,
          seeds: user.bananaSeedBalance,
        },
      };
    });
  }

  private rewardView(def: AchievementDef): AchievementRewardView | null {
    const seeds = def.rewardSeeds ?? 0;
    const bananas = def.rewardBananas ?? 0;
    const outfitDef = def.rewardOutfitId
      ? getOutfitById(def.rewardOutfitId)
      : undefined;

    if (seeds === 0 && bananas === 0 && !outfitDef) {
      return null;
    }

    return {
      seeds,
      bananas,
      outfitId: outfitDef?.outfitId ?? null,
      outfitNameEn: outfitDef?.nameEn ?? null,
      outfitNameTh: outfitDef?.nameTh ?? null,
      outfitIconKey: outfitDef?.iconKey ?? null,
    };
  }

  private async buildSnapshot(userId: string): Promise<UserProgressSnapshot> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        streakDays: true,
        streakMilestonesClaimed: true,
      },
    });

    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        rewardsApplied: true,
      },
      select: {
        sessionType: true,
        lessonId: true,
        simulationId: true,
        overallScore: true,
        hintsUsed: true,
        thaiMixUsed: true,
        learnerTurnCount: true,
        reportJson: true,
      },
    });

    const lessonIds = new Set<string>();
    const simulationIds = new Set<string>();
    let anySessionCount = 0;
    let clearPronunciationMission = false;
    let noHintMission = false;
    let englishOnlyMission = false;
    let perfectMission = false;

    for (const session of sessions) {
      anySessionCount += 1;

      // Pronunciation-course lessons do not count toward learning badges /
      // Banana Graduate (separate catalog).
      if (session.lessonId && !session.lessonId.startsWith('pron_')) {
        lessonIds.add(session.lessonId);
      }
      if (session.simulationId) {
        simulationIds.add(session.simulationId);
      }

      if (session.sessionType === 'simulation') {
        const score = session.overallScore ?? 0;
        if (score >= 100) perfectMission = true;

        // A mission the learner barely spoke in has nothing to be clean about:
        // no words to mispronounce, no hints opened, no Thai Mix. Without this
        // guard, quitting a mission early earns three skill badges at once.
        const learnerTurns =
          session.learnerTurnCount ??
          this.countLearnerTurns(session.reportJson);
        const spoke = learnerTurns >= MIN_SKILL_BADGE_TURNS;

        if (spoke && this.hasNoPronunciationIssues(session.reportJson)) {
          clearPronunciationMission = true;
        }

        // Only count tracked sessions (null = pre-achievements / unknown).
        if (spoke && session.hintsUsed === 0) {
          noHintMission = true;
        }
        if (spoke && session.thaiMixUsed === false) {
          englishOnlyMission = true;
        }
      }
    }

    // Onboarding counts as First Hello / first conversation progress.
    if (user.onboardingCompleted && anySessionCount === 0) {
      anySessionCount = 1;
    }

    return {
      onboardingCompleted: user.onboardingCompleted,
      streakDays: user.streakDays,
      streakMilestonesClaimed: user.streakMilestonesClaimed,
      lessonCount: lessonIds.size,
      missionCount: simulationIds.size,
      anySessionCount,
      clearPronunciationMission,
      noHintMission,
      englishOnlyMission,
      perfectMission,
      completedSimulationIds: simulationIds,
      completedLessonIds: lessonIds,
    };
  }

  private metricProgress(
    def: AchievementDef,
    snapshot: UserProgressSnapshot,
  ): number {
    switch (def.metric) {
      case 'onboarding_completed':
        return snapshot.onboardingCompleted ? 1 : 0;
      case 'any_session_count':
        return snapshot.anySessionCount;
      case 'mission_count':
        return snapshot.missionCount;
      case 'lesson_count':
        return snapshot.lessonCount;
      case 'streak_days': {
        // Persist unlocks via streakMilestonesClaimed + current streak so
        // a reset streak does not lose already-earned badges on re-sync.
        const claimed = snapshot.streakMilestonesClaimed.includes(def.target)
          ? def.target
          : 0;
        return Math.max(snapshot.streakDays, claimed);
      }
      case 'clear_pronunciation_mission':
        return snapshot.clearPronunciationMission ? 1 : 0;
      case 'no_hint_mission':
        return snapshot.noHintMission ? 1 : 0;
      case 'english_only_mission':
        return snapshot.englishOnlyMission ? 1 : 0;
      case 'perfect_mission':
        return snapshot.perfectMission ? 1 : 0;
      case 'simulation_completed': {
        const ids = def.matchIds ?? [];
        return ids.some((id) => snapshot.completedSimulationIds.has(id))
          ? 1
          : 0;
      }
      case 'all_simulations_completed': {
        const ids = def.matchIds ?? [];
        return ids.filter((id) => snapshot.completedSimulationIds.has(id))
          .length;
      }
      case 'all_lessons_completed': {
        const ids = def.matchIds ?? [];
        return ids.filter((id) => snapshot.completedLessonIds.has(id)).length;
      }
      default:
        return 0;
    }
  }

  /** Learner turns for sessions saved before the column existed. */
  private countLearnerTurns(reportJson: unknown): number {
    if (
      reportJson == null ||
      typeof reportJson !== 'object' ||
      Array.isArray(reportJson)
    ) {
      return 0;
    }

    const turns = (reportJson as Record<string, unknown>).turns;
    if (!Array.isArray(turns)) return 0;

    return (turns as unknown[]).filter((turn) => {
      if (turn == null || typeof turn !== 'object') return false;
      return (turn as Record<string, unknown>).speaker === 'user';
    }).length;
  }

  private hasNoPronunciationIssues(reportJson: unknown): boolean {
    if (
      reportJson == null ||
      typeof reportJson !== 'object' ||
      Array.isArray(reportJson)
    ) {
      return false;
    }

    const pronunciationIssues = (
      reportJson as Record<string, unknown>
    ).pronunciationIssues;
    return Array.isArray(pronunciationIssues) && pronunciationIssues.length === 0;
  }

  private buildItems(
    snapshot: UserProgressSnapshot,
    unlockedMap: Map<string, UnlockState>,
  ): AchievementItemView[] {
    const items = getAllAchievements().map((def) => {
      const rawProgress = this.metricProgress(def, snapshot);
      const state = unlockedMap.get(def.achievementId);
      const isUnlocked = state != null;
      const progress = isUnlocked
        ? def.target
        : Math.min(rawProgress, def.target);

      return {
        achievementId: def.achievementId,
        category: def.category,
        rarity: def.rarity,
        titleEn: def.titleEn,
        titleTh: def.titleTh,
        descriptionEn: def.descriptionEn,
        descriptionTh: def.descriptionTh,
        iconKey: def.iconKey,
        target: def.target,
        progress,
        isUnlocked,
        unlockedAt: state ? state.unlockedAt.toISOString() : null,
        isClaimed: state?.claimedAt != null,
        claimedAt: state?.claimedAt ? state.claimedAt.toISOString() : null,
        reward: this.rewardView(def),
      };
    });

    return items.sort((a, b) => {
      const cat =
        ACHIEVEMENT_CATEGORY_ORDER.indexOf(a.category) -
        ACHIEVEMENT_CATEGORY_ORDER.indexOf(b.category);
      if (cat !== 0) return cat;
      return (
        ACHIEVEMENT_RARITY_ORDER.indexOf(a.rarity) -
        ACHIEVEMENT_RARITY_ORDER.indexOf(b.rarity)
      );
    });
  }
}
