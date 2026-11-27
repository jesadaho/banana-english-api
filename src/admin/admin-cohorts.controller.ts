import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { parseDateRange } from './admin-metrics.util';
import { overallStats, segmentStats, type CohortUserRow } from './cohort-segments';

type SqlRow = {
  age_days: number;
  active_days: number[] | null;
  paid: boolean;
  s0: number;
  mission0: boolean;
  acts0: number;
  acts7: number;
  spent0: number;
  bal0: number;
  placement: string | null;
  self_level: string | null;
  age: string | null;
  gender: string | null;
  source: string | null;
  platform: string | null;
  signed_in: boolean;
  reminder: string | null;
  teaching: string | null;
};

const DIMENSIONS = [
  'tier',
  'placement',
  'selfLevel',
  'age',
  'gender',
  'source',
  'platform',
  'signedIn',
  'reminder',
  'teaching',
  'day0Sessions',
  'day0Mission',
] as const;

const day0Bucket = (n: number) => (n <= 0 ? '0' : n <= 2 ? '1–2' : n <= 5 ? '3–5' : '6+');

/**
 * Admin → Cohorts. New users who finished onboarding in [from, to] (Bangkok signup day):
 * D1/D2/D3/D7 retention, drop-off after D1 and D3–D7 comeback per segment, paid vs free.
 * Active = any learning activity on that Bangkok calendar day: lesson/conversation (UserSession),
 * path mini-game, clip, event attempt or Live Talk join;
 * a day counts once it is over.
 */
