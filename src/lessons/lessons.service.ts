import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LESSON_BANANA_COST,
  LESSON_PROGRESSION_ORDER,
  LessonConfig,
  getAllLessons,
  getLesson,
} from './lessons.data';
import {
  LESSON_REWARD_SEEDS,
  LESSON_REWARD_XP,
} from '../economy/economy.constants';

export type LessonProgressStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'completed';

export interface LessonProgressItemView {
  lessonId: string;
  order: number;
  titleEn: string;
  titleTh: string;
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
  status: LessonProgressStatus;
  isPlayable: true;
}

export interface LessonProgressView {
  bananaCost: number;
  lessonReward: { xp: number; seeds: number };
  completedCount: number;
  totalPlayable: number;
  currentLessonId: string | null;
  /** Most recently started training lesson (any completion state). */
  lastStudiedLessonId: string | null;
  lessons: LessonProgressItemView[];
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompletedLessonIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.userSession.findMany({
      where: {
        userId,
        sessionType: 'training',
        lessonId: { not: null },
        rewardsApplied: true,
      },
      select: { lessonId: true },
      distinct: ['lessonId'],
    });

    return new Set(
      rows
        .map((row) => row.lessonId)
        .filter((lessonId): lessonId is string => lessonId != null),
    );
  }

  /** Latest training session's lesson — used to resume Continue strips. */
  async getLastStudiedLessonId(userId: string): Promise<string | null> {
    const row = await this.prisma.userSession.findFirst({
      where: {
        userId,
        sessionType: 'training',
        lessonId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { lessonId: true },
    });
    return row?.lessonId ?? null;
  }

  isLessonUnlocked(lessonId: string): boolean {
    return LESSON_PROGRESSION_ORDER.includes(lessonId);
  }

  private resolveStatus(
    lessonId: string,
    completedIds: Set<string>,
    currentLessonId: string | null,
  ): LessonProgressStatus {
    if (completedIds.has(lessonId)) {
      return 'completed';
    }
    if (lessonId === currentLessonId) {
      return 'in_progress';
    }
    return 'available';
  }

  /**
   * Resume the last studied lesson when still incomplete; otherwise the first
   * incomplete lesson in catalog order (skipping pronunciation — it has its
   * own Continue pointer on the client).
   */
  private resolveCurrentLessonId(
    completedIds: Set<string>,
    lastStudiedLessonId: string | null,
  ): string | null {
    if (
      lastStudiedLessonId &&
      !lastStudiedLessonId.startsWith('pron_') &&
      LESSON_PROGRESSION_ORDER.includes(lastStudiedLessonId) &&
      !completedIds.has(lastStudiedLessonId)
    ) {
      return lastStudiedLessonId;
    }
    for (const lessonId of LESSON_PROGRESSION_ORDER) {
      if (lessonId.startsWith('pron_')) continue;
      if (!completedIds.has(lessonId)) {
        return lessonId;
      }
    }
    return null;
  }

  private toItemView(
    lesson: LessonConfig,
    order: number,
    status: LessonProgressStatus,
  ): LessonProgressItemView {
    return {
      lessonId: lesson.lessonId,
      order,
      titleEn: lesson.titleEn,
      titleTh: lesson.titleTh,
      estimatedMinutesMin: lesson.estimatedMinutesMin,
      estimatedMinutesMax: lesson.estimatedMinutesMax,
      status,
      isPlayable: true,
    };
  }

  async buildProgressView(userId: string): Promise<LessonProgressView> {
    const [completedIds, lastStudiedLessonId] = await Promise.all([
      this.getCompletedLessonIds(userId),
      this.getLastStudiedLessonId(userId),
    ]);
    const currentLessonId = this.resolveCurrentLessonId(
      completedIds,
      lastStudiedLessonId,
    );
    const lessons = getAllLessons().map((lesson, index) =>
      this.toItemView(
        lesson,
        index + 1,
        this.resolveStatus(lesson.lessonId, completedIds, currentLessonId),
      ),
    );

    return {
      bananaCost: LESSON_BANANA_COST,
      lessonReward: { xp: LESSON_REWARD_XP, seeds: LESSON_REWARD_SEEDS },
      completedCount: completedIds.size,
      totalPlayable: LESSON_PROGRESSION_ORDER.length,
      currentLessonId,
      lastStudiedLessonId,
      lessons,
    };
  }

  async isLessonUnlockedForUser(
    userId: string,
    lessonId: string,
  ): Promise<boolean> {
    return getLesson(lessonId) != null;
  }

  getNextLessonIdAfter(lessonId: string): string | null {
    const index = LESSON_PROGRESSION_ORDER.indexOf(lessonId);
    if (index < 0 || index >= LESSON_PROGRESSION_ORDER.length - 1) {
      return null;
    }
    return LESSON_PROGRESSION_ORDER[index + 1];
  }
}
