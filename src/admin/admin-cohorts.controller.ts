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

const day0Bucket = (n: number) => (n <= 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2–3' : '4+');

/**
 * Admin → Cohorts. New users who finished onboarding in [from, to] (Bangkok signup day):
 * D1/D2/D3/D7 retention, drop-off after D1 and D3–D7 comeback per segment, paid vs free.
 * Active = any UserSession on that Bangkok calendar day; a day counts once it is over.
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
        SELECT u.id, u."createdAt", (u."createdAt" AT TIME ZONE 'Asia/Bangkok')::date AS d0,
               u."placementResult"->>'publicResult' AS placement,
               u."selfReportedEnglishLevel" AS self_level,
               u."surveyAgeRange" AS age, u."surveyGender" AS gender,
               u."acquisitionSource" AS source, u."appPlatform" AS platform,
               (u."firebaseUid" IS NOT NULL) AS signed_in,
               u."reminderSlot" AS reminder, u."lessonTeachingLanguage" AS teaching
        FROM "User" u
        WHERE u."onboardingCompleted"
          AND (u."createdAt" AT TIME ZONE 'Asia/Bangkok')::date BETWEEN ${fromDay}::date AND ${toDay}::date
      ),
      act AS (
        SELECT s."userId",
               (s."createdAt" AT TIME ZONE 'Asia/Bangkok')::date - c.d0 AS dn,
               count(*)::int AS n,
               bool_or(s."isDailyMission") AS mission
        FROM "UserSession" s JOIN c ON c.id = s."userId"
        WHERE s."createdAt" >= c."createdAt" - interval '1 day'
          AND s."createdAt" < c."createdAt" + interval '9 days'
        GROUP BY 1, 2
      )
      SELECT ((now() AT TIME ZONE 'Asia/Bangkok')::date - c.d0)::int AS age_days,
        (SELECT array_agg(a.dn ORDER BY a.dn) FROM act a WHERE a."userId" = c.id AND a.dn BETWEEN 0 AND 7) AS active_days,
        coalesce((SELECT a.n FROM act a WHERE a."userId" = c.id AND a.dn = 0), 0)::int AS s0,
        coalesce((SELECT a.mission FROM act a WHERE a."userId" = c.id AND a.dn = 0), false) AS mission0,
        EXISTS (SELECT 1 FROM "SubscriptionGrant" g WHERE g."userId" = c.id
                AND g.source IN ('revenuecat', 'founder_presale')
                AND coalesce(g."isSandbox", false) = false) AS paid,
        c.placement, c.self_level, c.age, c.gender, c.source, c.platform,
        c.signed_in, c.reminder, c.teaching
      FROM c`;

    const all: CohortUserRow[] = sql.map((r) => ({
      ageDays: Number(r.age_days),
      activeDays: (r.active_days ?? []).map(Number),
      paid: !!r.paid,
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
        dN: 'active on signup day + N (Bangkok), of users whose day N is over',
        dropAfterD1: 'active on D1 but not on D2 or D3, of D1 returners',
        comeback: 'not active on D1 or D2 but active on any of D3–D7, of users away on D1+D2',
      },
    };
  }
}
