import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { FcmService } from '../notifications/fcm.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  bangkokMonthStart,
  generateReferralCode,
  INVITEE_BONUS_BANANAS,
  normalizeReferralCode,
  REFERRAL_LINK_BASE,
  REFERRAL_REQUIRED_NODES,
  REFERRAL_SOURCES,
  type ReferralSource,
  REFERRER_MONTHLY_CAP_BANANAS,
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

  /** Admin dashboard: claims cohort in range, payouts, sources, top referrers. */
  async adminReport(range: { from: Date; to: Date }) {
    const inRange = { gte: range.from, lte: range.to };
    const [cohort, qualified, payouts, codesIssued, allTime] = await Promise.all([
      this.prisma.referral.findMany({
        where: { createdAt: inRange },
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
        where: { qualifiedAt: inRange },
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
      this.prisma.referral.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const progress = await this.completedNodeCounts(
      cohort.filter((r) => r.status === 'pending').map((r) => r.inviteeId),
    );

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

    const cohortRewarded = cohort.filter((r) => r.status === 'rewarded').length;
    const cohortCapped = cohort.filter((r) => r.status === 'capped').length;
    const payout = (source: string) =>
      payouts.find((p) => p.source === source)?._sum.amount ?? 0;
    const statusCount = (status: string) =>
      allTime.find((s) => s.status === status)?._count._all ?? 0;

    return {
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
