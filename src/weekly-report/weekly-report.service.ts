import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { parseDateKey } from '../common/timezone.util';
import { FcmService } from '../notifications/fcm.service';
import { PrismaService } from '../prisma/prisma.service';
import { composeForSpeak, composeIdle, rememberTemplateIds } from './weekly-report.copy';
import {
  buildAddons,
  dateLabel,
  emptyStats,
  notificationData,
  remainingChapter,
  reportRoute,
} from './weekly-report.helpers';
import { daysBetweenDateKeys, decideSend, pickHighestAddon, positiveDelta } from './weekly-report.rules';
import type {
  WeeklyReportLocale,
  WeeklyReportPayload,
  WeeklySpeakSegment,
  WeeklyStats,
} from './weekly-report.types';
import {
  WEEKLY_GONE_DAYS,
  WEEKLY_JOB_BATCH,
  WEEKLY_REPORT_KEEP_WEEKS,
  WEEKLY_REPORT_TYPE,
  activeDaysBits,
  dateKeyFromUtcDate,
  isSundayEvening,
  previousWeekKey,
  utcDaysCovering,
  weekWindow,
} from './weekly-report.week';

const INTERVIEW_IDS = [
  'final_interview_john',
  'final_interview_minnie',
  'final_interview_nina',
];

type JobUser = {
  id: string;
  timezone: string;
  createdAt: Date;
  lastAppOpenDate: Date | null;
  contentLocale: string;
  weeklyReportTemplateIds: string[];
  appVersion: string | null;
  displayName: string | null;
  streakDays: number;
  longestStreakDays: number;
  lastStudiedLessonId: string | null;
  lastPlacementTestAt: Date | null;
  placementResult: Prisma.JsonValue | null;
  selfReportedEnglishLevel: string | null;
  fcmTokens: Array<{ token: string }>;
};

