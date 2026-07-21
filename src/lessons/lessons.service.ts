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

  isLessonUnlocked(
    lessonId: string,
    completedIds: Set<string>,
  ): boolean {
    const index = LESSON_PROGRESSION_ORDER.indexOf(lessonId);
    if (index < 0) {
      return false;
    }
    if (index === 0) {
      return true;
    }

    const previousLessonId = LESSON_PROGRESSION_ORDER[index - 1];
    return completedIds.has(previousLessonId);
  }

  private resolveStatus(
    lessonId: string,
    completedIds: Set<string>,
    currentLessonId: string | null,
  ): LessonProgressStatus {
    if (completedIds.has(lessonId)) {
      return 'completed';
    }
    if (!this.isLessonUnlocked(lessonId, completedIds)) {
      return 'locked';
    }
    if (lessonId === currentLessonId) {
      return 'in_progress';
    }
    return 'available';
  }

  private resolveCurrentLessonId(completedIds: Set<string>): string | null {
    for (const lessonId of LESSON_PROGRESSION_ORDER) {
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
    const completedIds = await this.getCompletedLessonIds(userId);
    const currentLessonId = this.resolveCurrentLessonId(completedIds);
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
      lessons,
    };
  }

  async isLessonUnlockedForUser(
    userId: string,
    lessonId: string,
  ): Promise<boolean> {
    if (!getLesson(lessonId)) {
      return false;
    }
    const completedIds = await this.getCompletedLessonIds(userId);
    return this.isLessonUnlocked(lessonId, completedIds);
  }

  getNextLessonIdAfter(lessonId: string): string | null {
    const index = LESSON_PROGRESSION_ORDER.indexOf(lessonId);
    if (index < 0 || index >= LESSON_PROGRESSION_ORDER.length - 1) {
      return null;
    }
    return LESSON_PROGRESSION_ORDER[index + 1];
  }
}
