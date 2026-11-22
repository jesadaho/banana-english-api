import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  BANANA_BONUS_EXPERIMENT,
  ENV_BANANA_BONUS_AB,
  ENV_BANANA_BONUS_AB_START,
  parseBananaBonusAbSettings,
  twoProportionPValue,
} from '../economy/banana-bonus-ab';
import { AdminAuthGuard } from './admin-auth.guard';

type ArmRow = {
  arm: string;
  n: number;
  m1: number;
  r1: number;
  m3: number;
  r3: number;
  m7: number;
  r7: number;
  s0: number | null;
  spend0: number | null;
  subs7: number;
  m7subs: number;
};

/**
 * Admin → A/B Tests. Signup-day banana bonus: A (no bonus) vs B (bonus).
 * Retention = any learning session on that Bangkok calendar day after signup;
 * a day is counted only once it is over for that user (matured).
 */
@Controller('admin/metrics/ab')
@UseGuards(AdminAuthGuard)
export class AdminAbTestsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('banana-bonus')
  async bananaBonus() {
    const settings = parseBananaBonusAbSettings(
      this.config.get<string>(ENV_BANANA_BONUS_AB),
      this.config.get<string>(ENV_BANANA_BONUS_AB_START),
    );
    const rows = await this.prisma.$queryRaw<ArmRow[]>`
      WITH c AS (
        SELECT id, "bananaBonusArm" AS arm, "createdAt",
               ("createdAt" AT TIME ZONE 'Asia/Bangkok')::date AS d0
        FROM "User"
        WHERE "bananaBonusArm" IS NOT NULL AND "onboardingCompleted"
      ),
      act AS (
        SELECT DISTINCT s."userId", (s."createdAt" AT TIME ZONE 'Asia/Bangkok')::date - c.d0 AS dn
        FROM "UserSession" s JOIN c ON c.id = s."userId"
        WHERE s."createdAt" < c."createdAt" + interval '9 days'
      ),
      t AS (SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today)
      SELECT c.arm,
        count(*)::int AS n,
        count(*) FILTER (WHERE c.d0 <= t.today - 2)::int AS m1,
        count(*) FILTER (WHERE c.d0 <= t.today - 2 AND EXISTS (SELECT 1 FROM act a WHERE a."userId" = c.id AND a.dn = 1))::int AS r1,
        count(*) FILTER (WHERE c.d0 <= t.today - 4)::int AS m3,
        count(*) FILTER (WHERE c.d0 <= t.today - 4 AND EXISTS (SELECT 1 FROM act a WHERE a."userId" = c.id AND a.dn = 3))::int AS r3,
        count(*) FILTER (WHERE c.d0 <= t.today - 8)::int AS m7,
        count(*) FILTER (WHERE c.d0 <= t.today - 8 AND EXISTS (SELECT 1 FROM act a WHERE a."userId" = c.id AND a.dn = 7))::int AS r7,
        avg((SELECT count(*) FROM "UserSession" s WHERE s."userId" = c.id
             AND (s."createdAt" AT TIME ZONE 'Asia/Bangkok')::date = c.d0))::float8 AS s0,
        avg((SELECT coalesce(-sum(e.amount), 0) FROM "EconomyTransaction" e
             WHERE e."userId" = c.id AND e.currency = 'BANANA' AND e.amount < 0
             AND (e."createdAt" AT TIME ZONE 'Asia/Bangkok')::date = c.d0))::float8 AS spend0,
        count(*) FILTER (WHERE c.d0 <= t.today - 8 AND EXISTS (
          SELECT 1 FROM "SubscriptionGrant" g WHERE g."userId" = c.id AND g.source = 'revenuecat'
          AND coalesce(g."isSandbox", false) = false AND g."createdAt" < c."createdAt" + interval '7 days'))::int AS subs7,
        count(*) FILTER (WHERE c.d0 <= t.today - 8)::int AS m7subs
      FROM c, t
      GROUP BY c.arm
      ORDER BY c.arm`;

    const pct = (x: number, n: number) => (n ? Math.round((x / n) * 1000) / 10 : null);
    const arm = (name: string) => rows.find((r) => r.arm === name);
    const a = arm('A');
    const b = arm('B');
    const metric = (key: 'r1' | 'r3' | 'r7' | 'subs7', denom: 'm1' | 'm3' | 'm7' | 'm7subs') => ({
      a: a ? { x: a[key], n: a[denom], pct: pct(a[key], a[denom]) } : null,
      b: b ? { x: b[key], n: b[denom], pct: pct(b[key], b[denom]) } : null,
      pValue: a && b ? twoProportionPValue(a[key], a[denom], b[key], b[denom]) : null,
    });
    return {
      experiment: BANANA_BONUS_EXPERIMENT,
      title: 'Signup-day banana bonus',
      arms: { A: 'No signup-day bonus (control)', B: 'Day 0 +3 · Day 1 +2 · Day 2 +2' },
      enabled: settings.enabled,
      start: settings.start.toISOString(),
      // ~540 users per arm detects a D1 change of ±8 points (31% base, 80% power).
      targetPerArm: 540,
      users: { A: a?.n ?? 0, B: b?.n ?? 0 },
      day0Sessions: { A: a?.s0 ?? null, B: b?.s0 ?? null },
      day0BananasSpent: { A: a?.spend0 ?? null, B: b?.spend0 ?? null },
      metrics: {
        d1: metric('r1', 'm1'),
        d3: metric('r3', 'm3'),
        d7: metric('r7', 'm7'),
        subscribed7d: metric('subs7', 'm7subs'),
      },
    };
  }
}
