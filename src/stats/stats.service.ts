import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  LearningStatsResponse,
  PublicMarketingStatsResponse,
} from '../common/api.types';
import { getLesson } from '../lessons/lessons.data';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../users/activity.service';

type PublicCache = { expiresAt: number; payload: PublicMarketingStatsResponse };

@Injectable()
export class StatsService {
  private publicCache: PublicCache | null = null;
  private readonly publicTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async getPublicMarketingStats(): Promise<PublicMarketingStatsResponse> {
    const hit = this.publicCache;
    if (hit && hit.expiresAt > Date.now()) {
      return hit.payload;
    }

    const completed = { completedAt: { not: null } } as const;
    const [learners, turnSum, durationSum, legacySessions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.userSession.aggregate({
        where: { ...completed, learnerTurnCount: { not: null } },
        _sum: { learnerTurnCount: true },
      }),
      this.prisma.userSession.aggregate({
        where: completed,
        _sum: { durationSeconds: true },
      }),
      this.prisma.userSession.count({
        where: { ...completed, learnerTurnCount: null },
      }),
    ]);

    const payload: PublicMarketingStatsResponse = {
      learners,
      speakingTurns: (turnSum._sum.learnerTurnCount ?? 0) + legacySessions,
      minutesPracticed: Math.round((durationSum._sum.durationSeconds ?? 0) / 60),
    };
    this.publicCache = { expiresAt: Date.now() + this.publicTtlMs, payload };
    return payload;
  }

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
