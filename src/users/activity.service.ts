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
  turns?: Array<{
    speaker: 'user' | 'ai';
    textEn: string;
    textTh?: string | null;
  }>;
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  toActivityItem(session: {
    id: string;
    simulationId: string | null;
    createdAt?: Date;
    completedAt: Date | null;
    overallScore: number | null;
    scoreLabel: string | null;
    xpEarned: number | null;
    seedsEarned: number | null;
    reportJson?: Prisma.JsonValue | null;
  }): ActivityItemResponse | null {
    if (!session.simulationId) return null;

    const simulation = getSimulation(session.simulationId);
    const series = getSeriesForSimulation(session.simulationId);
    if (!simulation || !series) return null;

    const completedAt = session.completedAt ?? session.createdAt ?? null;
    if (!completedAt) return null;

    const hasDetails =
      session.overallScore != null && session.reportJson != null;
    const score = hasDetails ? (session.overallScore ?? 0) : 0;

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
      completedAt: completedAt.toISOString(),
      overallScore: score,
      scoreLabel: hasDetails ? (session.scoreLabel ?? '') : '',
      starRating: hasDetails ? getStarRating(score) : 0,
      xpEarned: hasDetails ? (session.xpEarned ?? 0) : 0,
      seedsEarned: hasDetails ? (session.seedsEarned ?? 0) : 0,
      hasDetails,
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
      // Match either completedAt or createdAt for older rows without completedAt.
      and.push({
        OR: [
          { completedAt: { gte: dayStart, lt: dayEnd } },
          {
            completedAt: null,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        ],
      });
    }

    if (options.cursor) {
      const cursorSession = await this.prisma.userSession.findUnique({
        where: { id: options.cursor },
      });
      const cursorDate =
        cursorSession?.completedAt ?? cursorSession?.createdAt ?? null;
      if (cursorSession && cursorDate) {
        and.push({
          OR: [
            { completedAt: { lt: cursorDate } },
            {
              completedAt: null,
              createdAt: { lt: cursorDate },
            },
            {
              completedAt: cursorDate,
              id: { lt: cursorSession.id },
            },
            {
              completedAt: null,
              createdAt: cursorDate,
              id: { lt: cursorSession.id },
            },
          ],
        });
      }
    }

    const rows = await this.prisma.userSession.findMany({
      where: { AND: and },
      orderBy: [
        { completedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page
      .map((row) => this.toActivityItem(row))
      .filter((item): item is ActivityItemResponse => item != null)
      // Newest first using effective completed time (fallback createdAt already applied).
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );

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
        simulationId: { not: null },
        sessionType: 'simulation',
        OR: [
          { completedAt: { gte: start, lt: end } },
          {
            completedAt: null,
            createdAt: { gte: start, lt: end },
          },
        ],
      },
      select: { completedAt: true, createdAt: true },
    });

    const dates = new Set<string>();
    for (const row of rows) {
      const at = row.completedAt ?? row.createdAt;
      dates.add(at.toISOString().slice(0, 10));
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