@Controller('admin/metrics')
@UseGuards(AdminAuthGuard)
export class AdminCohortsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('cohort-segments')
  async cohortSegments(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tier') tierRaw?: string,
    @Query('minN') minNRaw?: string,
  ) {
    let range;
    try {
      range = parseDateRange(from, to, 30);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const tier = tierRaw === 'paid' || tierRaw === 'free' ? tierRaw : 'all';
    const minN = Math.max(1, Math.min(500, Number(minNRaw) || 15));
    const fromDay = range.from.toISOString().slice(0, 10);
    const toDay = range.to.toISOString().slice(0, 10);

    const sql = await this.prisma.$queryRaw<SqlRow[]>`
      WITH c AS (
        SELECT u.id, u."createdAt", ((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date AS d0,
               u."placementResult"->>'publicResult' AS placement,
               u."selfReportedEnglishLevel" AS self_level,
               u."surveyAgeRange" AS age, u."surveyGender" AS gender,
               u."acquisitionSource" AS source, u."appPlatform" AS platform,
               (u."firebaseUid" IS NOT NULL) AS signed_in,
               u."reminderSlot" AS reminder, u."lessonTeachingLanguage" AS teaching
        FROM "User" u
        WHERE u."onboardingCompleted"
          AND ((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date BETWEEN ${fromDay}::date AND ${toDay}::date
      ),
      ev AS (
        SELECT s."userId", s."createdAt", s."isDailyMission" AS mission FROM "UserSession" s
        WHERE s."userId" IN (SELECT id FROM c)
        UNION ALL
        -- Path mini-games (new_words, emoji_speak, say_it…) do not create a UserSession.
        SELECT g."userId", g."createdAt", false FROM "MiniGameScoreAttempt" g
        WHERE g."userId" IN (SELECT id FROM c)
        UNION ALL
        SELECT k."userId", k."createdAt", false FROM "ClipSession" k
        WHERE k."userId" IN (SELECT id FROM c)
        UNION ALL
        SELECT v."userId", v."createdAt", false FROM "EventScoreAttempt" v
        WHERE v."userId" IN (SELECT id FROM c)
        UNION ALL
        SELECT l."userId", l."joinedAt", false FROM "LiveTalkParticipant" l
        WHERE l."userId" IN (SELECT id FROM c)
      ),
      act AS (
        SELECT e."userId",
               ((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date - c.d0 AS dn,
               count(*)::int AS n,
               bool_or(e.mission) AS mission
        FROM ev e JOIN c ON c.id = e."userId"
        WHERE e."createdAt" >= c."createdAt" - interval '1 day'
          AND e."createdAt" < c."createdAt" + interval '9 days'
        GROUP BY 1, 2
      )
      bn AS (
        SELECT t."userId",
               coalesce(-sum(t.amount) FILTER (WHERE t.amount < 0
                 AND ((t."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = c.d0), 0)::int AS spent0,
               coalesce(sum(t.amount) FILTER (WHERE
                 ((t."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date <= c.d0), 0)::int AS bal0
        FROM "EconomyTransaction" t JOIN c ON c.id = t."userId"
        WHERE t.currency = 'BANANA'
        GROUP BY 1
      )
      SELECT ((now() AT TIME ZONE 'Asia/Bangkok')::date - c.d0)::int AS age_days,
        (SELECT array_agg(a.dn ORDER BY a.dn) FROM act a WHERE a."userId" = c.id AND a.dn BETWEEN 0 AND 7) AS active_days,
        coalesce((SELECT a.n FROM act a WHERE a."userId" = c.id AND a.dn = 0), 0)::int AS s0,
        coalesce((SELECT a.n FROM act a WHERE a."userId" = c.id AND a.dn = 0), 0)::int AS acts0,
        coalesce((SELECT sum(a.n) FROM act a WHERE a."userId" = c.id AND a.dn BETWEEN 0 AND 7), 0)::int AS acts7,
        coalesce((SELECT a.mission FROM act a WHERE a."userId" = c.id AND a.dn = 0), false) AS mission0,
        coalesce(bn.spent0, 0) AS spent0,
        coalesce(bn.bal0, 0) AS bal0,
        EXISTS (SELECT 1 FROM "SubscriptionGrant" g WHERE g."userId" = c.id
                AND g.source IN ('revenuecat', 'founder_presale')
                AND coalesce(g."isSandbox", false) = false) AS paid,
        c.placement, c.self_level, c.age, c.gender, c.source, c.platform,
        c.signed_in, c.reminder, c.teaching
      FROM c LEFT JOIN bn ON bn."userId" = c.id`;

    const all: CohortUserRow[] = sql.map((r) => ({
      ageDays: Number(r.age_days),
      activeDays: (r.active_days ?? []).map(Number),
      paid: !!r.paid,
      activities0: Number(r.acts0),
      activities7: Number(r.acts7),
      bananasSpent0: Number(r.spent0),
      outOfBananas0: Number(r.bal0) <= 0,
      dims: {
        tier: r.paid ? 'paid' : 'free',
        placement: r.placement ?? 'no test',
        selfLevel: r.self_level ?? '(none)',
        age: r.age ?? '(none)',
        gender: r.gender ?? '(none)',
        source: r.source ?? '(none)',
        platform: r.platform ?? '(none)',
        signedIn: r.signed_in ? 'signed in' : 'guest',
        reminder: r.reminder ?? 'off',
        teaching: r.teaching ?? '(none)',
        day0Sessions: day0Bucket(Number(r.s0)),
        day0Mission: r.mission0 ? 'yes' : 'no',
      },
    }));
    const rows = tier === 'all' ? all : all.filter((r) => r.dims.tier === tier);

    return {
      from: fromDay,
      to: toDay,
      tier,
      minN,
      overall: overallStats(rows),
      paidVsFree: segmentStats(all, ['tier'], 1).tier,
      segments: segmentStats(rows, DIMENSIONS.filter((d) => d !== 'tier'), minN),
      definitions: {
        dN: 'any learning activity (lesson, mini-game, clip, event, Live Talk) on signup day + N (Bangkok), of users whose day N is over',
        dropAfterD1: 'active on D1 but not on D2 or D3, of D1 returners',
        comeback: 'not active on D1 or D2 but active on any of D3–D7, of users away on D1+D2',
        acts0: 'average learning activities (lesson, mini-game, clip, event, Live Talk) on signup day',
        acts7: 'average learning activities on days 0–7, of users whose day 7 is over',
        bananas0: 'average bananas spent on signup day (Bangkok)',
        outOfBananas0: 'banana balance ≤ 0 at the end of signup day',
      },
    };
  }
}
