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
import {
  ENV_PAYWALL_AB,
  ENV_PAYWALL_AB_START,
  PAYWALL_ARMS,
  PAYWALL_EXPERIMENT,
  parsePaywallAbSettings,
} from '../subscriptions/paywall-ab';
import { subscriptionProduct } from '../subscriptions/subscription-products';
import {
  ENV_NOTIFY_ASK_AB,
  ENV_NOTIFY_ASK_AB_START,
  NOTIFY_ASK_ARMS,
  NOTIFY_ASK_EXPERIMENT,
  parseNotifyAskAbSettings,
} from '../users/notify-ask-ab';

type NotifyRow = {
  arm: string;
  n: number;
  m3: number;
  g3: number;
  g_ever: number;
  m1: number;
  r1: number;
  r3: number;
};

type PaywallRow = {
  arm: string;
  age: string | null;
  band: string | null;
  platform: string | null;
  products: string[] | null;
};

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
 * Admin → A/B Tests. Signup-day banana bonus: A (Day 0 +2) vs B (Day 0 +3 · Day 1–2 +2).
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
               (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date AS d0
        FROM "User"
        WHERE "bananaBonusArm" IS NOT NULL AND "onboardingCompleted"
      ),
      act AS (
        SELECT DISTINCT s."userId", ((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date - c.d0 AS dn
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
             AND ((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = c.d0))::float8 AS s0,
        avg((SELECT coalesce(-sum(e.amount), 0) FROM "EconomyTransaction" e
             WHERE e."userId" = c.id AND e.currency = 'BANANA' AND e.amount < 0
             AND ((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = c.d0))::float8 AS spend0,
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
      arms: { A: 'Day 0 +2 only (control)', B: 'Day 0 +3 · Day 1 +2 · Day 2 +2' },
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

  /**
   * Paywall default-plan test. Exposed = opened the paywall in the test
   * (arm stored); buyer = a real store subscription on/after first exposure.
   */
  @Get('paywall')
  async paywall() {
    const settings = parsePaywallAbSettings(
      this.config.get<string>(ENV_PAYWALL_AB),
      this.config.get<string>(ENV_PAYWALL_AB_START),
    );
    const rows = await this.prisma.$queryRaw<PaywallRow[]>`
      SELECT u."paywallArm" AS arm, u."surveyAgeRange" AS age,
             u."placementResult"->>'publicResult' AS band, u."appPlatform" AS platform,
             (SELECT array_agg(g."productId" ORDER BY g."createdAt")
                FROM "SubscriptionGrant" g
               WHERE g."userId" = u.id AND g.source = 'revenuecat'
                 AND coalesce(g."isSandbox", false) = false
                 AND g."createdAt" >= u."paywallArmAt") AS products
      FROM "User" u
      WHERE u."paywallArm" IS NOT NULL`;

    type Acc = { n: number; buyers: number; revenue: number; byProduct: Record<string, number> };
    const empty = (): Acc => ({ n: 0, buyers: 0, revenue: 0, byProduct: {} });
    const arms: Record<string, Acc> = { A: empty(), B: empty(), C: empty() };
    const segs: Record<string, Record<string, Record<string, Acc>>> = { age: {}, band: {}, platform: {} };
    const add = (acc: Acc, r: PaywallRow) => {
      acc.n++;
      const first = r.products?.[0];
      if (!first) return;
      acc.buyers++;
      const id = subscriptionProduct(first)?.productId ?? first;
      acc.byProduct[id] = (acc.byProduct[id] ?? 0) + 1;
      for (const p of r.products ?? []) acc.revenue += subscriptionProduct(p)?.priceThb ?? 0;
    };
    for (const r of rows) {
      if (!arms[r.arm]) continue;
      add(arms[r.arm]!, r);
      for (const [dim, value] of [
        ['age', r.age ?? '(none)'],
        ['band', r.band ?? 'no test'],
        ['platform', r.platform ?? '(none)'],
      ] as const) {
        const byValue = (segs[dim]![value] ??= {});
        add((byValue[r.arm] ??= empty()), r);
      }
    }
    const pct = (x: number, n: number) => (n ? Math.round((x / n) * 1000) / 10 : null);
    const summary = (acc: Acc) => ({
      users: acc.n,
      buyers: acc.buyers,
      conversion: pct(acc.buyers, acc.n),
      revenueThb: acc.revenue,
      revenuePerUser: acc.n ? Math.round((acc.revenue / acc.n) * 10) / 10 : null,
      byProduct: acc.byProduct,
    });
    const a = arms.A!;
    return {
      experiment: PAYWALL_EXPERIMENT,
      title: 'Paywall default plan',
      enabled: settings.enabled,
      start: settings.start.toISOString(),
      arms: Object.fromEntries(Object.entries(PAYWALL_ARMS).map(([k, v]) => [k, v.label])),
      results: Object.fromEntries(
        Object.entries(arms).map(([k, acc]) => [
          k,
          {
            ...summary(acc),
            pValueVsA: k === 'A' ? null : twoProportionPValue(acc.buyers, acc.n, a.buyers, a.n),
          },
        ]),
      ),
      segments: Object.fromEntries(
        Object.entries(segs).map(([dim, byValue]) => [
          dim,
          Object.entries(byValue)
            .map(([value, byArm]) => ({
              value,
              arms: Object.fromEntries(Object.entries(byArm).map(([k, acc]) => [k, summary(acc)])),
            }))
            .sort(
              (x, y) =>
                Object.values(y.arms).reduce((s, v) => s + v.users, 0) -
                Object.values(x.arms).reduce((s, v) => s + v.users, 0),
            ),
        ]),
      ),
    };
  }

  /**
   * Notification-ask timing. Granted = a push token saved (only after Allow)
   * within 3 days of signup. Active = lesson or path mini-game that day
   * (Bangkok); a day counts once it is over.
   */
  @Get('notify-ask')
  async notifyAsk() {
    const settings = parseNotifyAskAbSettings(
      this.config.get<string>(ENV_NOTIFY_ASK_AB),
      this.config.get<string>(ENV_NOTIFY_ASK_AB_START),
    );
    const rows = await this.prisma.$queryRaw<NotifyRow[]>`
      WITH c AS (
        SELECT id, "notifyAskArm" AS arm, "createdAt",
               (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date AS d0
        FROM "User"
        WHERE "notifyAskArm" IS NOT NULL AND "onboardingCompleted"
      ),
      ev AS (
        SELECT "userId", "createdAt" FROM "UserSession" WHERE "userId" IN (SELECT id FROM c)
        UNION ALL
        SELECT "userId", "createdAt" FROM "MiniGameScoreAttempt" WHERE "userId" IN (SELECT id FROM c)
      ),
      act AS (
        SELECT DISTINCT e."userId", ((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date - c.d0 AS dn
        FROM ev e JOIN c ON c.id = e."userId"
        WHERE e."createdAt" < c."createdAt" + interval '5 days'
      ),
      t AS (SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today)
      SELECT c.arm,
        count(*)::int AS n,
        count(*) FILTER (WHERE c."createdAt" < now() - interval '3 days')::int AS m3,
        count(*) FILTER (WHERE c."createdAt" < now() - interval '3 days' AND EXISTS (
          SELECT 1 FROM "UserFcmToken" f WHERE f."userId" = c.id
            AND f."createdAt" < c."createdAt" + interval '3 days'))::int AS g3,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "UserFcmToken" f WHERE f."userId" = c.id))::int AS g_ever,
        count(*) FILTER (WHERE c.d0 <= t.today - 2)::int AS m1,
        count(*) FILTER (WHERE c.d0 <= t.today - 2 AND EXISTS (SELECT 1 FROM act a WHERE a."userId" = c.id AND a.dn = 1))::int AS r1,
        count(*) FILTER (WHERE c.d0 <= t.today - 4 AND EXISTS (SELECT 1 FROM act a WHERE a."userId" = c.id AND a.dn = 3))::int AS r3
      FROM c, t
      GROUP BY c.arm
      ORDER BY c.arm`;
    const d3n = await this.prisma.$queryRaw<{ arm: string; m: number }[]>`
      SELECT "notifyAskArm" AS arm, count(*)::int AS m FROM "User"
      WHERE "notifyAskArm" IS NOT NULL AND "onboardingCompleted"
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date <= (now() AT TIME ZONE 'Asia/Bangkok')::date - 4
      GROUP BY 1`;
    const pct = (x: number, n: number) => (n ? Math.round((x / n) * 1000) / 10 : null);
    const arm = (name: string) => rows.find((r) => r.arm === name);
    const m3d = (name: string) => d3n.find((r) => r.arm === name)?.m ?? 0;
    const a = arm('A');
    const b = arm('B');
    const metric = (x: (r: NotifyRow) => number, n: (r: NotifyRow, name: string) => number) => ({
      a: a ? { x: x(a), n: n(a, 'A'), pct: pct(x(a), n(a, 'A')) } : null,
      b: b ? { x: x(b), n: n(b, 'B'), pct: pct(x(b), n(b, 'B')) } : null,
      pValue: a && b ? twoProportionPValue(x(a), n(a, 'A'), x(b), n(b, 'B')) : null,
    });
    return {
      experiment: NOTIFY_ASK_EXPERIMENT,
      title: 'Notification ask timing',
      arms: NOTIFY_ASK_ARMS,
      enabled: settings.enabled,
      start: settings.start.toISOString(),
      // ~390 users per arm detects ±10 points on a ~50% opt-in (80% power).
      targetPerArm: 390,
      users: { A: a?.n ?? 0, B: b?.n ?? 0 },
      metrics: {
        granted3d: metric((r) => r.g3, (r) => r.m3),
        d1: metric((r) => r.r1, (r) => r.m1),
        d3: metric((r) => r.r3, (_r, name) => m3d(name)),
      },
      grantedEver: { A: a?.g_ever ?? 0, B: b?.g_ever ?? 0 },
    };
  }
}
