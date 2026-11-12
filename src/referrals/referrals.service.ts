import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Currency, Prisma, SubscriptionTier } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { FcmService } from '../notifications/fcm.service';
import { PrismaService } from '../prisma/prisma.service';
import { effectiveSubscriptionTier } from '../subscriptions/subscription.constants';
import {
  addProDays,
  bangkokMonthStart,
  couponExpiresAt,
  COUPON_TTL_DAYS,
  generateReferralCode,
  INVITEE_BONUS_BANANAS,
  INVITEE_COUPON_PERCENT,
  normalizeReferralCode,
  RC_OFFERING_INVITE,
  REFERRAL_INVITE_V2_GRANT_SOURCE,
  REFERRAL_LINK_BASE,
  REFERRAL_PROGRAM_BANANA_V1,
  REFERRAL_PROGRAM_INVITE_V2,
  REFERRAL_REQUIRED_NODES,
  REFERRAL_SOURCES,
  type ReferralSource,
  REFERRER_MONTHLY_CAP_BANANAS,
  REFERRER_PRO_DAYS,
  REFERRER_REWARD_BANANAS,
} from './referrals.constants';

const FRIEND_LIST_LIMIT = 50;

@Injectable()
export class ReferralsService implements OnModuleInit {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly fcm: FcmService,
  ) {}

  onModuleInit() {
    this.economy.onLearnerProgress((userId) => this.checkQualification(userId));
  }

  async ensureCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (user.referralCode) return user.referralCode;
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateReferralCode();
      try {
        const updated = await this.prisma.user.updateMany({
          where: { id: userId, referralCode: null },
          data: { referralCode: code },
        });
        if (updated.count === 0) {
          const fresh = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { referralCode: true },
          });
          if (fresh.referralCode) return fresh.referralCode;
          continue;
        }
        return code;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Could not mint a unique referral code');
  }

  async getOverview(userId: string) {
    const code = await this.ensureCode(userId);
    const monthStart = bangkokMonthStart();
    const [sent, referredBy, monthEarned, ownCount] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' },
        take: FRIEND_LIST_LIMIT,
        include: {
          invitee: { select: { displayName: true, avatarId: true } },
        },
      }),
      this.prisma.referral.findUnique({
        where: { inviteeId: userId },
        select: { code: true },
      }),
      this.monthEarned(this.prisma, userId, monthStart),
      this.completedNodeCounts([userId]).then((m) => m.get(userId) ?? 0),
    ]);
    const progress = await this.completedNodeCounts(
      sent.filter((r) => r.status === 'pending').map((r) => r.inviteeId),
    );

    const friends = sent.map((r) => ({
      id: r.id,
      displayName: r.invitee.displayName,
      avatarId: r.invitee.avatarId,
      status: r.status,
      progress:
        r.status === 'pending'
          ? Math.min(progress.get(r.inviteeId) ?? 0, REFERRAL_REQUIRED_NODES)
          : REFERRAL_REQUIRED_NODES,
      requiredNodes: REFERRAL_REQUIRED_NODES,
      qualifiedAt: r.qualifiedAt?.toISOString() ?? null,
    }));
    const unseenRewards = sent
      .filter((r) => r.status === 'rewarded' && !r.rewardSeenAt)
      .map((r) => ({
        referralId: r.id,
        displayName: r.invitee.displayName,
        avatarId: r.invitee.avatarId,
        amount: REFERRER_REWARD_BANANAS,
      }));

    return {
      code,
      link: `${REFERRAL_LINK_BASE}${code}`,
      referrerReward: REFERRER_REWARD_BANANAS,
      inviteeBonus: INVITEE_BONUS_BANANAS,
      requiredNodes: REFERRAL_REQUIRED_NODES,
      monthEarned,
      monthCap: REFERRER_MONTHLY_CAP_BANANAS,
      referredByCode: referredBy?.code ?? null,
      canClaim: !referredBy && ownCount < REFERRAL_REQUIRED_NODES,
      friends,
      unseenRewards,
    };
  }

  async claim(userId: string, rawCode: string, rawSource?: string) {
    const code = normalizeReferralCode(rawCode);
    if (!code) throw new BadRequestException('invalid_code');
    const source: ReferralSource = (REFERRAL_SOURCES as readonly string[]).includes(
      rawSource ?? '',
    )
      ? (rawSource as ReferralSource)
      : 'manual';

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!referrer) throw new BadRequestException('invalid_code');
    if (referrer.id === userId) throw new BadRequestException('own_code');

    const done = (await this.completedNodeCounts([userId])).get(userId) ?? 0;
    if (done >= REFERRAL_REQUIRED_NODES) {
      throw new BadRequestException('not_eligible');
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const referral = await tx.referral.create({
          data: { referrerId: referrer.id, inviteeId: userId, code, source },
        });
        await tx.economyTransaction.create({
          data: {
            userId,
            currency: Currency.BANANA,
            amount: INVITEE_BONUS_BANANAS,
            source: 'referral_invitee_bonus',
            referenceId: `referral:${referral.id}`,
          },
        });
        return tx.user.update({
          where: { id: userId },
          data: { bananaBalance: { increment: INVITEE_BONUS_BANANAS } },
        });
      });
      return {
        ok: true,
        bonus: INVITEE_BONUS_BANANAS,
        balances: this.economy.toBalances(updated),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('already_claimed');
      }
      throw error;
    }
  }

  async markRewardsSeen(userId: string, referralIds?: string[]) {
    const result = await this.prisma.referral.updateMany({
      where: {
        referrerId: userId,
        status: 'rewarded',
        rewardSeenAt: null,
        ...(referralIds?.length ? { id: { in: referralIds } } : {}),
      },
      data: { rewardSeenAt: new Date() },
    });
    return { ok: true, updated: result.count };
  }

  /** Pays the referrer once the invitee has finished enough map nodes. */
  async checkQualification(inviteeId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { inviteeId },
    });
    if (!referral || referral.status !== 'pending') return;
    // Invite V2 rewards on purchase, not node progress.
    if (referral.program === REFERRAL_PROGRAM_INVITE_V2) return;

    const done = (await this.completedNodeCounts([inviteeId])).get(inviteeId) ?? 0;
    if (done < REFERRAL_REQUIRED_NODES) return;

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Serialises the monthly cap check per referrer.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${referral.referrerId}))`;
      const earned = await this.monthEarned(tx, referral.referrerId, bangkokMonthStart());
      const capped = earned + REFERRER_REWARD_BANANAS > REFERRER_MONTHLY_CAP_BANANAS;
      const claimed = await tx.referral.updateMany({
        where: { id: referral.id, status: 'pending' },
        data: {
          status: capped ? 'capped' : 'rewarded',
          qualifiedAt: new Date(),
        },
      });
      if (claimed.count === 0 || capped) return capped ? 'capped' : 'skipped';
      await tx.economyTransaction.create({
        data: {
          userId: referral.referrerId,
          currency: Currency.BANANA,
          amount: REFERRER_REWARD_BANANAS,
          source: 'referral_reward',
          referenceId: `referral:${referral.id}`,
        },
      });
      await tx.user.update({
        where: { id: referral.referrerId },
        data: { bananaBalance: { increment: REFERRER_REWARD_BANANAS } },
      });
      return 'rewarded';
    });

    if (outcome === 'rewarded') {
      await this.pushReward(referral.referrerId, inviteeId, referral.id);
    }
  }

  private async pushReward(referrerId: string, inviteeId: string, referralId: string) {
    try {
      const [referrer, invitee] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: referrerId },
          include: { fcmTokens: true },
        }),
        this.prisma.user.findUnique({
          where: { id: inviteeId },
          select: { displayName: true },
        }),
      ]);
      if (!referrer) return;
      const name = invitee?.displayName?.trim() || 'เพื่อนของคุณ';
      const invalid = await this.fcm.sendAndPersist({
        userId: referrerId,
        tokens: referrer.fcmTokens.map((t) => t.token),
        payload: {
          type: 'referral_reward',
          title: 'Banana English',
          body: `${name} เรียนครบ ${REFERRAL_REQUIRED_NODES} บทแล้ว! รับกล้วย ${REFERRER_REWARD_BANANAS} ลูกเลย`,
          data: { type: 'referral_reward', referralId, route: '/invite' },
        },
      });
      if (invalid.length) {
        await this.prisma.userFcmToken.deleteMany({
          where: { token: { in: invalid } },
        });
      }
    } catch (error) {
      this.logger.warn(`Referral push failed: ${String(error)}`);
    }
  }

  private async monthEarned(
    db: Prisma.TransactionClient | PrismaService,
    referrerId: string,
    monthStart: Date,
  ): Promise<number> {
    const agg = await db.economyTransaction.aggregate({
      where: {
        userId: referrerId,
        source: 'referral_reward',
        currency: Currency.BANANA,
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  /**
   * Admin dashboard. Default program is Invite V2 (`invite_v2`); pass
   * `banana_v1` for the legacy banana rewards cohort.
   */
  async adminReport(
    range: { from: Date; to: Date },
    program: string = REFERRAL_PROGRAM_INVITE_V2,
  ) {
    const prog =
      program === REFERRAL_PROGRAM_BANANA_V1
        ? REFERRAL_PROGRAM_BANANA_V1
        : REFERRAL_PROGRAM_INVITE_V2;
    if (prog === REFERRAL_PROGRAM_INVITE_V2) {
      return this.adminReportInviteV2(range);
    }
    return this.adminReportBananaV1(range);
  }

  /** Legacy banana invite: claim → 3 nodes → bananas. */
  private async adminReportBananaV1(range: { from: Date; to: Date }) {
    const inRange = { gte: range.from, lte: range.to };
    const program = REFERRAL_PROGRAM_BANANA_V1;
    const [cohort, qualified, payouts, codesIssued, allTime] = await Promise.all([
      this.prisma.referral.findMany({
        where: { createdAt: inRange, program },
        select: {
          id: true,
          referrerId: true,
          inviteeId: true,
          code: true,
          source: true,
          status: true,
          createdAt: true,
          qualifiedAt: true,
          referrer: { select: { displayName: true, email: true, avatarId: true } },
          invitee: { select: { displayName: true, email: true, avatarId: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.referral.findMany({
        where: { qualifiedAt: inRange, program },
        select: { status: true, qualifiedAt: true },
      }),
      this.prisma.economyTransaction.groupBy({
        by: ['source'],
        where: {
          source: { in: ['referral_reward', 'referral_invitee_bonus'] },
          currency: Currency.BANANA,
          createdAt: inRange,
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.user.count({ where: { referralCode: { not: null } } }),
      this.prisma.referral.groupBy({
        by: ['status'],
        where: { program },
        _count: { _all: true },
      }),
    ]);

    const progress = await this.completedNodeCounts(
      cohort.filter((r) => r.status === 'pending').map((r) => r.inviteeId),
    );

    const { days, claimsByDay, rewardedByDay } = this.adminDailyBuckets(
      range,
      cohort,
      qualified,
    );
    const { sourceMap, referrerMap } = this.adminAggregateCohort(cohort);

    const cohortRewarded = cohort.filter((r) => r.status === 'rewarded').length;
    const cohortCapped = cohort.filter((r) => r.status === 'capped').length;
    const payout = (source: string) =>
      payouts.find((p) => p.source === source)?._sum.amount ?? 0;
    const statusCount = (status: string) =>
      allTime.find((s) => s.status === status)?._count._all ?? 0;

    return {
      program: REFERRAL_PROGRAM_BANANA_V1,
      kpis: {
        claims: cohort.length,
        activeReferrers: referrerMap.size,
        qualified: cohortRewarded + cohortCapped,
        qualifyRate:
          cohort.length > 0
            ? Math.round(((cohortRewarded + cohortCapped) / cohort.length) * 1000) / 10
            : null,
        rewardedInRange: qualified.filter((r) => r.status === 'rewarded').length,
        cappedInRange: qualified.filter((r) => r.status === 'capped').length,
        referrerBananas: payout('referral_reward'),
        inviteeBananas: payout('referral_invitee_bonus'),
        codesIssued,
      },
      allTime: {
        pending: statusCount('pending'),
        rewarded: statusCount('rewarded'),
        capped: statusCount('capped'),
      },
      daily: days.map((day) => ({
        day,
        claims: claimsByDay.get(day) ?? 0,
        rewarded: rewardedByDay.get(day) ?? 0,
      })),
      bySource: [...sourceMap.values()].sort((a, b) => b.claims - a.claims),
      topReferrers: [...referrerMap.values()]
        .sort((a, b) => b.claims - a.claims || b.rewarded - a.rewarded)
        .slice(0, 30),
      recent: cohort.slice(0, 100).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
        source: r.source,
        status: r.status,
        code: r.code,
        progress:
          r.status === 'pending'
            ? Math.min(progress.get(r.inviteeId) ?? 0, REFERRAL_REQUIRED_NODES)
            : REFERRAL_REQUIRED_NODES,
        requiredNodes: REFERRAL_REQUIRED_NODES,
        referrer: { id: r.referrerId, ...r.referrer },
        invitee: { id: r.inviteeId, ...r.invitee },
      })),
    };
  }

  /** Invite V2: claim → 10% coupon → purchase → Pro 30d for referrer. */
  private async adminReportInviteV2(range: { from: Date; to: Date }) {
    const inRange = { gte: range.from, lte: range.to };
    const program = REFERRAL_PROGRAM_INVITE_V2;
    const now = new Date();
    const [cohort, qualified, purchasedInRange, codesIssued, allTime, couponRows] =
      await Promise.all([
        this.prisma.referral.findMany({
          where: { createdAt: inRange, program },
          select: {
            id: true,
            referrerId: true,
            inviteeId: true,
            code: true,
            source: true,
            status: true,
            createdAt: true,
            qualifiedAt: true,
            couponExpiresAt: true,
            couponUsedAt: true,
            inviteePurchasedAt: true,
            referrer: {
              select: { displayName: true, email: true, avatarId: true },
            },
            invitee: {
              select: { displayName: true, email: true, avatarId: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.referral.findMany({
          where: { qualifiedAt: inRange, program },
          select: { status: true, qualifiedAt: true },
        }),
        this.prisma.referral.findMany({
          where: { inviteePurchasedAt: inRange, program },
          select: { inviteePurchasedAt: true },
        }),
        this.prisma.user.count({ where: { referralCode: { not: null } } }),
        this.prisma.referral.groupBy({
          by: ['status'],
          where: { program },
          _count: { _all: true },
        }),
        this.prisma.referral.findMany({
          where: { program },
          select: {
            status: true,
            couponExpiresAt: true,
            couponUsedAt: true,
            inviteePurchasedAt: true,
          },
        }),
      ]);

    const { days, claimsByDay, rewardedByDay } = this.adminDailyBuckets(
      range,
      cohort,
      qualified,
    );
    const purchasedByDay = new Map(days.map((d) => [d, 0]));
    for (const r of purchasedInRange) {
      if (!r.inviteePurchasedAt) continue;
      const k = r.inviteePurchasedAt.toISOString().slice(0, 10);
      purchasedByDay.set(k, (purchasedByDay.get(k) ?? 0) + 1);
    }

    const { sourceMap, referrerMap } = this.adminAggregateCohort(cohort);
    const cohortPurchased = cohort.filter((r) => !!r.inviteePurchasedAt).length;
    const cohortRewarded = cohort.filter((r) => r.status === 'rewarded').length;
    const cohortClawed = cohort.filter((r) => r.status === 'capped').length;
    const statusCount = (status: string) =>
      allTime.find((s) => s.status === status)?._count._all ?? 0;

    let couponActive = 0;
    let couponUsed = 0;
    let couponExpired = 0;
    for (const r of couponRows) {
      if (r.couponUsedAt || r.inviteePurchasedAt) {
        couponUsed += 1;
        continue;
      }
      if (r.couponExpiresAt && r.couponExpiresAt.getTime() <= now.getTime()) {
        couponExpired += 1;
      } else if (r.status === 'pending') {
        couponActive += 1;
      }
    }

    return {
      program: REFERRAL_PROGRAM_INVITE_V2,
      kpis: {
        claims: cohort.length,
        activeReferrers: referrerMap.size,
        purchased: cohortPurchased,
        purchaseRate:
          cohort.length > 0
            ? Math.round((cohortPurchased / cohort.length) * 1000) / 10
            : null,
        rewardedInRange: qualified.filter((r) => r.status === 'rewarded').length,
        purchasedInRange: purchasedInRange.length,
        clawedInRange: qualified.filter((r) => r.status === 'capped').length,
        referrerProDays: cohortRewarded * REFERRER_PRO_DAYS,
        couponPercent: INVITEE_COUPON_PERCENT,
        referrerRewardDays: REFERRER_PRO_DAYS,
        codesIssued,
        couponActive,
        couponUsed,
        couponExpired,
        clawedAllTime: statusCount('capped'),
      },
      allTime: {
        pending: statusCount('pending'),
        rewarded: statusCount('rewarded'),
        capped: statusCount('capped'),
        couponActive,
        couponUsed,
        couponExpired,
      },
      daily: days.map((day) => ({
        day,
        claims: claimsByDay.get(day) ?? 0,
        purchased: purchasedByDay.get(day) ?? 0,
        rewarded: rewardedByDay.get(day) ?? 0,
      })),
      bySource: [...sourceMap.values()].sort((a, b) => b.claims - a.claims),
      topReferrers: [...referrerMap.values()]
        .sort((a, b) => b.claims - a.claims || b.rewarded - a.rewarded)
        .slice(0, 30)
        .map((r) => ({
          ...r,
          proDaysEarned: r.rewarded * REFERRER_PRO_DAYS,
        })),
      recent: cohort.slice(0, 100).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
        inviteePurchasedAt: r.inviteePurchasedAt,
        couponExpiresAt: r.couponExpiresAt,
        couponUsedAt: r.couponUsedAt,
        source: r.source,
        status: r.status,
        code: r.code,
        couponState: !r.couponUsedAt &&
          !r.inviteePurchasedAt &&
          r.couponExpiresAt &&
          r.couponExpiresAt.getTime() > now.getTime()
          ? 'active'
          : r.couponUsedAt || r.inviteePurchasedAt
            ? 'used'
            : r.couponExpiresAt && r.couponExpiresAt.getTime() <= now.getTime()
              ? 'expired'
              : 'none',
        referrer: { id: r.referrerId, ...r.referrer },
        invitee: { id: r.inviteeId, ...r.invitee },
      })),
    };
  }

  private adminDailyBuckets(
    range: { from: Date; to: Date },
    cohort: { createdAt: Date }[],
    qualified: { status: string; qualifiedAt: Date | null }[],
  ) {
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const days: string[] = [];
    for (
      let t = Date.UTC(
        range.from.getUTCFullYear(),
        range.from.getUTCMonth(),
        range.from.getUTCDate(),
      );
      t <= range.to.getTime();
      t += 86_400_000
    ) {
      days.push(dayKey(new Date(t)));
    }
    const claimsByDay = new Map(days.map((d) => [d, 0]));
    const rewardedByDay = new Map(days.map((d) => [d, 0]));
    for (const r of cohort) {
      const k = dayKey(r.createdAt);
      claimsByDay.set(k, (claimsByDay.get(k) ?? 0) + 1);
    }
    for (const r of qualified) {
      if (r.status !== 'rewarded' || !r.qualifiedAt) continue;
      const k = dayKey(r.qualifiedAt);
      rewardedByDay.set(k, (rewardedByDay.get(k) ?? 0) + 1);
    }
    return { days, claimsByDay, rewardedByDay };
  }

  private adminAggregateCohort(
    cohort: {
      source: string;
      status: string;
      referrerId: string;
      code: string;
      referrer: {
        displayName: string | null;
        email: string | null;
        avatarId: string | null;
      };
    }[],
  ) {
    const sourceMap = new Map<
      string,
      { source: string; claims: number; rewarded: number; capped: number }
    >();
    const referrerMap = new Map<
      string,
      {
        referrerId: string;
        displayName: string | null;
        email: string | null;
        avatarId: string | null;
        code: string;
        claims: number;
        rewarded: number;
        capped: number;
      }
    >();
    for (const r of cohort) {
      const s = sourceMap.get(r.source) ?? {
        source: r.source,
        claims: 0,
        rewarded: 0,
        capped: 0,
      };
      s.claims += 1;
      if (r.status === 'rewarded') s.rewarded += 1;
      if (r.status === 'capped') s.capped += 1;
      sourceMap.set(r.source, s);

      const ref = referrerMap.get(r.referrerId) ?? {
        referrerId: r.referrerId,
        displayName: r.referrer.displayName,
        email: r.referrer.email,
        avatarId: r.referrer.avatarId,
        code: r.code,
        claims: 0,
        rewarded: 0,
        capped: 0,
      };
      ref.claims += 1;
      if (r.status === 'rewarded') ref.rewarded += 1;
      if (r.status === 'capped') ref.capped += 1;
      referrerMap.set(r.referrerId, ref);
    }
    return { sourceMap, referrerMap };
  }

  // ── Invite V2 (coupon + Pro days) ─────────────────────────────────────

  isInviteV2Enabled(): boolean {
    const raw = (process.env.INVITE_V2_ENABLED ?? 'true').trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'off';
  }

  async getOverviewV2(userId: string) {
    const code = await this.ensureCode(userId);
    const now = new Date();
    const [sent, referredBy, me] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerId: userId, program: REFERRAL_PROGRAM_INVITE_V2 },
        orderBy: { createdAt: 'desc' },
        take: FRIEND_LIST_LIMIT,
        include: {
          invitee: { select: { displayName: true, avatarId: true } },
        },
      }),
      this.prisma.referral.findUnique({
        where: { inviteeId: userId },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          subscriptionTier: true,
          subscriptionExpiresAt: true,
        },
      }),
    ]);

    const coupon = this.couponPayload(referredBy, now);
    const activePaid =
      effectiveSubscriptionTier(me) !== 'FREE' &&
      !!me.subscriptionExpiresAt &&
      me.subscriptionExpiresAt.getTime() > now.getTime();

    const friends = sent.map((r) => ({
      id: r.id,
      displayName: r.invitee.displayName,
      avatarId: r.invitee.avatarId,
      status: r.status,
      purchased: !!r.inviteePurchasedAt,
      purchasedAt: r.inviteePurchasedAt?.toISOString() ?? null,
      rewardedAt: r.qualifiedAt?.toISOString() ?? null,
    }));

    const unseenRewards = sent
      .filter((r) => r.status === 'rewarded' && !r.rewardSeenAt)
      .map((r) => ({
        referralId: r.id,
        displayName: r.invitee.displayName,
        avatarId: r.invitee.avatarId,
        proDays: REFERRER_PRO_DAYS,
      }));

    return {
      program: REFERRAL_PROGRAM_INVITE_V2,
      code,
      link: `${REFERRAL_LINK_BASE}${code}`,
      referrerRewardDays: REFERRER_PRO_DAYS,
      inviteeCouponPercent: INVITEE_COUPON_PERCENT,
      couponTtlDays: COUPON_TTL_DAYS,
      offeringId: RC_OFFERING_INVITE,
      referredByCode: referredBy?.code ?? null,
      canClaim: !referredBy && !activePaid,
      coupon,
      friends,
      unseenRewards,
    };
  }

  async claimV2(userId: string, rawCode: string, rawSource?: string) {
    const code = normalizeReferralCode(rawCode);
    if (!code) throw new BadRequestException('invalid_code');
    const source: ReferralSource = (REFERRAL_SOURCES as readonly string[]).includes(
      rawSource ?? '',
    )
      ? (rawSource as ReferralSource)
      : 'manual';

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!referrer) throw new BadRequestException('invalid_code');
    if (referrer.id === userId) throw new BadRequestException('own_code');

    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionTier: true, subscriptionExpiresAt: true },
    });
    const now = new Date();
    const activePaid =
      effectiveSubscriptionTier(me) !== 'FREE' &&
      !!me.subscriptionExpiresAt &&
      me.subscriptionExpiresAt.getTime() > now.getTime();
    if (activePaid) throw new BadRequestException('not_eligible');

    try {
      const expires = couponExpiresAt(now);
      const referral = await this.prisma.referral.create({
        data: {
          referrerId: referrer.id,
          inviteeId: userId,
          code,
          source,
          program: REFERRAL_PROGRAM_INVITE_V2,
          couponExpiresAt: expires,
        },
      });
      return {
        ok: true,
        program: REFERRAL_PROGRAM_INVITE_V2,
        couponPercent: INVITEE_COUPON_PERCENT,
        couponExpiresAt: expires.toISOString(),
        offeringId: RC_OFFERING_INVITE,
        referralId: referral.id,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('already_claimed');
      }
      throw error;
    }
  }

  async markRewardsSeenV2(userId: string, referralIds?: string[]) {
    const result = await this.prisma.referral.updateMany({
      where: {
        referrerId: userId,
        program: REFERRAL_PROGRAM_INVITE_V2,
        status: 'rewarded',
        rewardSeenAt: null,
        ...(referralIds?.length ? { id: { in: referralIds } } : {}),
      },
      data: { rewardSeenAt: new Date() },
    });
    return { ok: true, updated: result.count };
  }

  /**
   * After invitee’s first paid membership period is applied: consume coupon
   * and grant the referrer Pro days (idempotent per referral).
   */
  async onInviteeMembershipPurchase(inviteeId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { inviteeId },
    });
    if (!referral || referral.program !== REFERRAL_PROGRAM_INVITE_V2) return;
    if (referral.referrerGrantId) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.referral.findUnique({ where: { id: referral.id } });
      if (!locked || locked.referrerGrantId) return;
      if (locked.program !== REFERRAL_PROGRAM_INVITE_V2) return;

      await tx.referral.update({
        where: { id: locked.id },
        data: {
          couponUsedAt: locked.couponUsedAt ?? now,
          inviteePurchasedAt: locked.inviteePurchasedAt ?? now,
        },
      });

      const referrer = await tx.user.findUnique({ where: { id: locked.referrerId } });
      if (!referrer) return;

      const active =
        effectiveSubscriptionTier(referrer) !== 'FREE' &&
        !!referrer.subscriptionExpiresAt &&
        referrer.subscriptionExpiresAt.getTime() > now.getTime();
      const base = active && referrer.subscriptionExpiresAt
        ? referrer.subscriptionExpiresAt
        : now;
      const expiresAt = addProDays(base, REFERRER_PRO_DAYS);
      const tier =
        active && referrer.subscriptionTier === SubscriptionTier.PRO_MAX
          ? SubscriptionTier.PRO_MAX
          : SubscriptionTier.PRO;

      const grant = await tx.subscriptionGrant.create({
        data: {
          userId: referrer.id,
          tier,
          startsAt: now,
          expiresAt,
          source: REFERRAL_INVITE_V2_GRANT_SOURCE,
          note: `referral:${locked.id}`,
        },
      });

      await tx.user.update({
        where: { id: referrer.id },
        data: {
          subscriptionTier: tier,
          subscriptionExpiresAt: expiresAt,
        },
      });

      await tx.referral.update({
        where: { id: locked.id },
        data: {
          status: 'rewarded',
          qualifiedAt: now,
          referrerGrantId: grant.id,
        },
      });
    });

    const refreshed = await this.prisma.referral.findUnique({
      where: { id: referral.id },
      select: { status: true, referrerId: true },
    });
    if (refreshed?.status === 'rewarded') {
      await this.pushInviteV2Reward(refreshed.referrerId, inviteeId, referral.id);
    }
  }

  /**
   * Invitee refund / early expiry: pull back the referrer’s Pro grant by
   * REFERRER_PRO_DAYS when that grant is still the active expiry tip.
   */
  async onInviteeMembershipRefund(inviteeId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { inviteeId },
    });
    if (
      !referral ||
      referral.program !== REFERRAL_PROGRAM_INVITE_V2 ||
      !referral.referrerGrantId
    ) {
      return;
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const grant = await tx.subscriptionGrant.findUnique({
        where: { id: referral.referrerGrantId! },
      });
      if (!grant || grant.source !== REFERRAL_INVITE_V2_GRANT_SOURCE) return;

      const shortened = new Date(
        grant.expiresAt.getTime() - REFERRER_PRO_DAYS * 86_400_000,
      );
      const newExpires =
        shortened.getTime() > grant.startsAt.getTime() ? shortened : grant.startsAt;

      await tx.subscriptionGrant.update({
        where: { id: grant.id },
        data: { expiresAt: newExpires, note: `${grant.note ?? ''}|clawback` },
      });

      const referrer = await tx.user.findUnique({ where: { id: grant.userId } });
      if (
        referrer?.subscriptionExpiresAt &&
        referrer.subscriptionExpiresAt.getTime() === grant.expiresAt.getTime()
      ) {
        const stillActive = newExpires.getTime() > now.getTime();
        await tx.user.update({
          where: { id: referrer.id },
          data: stillActive
            ? { subscriptionExpiresAt: newExpires }
            : {
                subscriptionTier: SubscriptionTier.FREE,
                subscriptionExpiresAt: null,
              },
        });
      }

      await tx.referral.update({
        where: { id: referral.id },
        data: { status: 'capped' },
      });
    });
  }

  private couponPayload(
    referral: {
      program: string;
      couponExpiresAt: Date | null;
      couponUsedAt: Date | null;
    } | null,
    now: Date,
  ) {
    if (!referral || referral.program !== REFERRAL_PROGRAM_INVITE_V2) {
      return {
        active: false,
        percent: INVITEE_COUPON_PERCENT,
        offeringId: RC_OFFERING_INVITE,
        expiresAt: null as string | null,
        usedAt: null as string | null,
      };
    }
    const expiresAt = referral.couponExpiresAt;
    const used = !!referral.couponUsedAt;
    const expired = !!expiresAt && expiresAt.getTime() <= now.getTime();
    return {
      active: !used && !expired && !!expiresAt,
      percent: INVITEE_COUPON_PERCENT,
      offeringId: RC_OFFERING_INVITE,
      expiresAt: expiresAt?.toISOString() ?? null,
      usedAt: referral.couponUsedAt?.toISOString() ?? null,
    };
  }

  private async pushInviteV2Reward(
    referrerId: string,
    inviteeId: string,
    referralId: string,
  ) {
    try {
      const [referrer, invitee] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: referrerId },
          include: { fcmTokens: true },
        }),
        this.prisma.user.findUnique({
          where: { id: inviteeId },
          select: { displayName: true },
        }),
      ]);
      if (!referrer) return;
      const name = invitee?.displayName?.trim() || 'เพื่อนของคุณ';
      const invalid = await this.fcm.sendAndPersist({
        userId: referrerId,
        tokens: referrer.fcmTokens.map((t) => t.token),
        payload: {
          type: 'referral_reward',
          title: 'Banana English',
          body: `${name} ซื้อสมาชิกแล้ว! คุณได้ Pro ฟรี ${REFERRER_PRO_DAYS} วัน`,
          data: { type: 'referral_reward', referralId, route: '/invite' },
        },
      });
      if (invalid.length) {
        await this.prisma.userFcmToken.deleteMany({
          where: { token: { in: invalid } },
        });
      }
    } catch (error) {
      this.logger.warn(`Invite V2 push failed: ${String(error)}`);
    }
  }

  /** Distinct finished map nodes: rewarded mini-games + rewarded lessons / conversations. */
  private async completedNodeCounts(userIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (userIds.length === 0) return counts;
    const [miniGames, sessions] = await Promise.all([
      this.prisma.economyTransaction.groupBy({
        by: ['userId', 'referenceId'],
        where: {
          userId: { in: userIds },
          source: 'mini_game_reward',
          currency: Currency.XP,
        },
      }),
      this.prisma.userSession.groupBy({
        by: ['userId', 'lessonId', 'simulationId'],
        where: {
          userId: { in: userIds },
          rewardsApplied: true,
          sessionType: { in: ['training', 'simulation'] },
          OR: [{ lessonId: { not: null } }, { simulationId: { not: null } }],
        },
      }),
    ]);
    for (const row of [...miniGames, ...sessions]) {
      counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
    }
    return counts;
  }
}
