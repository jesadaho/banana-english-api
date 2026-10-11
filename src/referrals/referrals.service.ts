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
