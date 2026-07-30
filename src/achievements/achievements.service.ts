import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_CATEGORY_ORDER,
  ACHIEVEMENT_RARITY_ORDER,
  AchievementCategory,
  AchievementDef,
  AchievementRarity,
  getAllAchievements,
} from './achievements.data';

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
}

export interface AchievementsView {
  unlockedCount: number;
  totalCount: number;
  items: AchievementItemView[];
  /** Newly unlocked in this sync call (empty on GET if nothing new). */
  newlyUnlocked: AchievementItemView[];
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
}

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncForUser(userId: string): Promise<AchievementsView> {
    const snapshot = await this.buildSnapshot(userId);
    const existing = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true },
    });
    const existingMap = new Map(
      existing.map((row) => [row.achievementId, row.unlockedAt]),
    );

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
      select: { achievementId: true, unlockedAt: true },
    });
    const unlockedMap = new Map(
      unlockedRows.map((row) => [row.achievementId, row.unlockedAt]),
    );

    const items = this.buildItems(snapshot, unlockedMap);
    const newlyUnlocked = items.filter(
      (item) =>
        item.isUnlocked && toUnlock.includes(item.achievementId),
    );

    return {
      unlockedCount: items.filter((i) => i.isUnlocked).length,
      totalCount: items.length,
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

      if (session.lessonId) {
        lessonIds.add(session.lessonId);
      }
      if (session.simulationId) {
        simulationIds.add(session.simulationId);
      }

      if (session.sessionType === 'simulation') {
        const score = session.overallScore ?? 0;
        if (score >= 100) perfectMission = true;
        if (this.hasNoPronunciationIssues(session.reportJson)) {
          clearPronunciationMission = true;
        }

        // Only count tracked sessions (null = pre-achievements / unknown).
        if (session.hintsUsed != null && session.hintsUsed === 0) {
          noHintMission = true;
        }
        if (session.thaiMixUsed != null && session.thaiMixUsed === false) {
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
      default:
        return 0;
    }
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
    unlockedMap: Map<string, Date>,
  ): AchievementItemView[] {
    const items = getAllAchievements().map((def) => {
      const rawProgress = this.metricProgress(def, snapshot);
      const isUnlocked = unlockedMap.has(def.achievementId);
      const progress = isUnlocked
        ? def.target
        : Math.min(rawProgress, def.target);
      const unlockedAt = unlockedMap.get(def.achievementId);

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
        unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
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
