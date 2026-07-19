import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ActivityDaysResponse,
  ActivityItemResponse,
  ActivityListResponse,
} from '../common/api.types';
import { getStarRating } from '../economy/economy.constants';
import { PrismaService } from '../prisma/prisma.service';
import { getSeriesForSimulation } from '../series/series.data';
import { getSimulation } from '../simulations/simulations.data';

/** Short English titles for Journey activity cards. */
const ACTIVITY_TITLE_EN: Record<string, string> = {
  coffee_order_easy: 'Order Coffee',
  restaurant_order_easy: 'Order at a Restaurant',
  movie_tickets_easy: 'Buy Movie Tickets',
  hotel_checkin_easy: 'Hotel Check-in',
  taxi_ride_easy: 'Take a Taxi',
  airport_checkin_easy: 'Airport Check-in',
  meet_client_easy: 'Meet a Client',
  business_meeting_easy: 'Schedule a Meeting',
  business_phone_easy: 'Business Phone Call',
  pharmacy_easy: 'At the Pharmacy',
  doctor_visit_easy: 'Visit a Doctor',
  ask_help_easy: 'Ask for Help',
};

type StoredReportJson = {
  feedbackEn?: string;
  feedbackTh?: string;
  bestSentenceEn?: string;
  bestSentenceNoteTh?: string;
  grammarTip?: string;
  grammarTipTh?: string;
  vocab?: unknown[];
  pronunciationIssues?: unknown[];
  missionTitleTh?: string;
  topicId?: string;
  checkpointSummary?: Record<string, boolean>;
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  toActivityItem(session: {
    id: string;
    simulationId: string | null;
    completedAt: Date | null;
    overallScore: number | null;
    scoreLabel: string | null;
    xpEarned: number | null;
    seedsEarned: number | null;
  }): ActivityItemResponse | null {
    if (!session.simulationId || !session.completedAt) return null;

    const simulation = getSimulation(session.simulationId);
    const series = getSeriesForSimulation(session.simulationId);
    if (!simulation || !series) return null;

    const score = session.overallScore ?? 0;
    return {
      sessionId: session.id,
      simulationId: session.simulationId,
      seriesId: series.seriesId,
      seriesTitleEn: series.titleEn,
      seriesTitleTh: series.titleTh,
      titleEn:
        ACTIVITY_TITLE_EN[session.simulationId] ??
        simulation.missionTitleTh,
      titleTh: simulation.missionTitleTh,
      coverImage: series.coverImage,
      completedAt: session.completedAt.toISOString(),
      overallScore: score,
      scoreLabel: session.scoreLabel ?? '',
      starRating: getStarRating(score),
      xpEarned: session.xpEarned ?? 0,
      seedsEarned: session.seedsEarned ?? 0,
    };
  }

  async listActivity(
    userId: string,
    options: {
      limit?: number;
      cursor?: string;
      date?: string;
      simulationId?: string;
    } = {},
  ): Promise<ActivityListResponse> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

    const and: Prisma.UserSessionWhereInput[] = [
      {
        userId,
        rewardsApplied: true,
        simulationId: options.simulationId
          ? options.simulationId
          : { not: null },
        sessionType: 'simulation',
      },
    ];

    if (options.date) {
      const dayStart = new Date(`${options.date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      and.push({
        completedAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      });
    } else {
      and.push({ completedAt: { not: null } });
    }

    if (options.cursor) {
      const cursorSession = await this.prisma.userSession.findUnique({
        where: { id: options.cursor },
      });
      if (cursorSession?.completedAt) {
        and.push({
          OR: [
            { completedAt: { lt: cursorSession.completedAt } },
            {
              completedAt: cursorSession.completedAt,
              id: { lt: cursorSession.id },
            },
          ],
        });
      }
    }

    const rows = await this.prisma.userSession.findMany({
      where: { AND: and },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page
      .map((row) => this.toActivityItem(row))
      .filter((item): item is ActivityItemResponse => item != null);

    return {
      items,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  }

  async listActivityDays(
    userId: string,
    year: number,
    month: number,
  ): Promise<ActivityDaysResponse> {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const rows = await this.prisma.userSession.findMany({
      where: {
        userId,
        rewardsApplied: true,
        completedAt: {
          gte: start,
          lt: end,
        },
        simulationId: { not: null },
        sessionType: 'simulation',
      },
      select: { completedAt: true },
    });

    const dates = new Set<string>();
    for (const row of rows) {
      if (!row.completedAt) continue;
      dates.add(row.completedAt.toISOString().slice(0, 10));
    }

    return { dates: [...dates].sort() };
  }

  parseStoredReport(reportJson: Prisma.JsonValue | null): StoredReportJson {
    if (!reportJson || typeof reportJson !== 'object' || Array.isArray(reportJson)) {
      return {};
    }
    return reportJson as StoredReportJson;
  }
}
