import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LearningStatsResponse } from '../common/api.types';
import { getLesson } from '../lessons/lessons.data';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../users/activity.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async getLearningStats(userId: string): Promise<LearningStatsResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        streakDays: true,
        longestStreakDays: true,
      },
    });

    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        completedAt: { not: null },
      },
      select: {
        sessionType: true,
        lessonId: true,
        rewardsApplied: true,
        durationSeconds: true,
        learnerTurnCount: true,
        reportJson: true,
      },
    });

    const lessonIds = new Set<string>();
    let sentencesSpoken = 0;
    let durationSecondsTotal = 0;

    for (const session of sessions) {
      if (
        session.sessionType === 'training' &&
        session.rewardsApplied &&
        session.lessonId
      ) {
        lessonIds.add(session.lessonId);
      }

      if (session.learnerTurnCount != null) {
        sentencesSpoken += session.learnerTurnCount;
      } else {
        sentencesSpoken += this.countUserTurns(session.reportJson);
      }

      if (session.durationSeconds != null) {
        durationSecondsTotal += session.durationSeconds;
      } else if (
        session.sessionType === 'training' &&
        session.lessonId &&
        session.rewardsApplied
      ) {
        const lesson = getLesson(session.lessonId);
        if (lesson) {
          // Approximate legacy lesson sessions that never stored duration.
          durationSecondsTotal += lesson.estimatedMinutesMin * 60;
        }
      }
    }

    return {
      lessonsCompleted: lessonIds.size,
      sentencesSpoken,
      minutesPracticed: Math.round(durationSecondsTotal / 60),
      longestStreakDays: Math.max(user.longestStreakDays, user.streakDays),
    };
  }

  private countUserTurns(reportJson: Prisma.JsonValue | null): number {
    const report = this.activity.parseStoredReport(reportJson);
    if (!report.turns?.length) return 0;
    return report.turns.filter((t) => t.speaker === 'user').length;
  }
}