@Injectable()
export class WeeklyReportService {
  private readonly logger = new Logger(WeeklyReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  @Cron('*/15 * * * *')
  async runSundayJob(now = new Date()): Promise<number> {
    try {
      return await this.processSundayJob(now);
    } catch (error) {
      this.logger.error(`Weekly report job failed: ${String(error)}`);
      return 0;
    }
  }

  async processSundayJob(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - WEEKLY_GONE_DAYS * 86400000);
    const createdSince = new Date(now.getTime() - 8 * 86400000);
    let sent = 0;
    let cursor: string | undefined;
    const weekKey = weekWindow('Asia/Bangkok', now).weekKey;
    const ranks = await this.wordCardsRanks(weekKey);

    while (true) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { lastAppOpenDate: { gte: cutoff } },
            { createdAt: { gte: createdSince } },
          ],
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: WEEKLY_JOB_BATCH,
        select: {
          id: true,
          timezone: true,
          createdAt: true,
          lastAppOpenDate: true,
          contentLocale: true,
          weeklyReportTemplateIds: true,
          appVersion: true,
          displayName: true,
          streakDays: true,
          longestStreakDays: true,
          lastStudiedLessonId: true,
          lastPlacementTestAt: true,
          placementResult: true,
          selfReportedEnglishLevel: true,
          fcmTokens: { select: { token: true } },
        },
      });
      if (users.length === 0) break;
      cursor = users[users.length - 1]!.id;
      const due = users.filter((user) => isSundayEvening(user.timezone, now));
      if (due.length > 0) {
        sent += await this.processBatch(due, now, ranks);
      }
      if (users.length < WEEKLY_JOB_BATCH) break;
    }

    const keepFrom = new Date(now.getTime() - WEEKLY_REPORT_KEEP_WEEKS * 7 * 86400000);
    await this.prisma.weeklyReportSnapshot.deleteMany({
      where: { createdAt: { lt: keepFrom } },
    });
    return sent;
  }

  async getSnapshot(userId: string, weekKey: string) {
    const row = await this.prisma.weeklyReportSnapshot.findUnique({
      where: { userId_weekKey: { userId, weekKey } },
    });
    if (!row) throw new NotFoundException('Weekly report not found');
    return {
      weekKey: row.weekKey,
      segment: row.segment,
      templateId: row.templateId,
      locale: row.locale,
      title: row.title,
      body: row.body,
      payload: row.payload,
    };
  }

  async hasWeeklyReportOn(userId: string, dateKey: string): Promise<boolean> {
    const row = await this.prisma.notificationLog.findUnique({
      where: {
        userId_type_sentOn: {
          userId,
          type: WEEKLY_REPORT_TYPE,
          sentOn: parseDateKey(dateKey),
        },
      },
    });
    return Boolean(row);
  }

  private async processBatch(
    users: JobUser[],
    now: Date,
    ranks: Map<string, number>,
  ): Promise<number> {
    const ids = users.map((user) => user.id);
    const byTz = new Map<string, JobUser[]>();
    for (const user of users) {
      const list = byTz.get(user.timezone) ?? [];
      list.push(user);
      byTz.set(user.timezone, list);
    }

    const already = await this.prisma.notificationLog.findMany({
      where: {
        userId: { in: ids },
        type: WEEKLY_REPORT_TYPE,
        sentOn: {
          in: [...new Set(users.map((user) => weekWindow(user.timezone, now).sundayDateKey))].map(
            (key) => parseDateKey(key),
          ),
        },
      },
      select: { userId: true },
    });
    const sentIds = new Set(already.map((row) => row.userId));
    const pending = users.filter((user) => !sentIds.has(user.id));
    if (pending.length === 0) return 0;

    const windows = pending.map((user) => ({
      user,
      window: weekWindow(user.timezone, now),
    }));
    const minStart = new Date(
      Math.min(...windows.map((row) => row.window.startUtc.getTime())) - 86400000,
    );
    const maxEnd = new Date(
      Math.max(...windows.map((row) => row.window.endUtc.getTime())) + 86400000,
    );
    const utcDays = [
      ...new Set(windows.flatMap((row) => utcDaysCovering(row.window.dateKeys).map((d) => d.getTime()))),
    ].map((ms) => new Date(ms));

    const [
      spokenRows,
      activeRows,
      sessions,
      wordAttempts,
      stars,
      badges,
      interviews,
      prevSnaps,
      recentWeekly,
      prevLogs,
    ] = await Promise.all([
      this.prisma.userSpokenDay.findMany({
        where: { userId: { in: pending.map((u) => u.id) }, day: { in: utcDays } },
      }),
      this.prisma.userActiveDay.findMany({
        where: { userId: { in: pending.map((u) => u.id) }, day: { in: utcDays } },
      }),
      this.prisma.userSession.findMany({
        where: {
          userId: { in: pending.map((u) => u.id) },
          completedAt: { gte: minStart, lt: maxEnd },
        },
        select: {
          userId: true,
          completedAt: true,
          durationSeconds: true,
          learnerTurnCount: true,
          lessonId: true,
        },
      }),
      this.prisma.miniGameScoreAttempt.findMany({
        where: {
          userId: { in: pending.map((u) => u.id) },
          kind: 'new_words',
          createdAt: { gte: minStart, lt: maxEnd },
        },
        select: { userId: true, totalCount: true, createdAt: true },
      }),
      this.prisma.userPerfectStar.findMany({
        where: {
          userId: { in: pending.map((u) => u.id) },
          createdAt: { gte: minStart, lt: maxEnd },
        },
        select: { userId: true, createdAt: true },
      }),
      this.prisma.userAchievement.findMany({
        where: {
          userId: { in: pending.map((u) => u.id) },
          unlockedAt: { gte: minStart, lt: maxEnd },
        },
        select: { userId: true, achievementId: true, unlockedAt: true },
      }),
      this.prisma.interactiveScenarioProgress.findMany({
        where: {
          userId: { in: pending.map((u) => u.id) },
          scenarioId: { in: INTERVIEW_IDS },
          finishedAt: { gte: minStart, lt: maxEnd },
        },
        select: { userId: true, scenarioId: true, finishedAt: true },
      }),
      this.prisma.weeklyReportSnapshot.findMany({
        where: {
          userId: { in: pending.map((u) => u.id) },
          weekKey: { in: [...new Set(windows.map((row) => previousWeekKey(row.window.weekKey)))] },
        },
      }),
      this.prisma.userNotification.findMany({
        where: {
          userId: { in: pending.map((u) => u.id) },
          type: WEEKLY_REPORT_TYPE,
          sentAt: { gte: new Date(now.getTime() - 30 * 86400000) },
        },
        select: { userId: true, data: true, sentAt: true },
      }),
      this.prisma.notificationLog.findMany({
        where: {
          userId: { in: pending.map((u) => u.id) },
          type: WEEKLY_REPORT_TYPE,
          sentOn: {
            gte: new Date(now.getTime() - 21 * 86400000),
            lt: new Date(now.getTime() - 2 * 86400000),
          },
        },
        select: { userId: true, sentOn: true },
      }),
    ]);

    const spokenBy = groupBy(spokenRows, (row) => row.userId);
    const activeBy = groupBy(activeRows, (row) => row.userId);
    const sessionsBy = groupBy(sessions, (row) => row.userId);
    const wordsBy = groupBy(wordAttempts, (row) => row.userId);
    const starsBy = groupBy(stars, (row) => row.userId);
    const badgesBy = groupBy(badges, (row) => row.userId);
    const interviewsBy = groupBy(interviews, (row) => row.userId);
    const prevSnapBy = new Map(prevSnaps.map((row) => [`${row.userId}:${row.weekKey}`, row]));
    const weeklyNotifsBy = groupBy(recentWeekly, (row) => row.userId);
    const prevLogsBy = groupBy(prevLogs, (row) => row.userId);
    const prevSnapExists = new Set(prevSnaps.map((row) => `${row.userId}:${row.weekKey}`));

    let sent = 0;
    for (const { user, window } of windows) {
      const stats = this.statsForUser({
        user,
        window,
        spoken: spokenBy.get(user.id) ?? [],
        active: activeBy.get(user.id) ?? [],
        sessions: sessionsBy.get(user.id) ?? [],
        words: wordsBy.get(user.id) ?? [],
        stars: starsBy.get(user.id) ?? [],
        badges: badgesBy.get(user.id) ?? [],
        interviews: interviewsBy.get(user.id) ?? [],
        rank: ranks.get(user.id),
      });
      const lastOpenKey = user.lastAppOpenDate
        ? dateKeyFromUtcDate(user.lastAppOpenDate)
        : null;
      const daysSinceLastOpen = lastOpenKey
        ? daysBetweenDateKeys(window.sundayDateKey, lastOpenKey)
        : null;
      const createdKey = dateKeyFromUtcDate(user.createdAt);
      const createdThisWeek = window.dateKeys.includes(createdKey);
      const prevKey = previousWeekKey(window.weekKey);
      const prev2Key = previousWeekKey(prevKey);
      const userPrevLogs = prevLogsBy.get(user.id) ?? [];
      let consecutiveIdleWeeks = 0;
      if (!prevSnapExists.has(`${user.id}:${prevKey}`) && userPrevLogs.length > 0) {
        consecutiveIdleWeeks = 1;
        if (!prevSnapExists.has(`${user.id}:${prev2Key}`) && userPrevLogs.length > 1) {
          consecutiveIdleWeeks = 2;
        }
      }
      const decision = decideSend({
        sentences: stats.sentences,
        activeDays: stats.activeDayCount,
        words: stats.words,
        daysSinceLastOpen,
        createdThisWeek,
        consecutiveIdleWeeks,
      });
      if (!decision.send) continue;

      const locale: WeeklyReportLocale = user.contentLocale === 'en' ? 'en' : 'th';
      const chapter = remainingChapter(user.lastStudiedLessonId);
      if (chapter) {
        stats.chapter = chapter.chapter;
        stats.chapterName = locale === 'en' ? chapter.chapterNameEn : chapter.chapterNameTh;
        stats.chapterProgress = chapter.progress;
        stats.remainingLessons = chapter.remaining;
        stats.chapterComplete = chapter.complete;
      }

      const prevSnap = prevSnapBy.get(`${user.id}:${prevKey}`);
      const prevPayload = (prevSnap?.payload ?? null) as WeeklyReportPayload | null;
      const firstWeek = decision.segment === 'first_week';
      const payload: WeeklyReportPayload = {
        ...stats,
        weekKey: window.weekKey,
        dateLabel: dateLabel(window.dateKeys, locale),
        displayName: user.displayName?.trim() || (locale === 'en' ? 'friend' : 'เพื่อน'),
        languageLevel: user.selfReportedEnglishLevel,
        firstWeek,
        compare: Boolean(prevPayload) && !firstWeek,
        deltas: {
          minutes: prevPayload ? positiveDelta(stats.minutes, prevPayload.minutes) : 0,
          speakSessions: prevPayload
            ? positiveDelta(stats.speakSessions, prevPayload.speakSessions)
            : 0,
          words: prevPayload ? positiveDelta(stats.words, prevPayload.words) : 0,
          lessonsCompleted: prevPayload
            ? positiveDelta(stats.lessonsCompleted, prevPayload.lessonsCompleted)
            : 0,
        },
      };

      const recentIds = [
        ...user.weeklyReportTemplateIds,
        ...(weeklyNotifsBy.get(user.id) ?? []).flatMap((row) => pieceIdsFromData(row.data)),
      ];
      const idle01Blocked = (weeklyNotifsBy.get(user.id) ?? []).some((row) =>
        pieceIdsFromData(row.data).includes('idle_01'),
      );
      const prevActiveDays =
        typeof prevPayload?.activeDayCount === 'number' ? prevPayload.activeDayCount : 0;
      const addon = pickHighestAddon(stats.addons);
      const vars = {
        n: stats.sentences,
        w: stats.words,
        d: stats.activeDayCount,
        k: starsBy.get(user.id)?.length ?? 0,
        s: user.streakDays,
        r: stats.rank,
        x: stats.remainingLessons,
        game: stats.game,
        chapter: stats.chapterName,
        ...addon?.vars,
      };

      const copy =
        decision.speak === 'idle'
          ? composeIdle({
              locale,
              vars,
              recentIds,
              consecutiveIdleWeeks,
              previousActiveDays: prevActiveDays,
              idle01Blocked,
            })
          : composeForSpeak({
              speak: decision.speak as WeeklySpeakSegment,
              locale,
              firstWeek,
              vars,
              addon,
              recentIds,
            });

      const logged = await this.tryLog(user.id, window.sundayDateKey);
      if (!logged) continue;

      const isIdle = decision.segment === 'idle';
      const route = isIdle
        ? 'cta' in copy && copy.cta === 'games'
          ? '/games'
          : '/train'
        : reportRoute(window.weekKey, user.appVersion);

      if (!isIdle) {
        await this.prisma.weeklyReportSnapshot.create({
          data: {
            userId: user.id,
            weekKey: window.weekKey,
            segment: decision.segment,
            templateId: copy.templateId,
            locale,
            title: copy.title,
            body: copy.body,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
      }

      await this.fcm.sendAndPersist({
        userId: user.id,
        tokens: user.fcmTokens.map((token) => token.token),
        payload: {
          type: 'weekly_report',
          title: copy.title,
          body: copy.body,
          data: notificationData({
            route,
            weekKey: window.weekKey,
            segment: decision.segment,
            templateId: copy.templateId,
            sentences: stats.sentences,
            minutes: stats.minutes,
            words: stats.words,
            activeDays: isIdle ? '' : stats.activeDays,
          }),
        },
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          weeklyReportTemplateIds: rememberTemplateIds(
            user.weeklyReportTemplateIds,
            copy.templateId,
          ),
        },
      });
      this.logger.log(
        JSON.stringify({
          event: 'weekly_report_push_sent',
          userId: user.id,
          segment: decision.segment,
          templateId: copy.templateId,
        }),
      );
      sent += 1;
    }
    return sent;
  }

  private statsForUser(input: {
    user: JobUser;
    window: ReturnType<typeof weekWindow>;
    spoken: Array<{ day: Date; count: number }>;
    active: Array<{ day: Date }>;
    sessions: Array<{
      completedAt: Date | null;
      durationSeconds: number | null;
      learnerTurnCount: number | null;
      lessonId: string | null;
    }>;
    words: Array<{ totalCount: number; createdAt: Date }>;
    stars: Array<{ createdAt: Date }>;
    badges: Array<{ achievementId: string; unlockedAt: Date }>;
    interviews: Array<{ scenarioId: string; finishedAt: Date | null }>;
    rank?: number;
  }): WeeklyStats {
    const { user, window } = input;
    const localKeys = new Set(window.dateKeys);
    const inWeek = (at: Date | null | undefined) => {
      if (!at) return false;
      return at >= window.startUtc && at < window.endUtc;
    };

    const sentences = input.spoken
      .filter((row) => localKeys.has(dateKeyFromUtcDate(row.day)) || inWeek(row.day))
      .reduce((sum, row) => sum + row.count, 0);

    const activeSet = new Set<string>();
    for (const row of input.active) {
      const key = dateKeyFromUtcDate(row.day);
      if (localKeys.has(key)) activeSet.add(key);
    }
    if (user.lastAppOpenDate) {
      const key = dateKeyFromUtcDate(user.lastAppOpenDate);
      if (localKeys.has(key)) activeSet.add(key);
    }
    let minutes = 0;
    let speakSessions = 0;
    let lessonsCompleted = 0;
    for (const session of input.sessions) {
      if (!inWeek(session.completedAt)) continue;
      minutes += Math.round((session.durationSeconds ?? 0) / 60);
      if ((session.learnerTurnCount ?? 0) > 0) speakSessions += 1;
      if (session.lessonId) lessonsCompleted += 1;
      const key = localDateKey(session.completedAt!, user.timezone);
      if (localKeys.has(key)) activeSet.add(key);
    }

    const words = input.words
      .filter((row) => inWeek(row.createdAt))
      .reduce((sum, row) => sum + row.totalCount, 0);
    const perfectStars = input.stars.filter((row) => inWeek(row.createdAt)).length;
    const weekBadges = input.badges.filter((row) => inWeek(row.unlockedAt));
    const weekInterviews = input.interviews.filter((row) => inWeek(row.finishedAt));
    const placement = placementBits(user.placementResult, user.lastPlacementTestAt, window.endUtc, window.startUtc);

    const stats = emptyStats();
    stats.sentences = sentences;
    stats.minutes = minutes;
    stats.words = words;
    stats.speakSessions = speakSessions;
    stats.lessonsCompleted = lessonsCompleted;
    stats.activeDayCount = activeSet.size;
    stats.activeDays = activeDaysBits(window.dateKeys, activeSet);
    stats.streakDays = user.streakDays;
    stats.streakRecord = user.streakDays > 0 && user.streakDays >= user.longestStreakDays;
    if (input.rank) {
      stats.rank = input.rank;
      stats.game = 'Word Cards';
    }
    stats.addons = buildAddons({
      interviews: weekInterviews,
      placementLevel: placement.level,
      placementTopPercent: placement.topPercent,
      rank: input.rank,
      game: input.rank ? 'Word Cards' : undefined,
      badges: weekBadges,
      streakDays: user.streakDays,
      perfectStars,
      words,
      locale: user.contentLocale === 'en' ? 'en' : 'th',
    });
    return stats;
  }

  private async wordCardsRanks(weekKey: string): Promise<Map<string, number>> {
    const rows = await this.prisma.wordCardsEndlessScore.findMany({
      where: { weekKey },
      orderBy: [{ bestScore: 'desc' }, { updatedAt: 'asc' }],
      select: { userId: true },
    });
    return new Map(rows.map((row, index) => [row.userId, index + 1]));
  }

  private async tryLog(userId: string, dateKey: string): Promise<boolean> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          userId,
          type: WEEKLY_REPORT_TYPE,
          sentOn: parseDateKey(dateKey),
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = out.get(id) ?? [];
    list.push(row);
    out.set(id, list);
  }
  return out;
}

function pieceIdsFromData(data: Prisma.JsonValue | null): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const raw = (data as Record<string, unknown>).templateId;
  if (typeof raw !== 'string' || !raw) return [];
  return raw.split('+');
}

function localDateKey(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function placementBits(
  result: Prisma.JsonValue | null,
  lastAt: Date | null,
  endUtc: Date,
  startUtc: Date,
): { level: string | null; topPercent: number | null } {
  if (!lastAt || lastAt < startUtc || lastAt >= endUtc) {
    return { level: null, topPercent: null };
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { level: null, topPercent: null };
  }
  const row = result as Record<string, unknown>;
  const level = typeof row.publicResult === 'string' ? row.publicResult : null;
  const top =
    typeof row.topPercent === 'number'
      ? row.topPercent
      : typeof row.betterThanPercent === 'number'
        ? Math.max(1, 100 - row.betterThanPercent)
        : null;
  return { level, topPercent: top };
}
