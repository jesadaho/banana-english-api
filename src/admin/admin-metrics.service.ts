import { BadRequestException, Injectable } from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  dateKey,
  eachUtcDateKey,
  estimatedThbForProduct,
  filtersCacheKey,
  parseDateRange,
  pctChange,
  previousRange,
  weekStartKey,
  type DateRange,
  type MetricsFilters,
} from './admin-metrics.util';

type CacheEntry = { expiresAt: number; payload: unknown };

const EMPTY_FILTERS: MetricsFilters = {
  requireOnboarding: false,
  requireSignedIn: false,
  requireAppOpen: false,
  excludeUnsetSource: false,
};

@Injectable()
export class AdminMetricsService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 120_000;

  constructor(private readonly prisma: PrismaService) {}

  async overview(
    fromRaw?: string,
    toRaw?: string,
    filters: MetricsFilters = EMPTY_FILTERS,
  ) {
    const range = this.safeRange(fromRaw, toRaw);
    return this.cached(
      `overview:${range.from.toISOString()}:${range.to.toISOString()}:${filtersCacheKey(filters)}`,
      () => this.buildOverview(range, filters),
    );
  }

  async acquisition(
    fromRaw?: string,
    toRaw?: string,
    filters: MetricsFilters = EMPTY_FILTERS,
  ) {
    const range = this.safeRange(fromRaw, toRaw);
    return this.cached(
      `acquisition:${range.from.toISOString()}:${range.to.toISOString()}:${filtersCacheKey(filters)}`,
      () => this.buildAcquisition(range, filters),
    );
  }

  async content(
    fromRaw?: string,
    toRaw?: string,
    filters: MetricsFilters = EMPTY_FILTERS,
  ) {
    const range = this.safeRange(fromRaw, toRaw);
    return this.cached(
      `content:${range.from.toISOString()}:${range.to.toISOString()}:${filtersCacheKey(filters)}`,
      () => this.buildContent(range, filters),
    );
  }

  async economy(
    fromRaw?: string,
    toRaw?: string,
    filters: MetricsFilters = EMPTY_FILTERS,
  ) {
    const range = this.safeRange(fromRaw, toRaw);
    return this.cached(
      `economy:${range.from.toISOString()}:${range.to.toISOString()}:${filtersCacheKey(filters)}`,
      () => this.buildEconomy(range, filters),
    );
  }

  private safeRange(fromRaw?: string, toRaw?: string): DateRange {
    try {
      return parseDateRange(fromRaw, toRaw, 30);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid date range',
      );
    }
  }

  private userWhere(filters: MetricsFilters): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (filters.requireOnboarding) where.onboardingCompleted = true;
    if (filters.requireSignedIn) where.firebaseUid = { not: null };
    if (filters.requireAppOpen) where.lastAppOpenDate = { not: null };
    if (filters.excludeUnsetSource) {
      where.AND = [
        { acquisitionSource: { not: null } },
        { NOT: { acquisitionSource: '' } },
      ];
    }
    return where;
  }

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.payload as T;
    }
    const payload = await loader();
    this.cache.set(key, { expiresAt: Date.now() + this.ttlMs, payload });
    return payload;
  }

  private async buildOverview(range: DateRange, filters: MetricsFilters) {
    const prev = previousRange(range);
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);
    const monthStart = new Date(todayStart.getTime() - 29 * 86_400_000);
    const userFilter = this.userWhere(filters);
    // New users KPI = onboarded; install/raw uses filters without forcing onboard.
    const installFilter = this.userWhere({
      ...filters,
      requireOnboarding: false,
    });

    const createdIn = (
      from: Date,
      to: Date,
      base: Prisma.UserWhereInput = userFilter,
    ): Prisma.UserWhereInput => ({
      ...base,
      createdAt: { gte: from, lte: to },
    });

    const onboardedIn = (from: Date, to: Date): Prisma.UserWhereInput => ({
      ...installFilter,
      createdAt: { gte: from, lte: to },
      onboardingCompleted: true,
    });

    const [
      dau,
      wau,
      mau,
      newUsers,
      newUsersPrev,
      activatedInRange,
      newInRange,
      lessonCompletions,
      lessonCompletionsPrev,
      missionCompletions,
      missionCompletionsPrev,
      purchases,
      purchasesPrev,
      signedInUsers,
      payingUsers,
      dauSeriesRaw,
      completionsByDay,
      newUsersRaw,
    ] = await Promise.all([
      this.countActiveOn(todayStart, todayStart, userFilter),
      this.countActiveOn(weekStart, todayStart, userFilter),
      this.countActiveOn(monthStart, todayStart, userFilter),
      this.prisma.user.count({ where: onboardedIn(range.from, range.to) }),
      this.prisma.user.count({ where: onboardedIn(prev.from, prev.to) }),
      this.prisma.user.count({ where: onboardedIn(range.from, range.to) }),
      this.prisma.user.count({
        where: createdIn(range.from, range.to, installFilter),
      }),
      this.countCompletions(range, 'training', userFilter),
      this.countCompletions(prev, 'training', userFilter),
      this.countCompletions(range, 'simulation', userFilter),
      this.countCompletions(prev, 'simulation', userFilter),
      this.prisma.purchaseRecord.findMany({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          user: userFilter,
        },
        select: { productId: true, platform: true, createdAt: true },
      }),
      this.prisma.purchaseRecord.findMany({
        where: {
          createdAt: { gte: prev.from, lte: prev.to },
          user: userFilter,
        },
        select: { productId: true },
      }),
      this.prisma.user.count({
        where: { ...userFilter, firebaseUid: { not: null } },
      }),
      this.prisma.purchaseRecord.findMany({
        where: { user: userFilter },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: {
          ...userFilter,
          OR: [
            { lastAppOpenDate: { gte: range.from, lte: range.to } },
            { lastSessionDate: { gte: range.from, lte: range.to } },
          ],
        },
        select: { lastAppOpenDate: true, lastSessionDate: true },
      }),
      this.completionsByDay(range, userFilter),
      this.prisma.user.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
    ]);

    const revenue = purchases.reduce(
      (sum, p) => sum + estimatedThbForProduct(p.productId),
      0,
    );
    const revenuePrev = purchasesPrev.reduce(
      (sum, p) => sum + estimatedThbForProduct(p.productId),
      0,
    );

    const activationRate =
      newInRange === 0
        ? 0
        : Math.round((activatedInRange / newInRange) * 1000) / 10;
    const payingCount = payingUsers.length;
    const conversionRate =
      signedInUsers === 0
        ? 0
        : Math.round((payingCount / signedInUsers) * 1000) / 10;

    const dauByDay = new Map<string, Set<string>>();
    for (const key of eachUtcDateKey(range.from, range.to)) {
      dauByDay.set(key, new Set());
    }
    let i = 0;
    for (const u of dauSeriesRaw) {
      const open = u.lastAppOpenDate ?? u.lastSessionDate;
      if (!open) continue;
      const key = dateKey(open);
      const bucket = dauByDay.get(key);
      if (bucket) bucket.add(`u${i}`);
      i += 1;
    }
    const dauSeries = eachUtcDateKey(range.from, range.to).map((day) => ({
      day,
      value: dauByDay.get(day)?.size ?? 0,
    }));

    const revenueByProduct: Record<string, { count: number; thb: number }> = {};
    for (const p of purchases) {
      const cur = revenueByProduct[p.productId] ?? { count: 0, thb: 0 };
      cur.count += 1;
      cur.thb += estimatedThbForProduct(p.productId);
      revenueByProduct[p.productId] = cur;
    }

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      filters,
      kpis: {
        dau: { value: dau, deltaPct: null },
        wau: { value: wau, deltaPct: null },
        mau: { value: mau, deltaPct: null },
        newUsers: {
          value: newUsers,
          deltaPct: pctChange(newUsers, newUsersPrev),
          /** Always onboarded-complete in range (other filters still apply). */
          definition: 'onboarding_completed',
          rawUnfiltered: newUsersRaw,
          installs: newInRange,
        },
        activationRate: {
          value: activationRate,
          deltaPct: null,
          activated: activatedInRange,
          cohort: newInRange,
        },
        lessonCompletions: {
          value: lessonCompletions,
          deltaPct: pctChange(lessonCompletions, lessonCompletionsPrev),
        },
        missionCompletions: {
          value: missionCompletions,
          deltaPct: pctChange(missionCompletions, missionCompletionsPrev),
        },
        estRevenueThb: {
          value: revenue,
          deltaPct: pctChange(revenue, revenuePrev),
          purchases: purchases.length,
        },
        payingUsers: {
          value: payingCount,
          conversionRate,
          signedInUsers,
        },
      },
      charts: {
        activeUsersProxyByDay: dauSeries,
        completionsByDay,
        revenueByProduct: Object.entries(revenueByProduct).map(
          ([productId, v]) => ({
            productId,
            count: v.count,
            thb: v.thb,
          }),
        ),
      },
      recentPurchases: purchases
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((p) => ({
          productId: p.productId,
          platform: p.platform,
          thb: estimatedThbForProduct(p.productId),
          createdAt: p.createdAt.toISOString(),
        })),
    };
  }

  private async countActiveOn(
    from: Date,
    toDayStart: Date,
    userFilter: Prisma.UserWhereInput,
  ): Promise<number> {
    const to = new Date(
      Date.UTC(
        toDayStart.getUTCFullYear(),
        toDayStart.getUTCMonth(),
        toDayStart.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
    return this.prisma.user.count({
      where: {
        ...userFilter,
        OR: [
          { lastAppOpenDate: { gte: from, lte: to } },
          { lastSessionDate: { gte: from, lte: to } },
        ],
      },
    });
  }

  private async countCompletions(
    range: DateRange,
    sessionType: string,
    userFilter: Prisma.UserWhereInput,
  ): Promise<number> {
    return this.prisma.userSession.count({
      where: {
        sessionType,
        rewardsApplied: true,
        completedAt: { gte: range.from, lte: range.to },
        user: userFilter,
      },
    });
  }

  private async completionsByDay(
    range: DateRange,
    userFilter: Prisma.UserWhereInput,
  ) {
    const rows = await this.prisma.userSession.findMany({
      where: {
        rewardsApplied: true,
        completedAt: { gte: range.from, lte: range.to },
        sessionType: { in: ['training', 'simulation'] },
        user: userFilter,
      },
      select: { completedAt: true, sessionType: true },
    });
    const map = new Map<string, { lessons: number; missions: number }>();
    for (const key of eachUtcDateKey(range.from, range.to)) {
      map.set(key, { lessons: 0, missions: 0 });
    }
    for (const row of rows) {
      if (!row.completedAt) continue;
      const key = dateKey(row.completedAt);
      const bucket = map.get(key);
      if (!bucket) continue;
      if (row.sessionType === 'training') bucket.lessons += 1;
      if (row.sessionType === 'simulation') bucket.missions += 1;
    }
    return [...map.entries()].map(([day, v]) => ({ day, ...v }));
  }

  private async buildAcquisition(range: DateRange, filters: MetricsFilters) {
    const userFilter = this.userWhere(filters);
    const users = await this.prisma.user.findMany({
      where: {
        ...userFilter,
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        id: true,
        acquisitionSource: true,
        selfReportedEnglishLevel: true,
        onboardingCompleted: true,
        createdAt: true,
      },
    });

    const sources: Record<string, number> = {};
    const levels: Record<string, number> = {};
    let onboarded = 0;
    let unsetSource = 0;
    for (const u of users) {
      const raw = u.acquisitionSource?.trim();
      if (!raw) {
        unsetSource += 1;
        if (!filters.excludeUnsetSource) {
          sources.unknown = (sources.unknown ?? 0) + 1;
        }
      } else {
        sources[raw] = (sources[raw] ?? 0) + 1;
      }
      const level = u.selfReportedEnglishLevel?.trim() || 'unknown';
      levels[level] = (levels[level] ?? 0) + 1;
      if (u.onboardingCompleted) onboarded += 1;
    }

    const userIds = users.map((u) => u.id);
    let firstLesson = 0;
    let firstMission = 0;
    if (userIds.length > 0) {
      const [lessonUsers, missionUsers] = await Promise.all([
        this.prisma.userSession.findMany({
          where: {
            userId: { in: userIds },
            sessionType: 'training',
            rewardsApplied: true,
          },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.userSession.findMany({
          where: {
            userId: { in: userIds },
            sessionType: 'simulation',
            rewardsApplied: true,
          },
          distinct: ['userId'],
          select: { userId: true },
        }),
      ]);
      firstLesson = lessonUsers.length;
      firstMission = missionUsers.length;
    }

    const signedUp = users.length;

    const byDay = new Map<string, Record<string, number>>();
    const byWeek = new Map<string, Record<string, number>>();
    for (const key of eachUtcDateKey(range.from, range.to)) {
      byDay.set(key, {});
    }
    for (const u of users) {
      const src = u.acquisitionSource?.trim() || 'unknown';
      if (filters.excludeUnsetSource && src === 'unknown') continue;
      const day = dateKey(u.createdAt);
      const week = weekStartKey(u.createdAt);
      const dayBucket = byDay.get(day) ?? {};
      dayBucket[src] = (dayBucket[src] ?? 0) + 1;
      byDay.set(day, dayBucket);
      const weekBucket = byWeek.get(week) ?? {};
      weekBucket[src] = (weekBucket[src] ?? 0) + 1;
      byWeek.set(week, weekBucket);
    }

    const toTrendRows = (map: Map<string, Record<string, number>>) =>
      [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, srcMap]) => {
          const total = Object.values(srcMap).reduce((s, n) => s + n, 0);
          return { period, sources: srcMap, total };
        });

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      filters,
      excludedUnsetSourceCount: filters.excludeUnsetSource ? unsetSource : 0,
      sources: Object.entries(sources)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      sourcesByDay: toTrendRows(byDay),
      sourcesByWeek: toTrendRows(byWeek),
      levels: Object.entries(levels)
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count),
      funnel: {
        signedUp,
        onboardingCompleted: onboarded,
        firstLessonCompleted: firstLesson,
        firstMissionCompleted: firstMission,
      },
    };
  }

  private async buildContent(range: DateRange, filters: MetricsFilters) {
    const userFilter = this.userWhere(filters);
    const [lessonSessions, missionSessions, ratings, streakBuckets, activeLearners, sessionMix, dailySpeakActive] =
      await Promise.all([
        this.prisma.userSession.groupBy({
          by: ['lessonId'],
          where: {
            sessionType: 'training',
            rewardsApplied: true,
            completedAt: { gte: range.from, lte: range.to },
            lessonId: { not: null },
            user: userFilter,
          },
          _count: { _all: true },
        }),
        this.prisma.userSession.groupBy({
          by: ['simulationId'],
          where: {
            sessionType: 'simulation',
            rewardsApplied: true,
            completedAt: { gte: range.from, lte: range.to },
            simulationId: { not: null },
            user: userFilter,
          },
          _count: { _all: true },
        }),
        this.prisma.lessonRating.groupBy({
          by: ['lessonId'],
          where: {
            createdAt: { gte: range.from, lte: range.to },
            user: userFilter,
          },
          _avg: { stars: true },
          _count: { _all: true },
        }),
        this.streakDistribution(userFilter),
        this.prisma.user.count({
          where: {
            ...userFilter,
            lastStudiedAt: {
              gte: new Date(Date.now() - 7 * 86_400_000),
            },
          },
        }),
        this.prisma.userSession.groupBy({
          by: ['sessionType'],
          where: {
            createdAt: { gte: range.from, lte: range.to },
            user: userFilter,
          },
          _count: { _all: true },
        }),
        this.prisma.user.count({
          where: {
            ...userFilter,
            dailySpeakCount: { gt: 0 },
            updatedAt: { gte: range.from, lte: range.to },
          },
        }),
      ]);

    const ratingByLesson = new Map(
      ratings.map((r) => [
        r.lessonId,
        {
          avgStars: Math.round((r._avg.stars ?? 0) * 100) / 100,
          count: r._count._all,
        },
      ]),
    );

    const lessons = lessonSessions
      .filter((r) => r.lessonId)
      .map((r) => ({
        lessonId: r.lessonId!,
        completions: r._count._all,
        rating: ratingByLesson.get(r.lessonId!) ?? null,
      }))
      .sort((a, b) => b.completions - a.completions);

    const lowRated = ratings
      .filter((r) => (r._avg.stars ?? 5) <= 2 && r._count._all >= 2)
      .map((r) => ({
        lessonId: r.lessonId,
        avgStars: Math.round((r._avg.stars ?? 0) * 100) / 100,
        count: r._count._all,
      }))
      .sort((a, b) => a.avgStars - b.avgStars);

    const missions = missionSessions
      .filter((r) => r.simulationId)
      .map((r) => ({
        simulationId: r.simulationId!,
        completions: r._count._all,
      }))
      .sort((a, b) => b.completions - a.completions);

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      filters,
      topLessons: lessons.slice(0, 15),
      bottomLessons: [...lessons].sort((a, b) => a.completions - b.completions).slice(0, 10),
      topMissions: missions.slice(0, 20),
      lowRatedLessons: lowRated.slice(0, 10),
      retention: {
        activeLearners7d: activeLearners,
        streakBuckets,
        sessionMix: sessionMix.map((s) => ({
          sessionType: s.sessionType,
          count: s._count._all,
        })),
        dailySpeakTouchedUsers: dailySpeakActive,
      },
    };
  }

  private async streakDistribution(userFilter: Prisma.UserWhereInput) {
    const rows = await this.prisma.user.findMany({
      where: { ...userFilter, streakDays: { gt: 0 } },
      select: { streakDays: true, longestStreakDays: true },
    });
    const buckets = [
      { label: '1', min: 1, max: 1, current: 0, longest: 0 },
      { label: '2-3', min: 2, max: 3, current: 0, longest: 0 },
      { label: '4-6', min: 4, max: 6, current: 0, longest: 0 },
      { label: '7-13', min: 7, max: 13, current: 0, longest: 0 },
      { label: '14-29', min: 14, max: 29, current: 0, longest: 0 },
      { label: '30+', min: 30, max: 10_000, current: 0, longest: 0 },
    ];
    for (const row of rows) {
      for (const b of buckets) {
        if (row.streakDays >= b.min && row.streakDays <= b.max) b.current += 1;
        if (row.longestStreakDays >= b.min && row.longestStreakDays <= b.max) {
          b.longest += 1;
        }
      }
    }
    return buckets.map(({ label, current, longest }) => ({
      label,
      current,
      longest,
    }));
  }

  private async buildEconomy(range: DateRange, filters: MetricsFilters) {
    const userFilter = this.userWhere(filters);
    const [txns, purchases] = await Promise.all([
      this.prisma.economyTransaction.findMany({
        where: {
          currency: Currency.BANANA,
          createdAt: { gte: range.from, lte: range.to },
          user: userFilter,
        },
        select: { amount: true, source: true },
      }),
      this.prisma.purchaseRecord.findMany({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          user: userFilter,
        },
        select: {
          productId: true,
          platform: true,
          userId: true,
          bananasGranted: true,
          createdAt: true,
        },
      }),
    ]);

    const bySource: Record<string, { in: number; out: number; net: number }> =
      {};
    let bananaIn = 0;
    let bananaOut = 0;
    for (const t of txns) {
      const cur = bySource[t.source] ?? { in: 0, out: 0, net: 0 };
      if (t.amount >= 0) {
        cur.in += t.amount;
        bananaIn += t.amount;
      } else {
        cur.out += Math.abs(t.amount);
        bananaOut += Math.abs(t.amount);
      }
      cur.net += t.amount;
      bySource[t.source] = cur;
    }

    const spendMixKeys = [
      'lesson_start',
      'mission_start',
      'free_talk_start',
      'say_it_start',
      'explain_it_start',
      'emoji_speak_start',
    ];
    const spendMix = spendMixKeys.map((source) => ({
      source,
      bananas: bySource[source]?.out ?? 0,
    }));

    const byProduct: Record<
      string,
      { count: number; thb: number; bananas: number }
    > = {};
    const byPlatform: Record<string, number> = {};
    const purchasesPerUser = new Map<string, number>();
    for (const p of purchases) {
      const cur = byProduct[p.productId] ?? {
        count: 0,
        thb: 0,
        bananas: 0,
      };
      cur.count += 1;
      cur.thb += estimatedThbForProduct(p.productId);
      cur.bananas += p.bananasGranted;
      byProduct[p.productId] = cur;
      const plat = p.platform?.trim() || 'unknown';
      byPlatform[plat] = (byPlatform[plat] ?? 0) + 1;
      purchasesPerUser.set(
        p.userId,
        (purchasesPerUser.get(p.userId) ?? 0) + 1,
      );
    }

    const buyerCount = purchasesPerUser.size;
    const repeatBuyers = [...purchasesPerUser.values()].filter(
      (n) => n > 1,
    ).length;
    const estRevenue = Object.values(byProduct).reduce((s, v) => s + v.thb, 0);
    const arpu =
      buyerCount === 0 ? 0 : Math.round((estRevenue / buyerCount) * 10) / 10;

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      filters,
      bananas: {
        in: bananaIn,
        out: bananaOut,
        net: bananaIn - bananaOut,
        bySource: Object.entries(bySource)
          .map(([source, v]) => ({ source, ...v }))
          .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
        spendMix,
      },
      iap: {
        purchases: purchases.length,
        estRevenueThb: estRevenue,
        arpu,
        buyerCount,
        repeatBuyers,
        repeatRate:
          buyerCount === 0
            ? 0
            : Math.round((repeatBuyers / buyerCount) * 1000) / 10,
        byProduct: Object.entries(byProduct).map(([productId, v]) => ({
          productId,
          ...v,
        })),
        byPlatform: Object.entries(byPlatform).map(([platform, count]) => ({
          platform,
          count,
        })),
      },
    };
  }
}
