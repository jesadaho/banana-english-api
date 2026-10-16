import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SubscriptionTier, User } from '@prisma/client';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { BeamClient } from './beam.client';
import {
  addYears,
  beamSignatureMatches,
  effectiveSubscriptionTier,
  FOUNDER_PRESALE_CLOSES_AT,
  FOUNDER_PRESALE_PRICE_THB,
  FOUNDER_PRESALE_SEATS,
  FOUNDER_PRESALE_YEARS,
  PRESALE_QR_TTL_MS,
  SubscriptionTierName,
} from './subscription.constants';

const PAID = 'paid';
const PENDING = 'pending_payment';
const EXPIRED = 'expired';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly beam: BeamClient,
  ) {}

  async grant(params: {
    userId: string;
    tier: 'PRO' | 'PRO_MAX';
    expiresAt: Date;
    source: string;
    note?: string;
    priceThb?: number;
  }): Promise<User> {
    if (params.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Expiry must be in the future');
    }
    const tier = params.tier as SubscriptionTier;
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: params.userId } });
      if (!user) throw new NotFoundException('User not found');
      await tx.subscriptionGrant.create({
        data: {
          userId: user.id,
          tier,
          startsAt: new Date(),
          expiresAt: params.expiresAt,
          source: params.source,
          note: params.note?.trim() || null,
          priceThb: params.priceThb ?? null,
        },
      });
      return tx.user.update({
        where: { id: user.id },
        data: {
          subscriptionTier: tier,
          subscriptionExpiresAt: params.expiresAt,
        },
      });
    });
  }

  async revoke(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: SubscriptionTier.FREE, subscriptionExpiresAt: null },
    });
  }

  async adminReport() {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 86_400_000);
    const activeWhere = {
      subscriptionTier: { not: SubscriptionTier.FREE },
      subscriptionExpiresAt: { gt: now },
    };
    const [pro, proMax, expiringSoon, paidOrders, grants, orders] = await Promise.all([
      this.prisma.user.count({
        where: { ...activeWhere, subscriptionTier: SubscriptionTier.PRO },
      }),
      this.prisma.user.count({
        where: { ...activeWhere, subscriptionTier: SubscriptionTier.PRO_MAX },
      }),
      this.prisma.user.count({
        where: {
          ...activeWhere,
          subscriptionExpiresAt: { gt: now, lte: soon },
        },
      }),
      this.prisma.presaleOrder.findMany({
        where: { status: PAID },
        select: { priceThb: true },
      }),
      this.prisma.subscriptionGrant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, displayName: true, email: true } } },
      }),
      this.prisma.presaleOrder.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, displayName: true, email: true } } },
      }),
    ]);
    const presaleRevenueThb = paidOrders.reduce((sum, row) => sum + row.priceThb, 0);
    return {
      kpis: {
        pro,
        proMax,
        expiringSoon,
        presalePaid: paidOrders.length,
        presaleRevenueThb,
        seatsRemaining: Math.max(0, FOUNDER_PRESALE_SEATS - paidOrders.length),
        seatCap: FOUNDER_PRESALE_SEATS,
      },
      grants: grants.map((row) => ({
        id: row.id,
        userId: row.userId,
        displayName: row.user.displayName,
        email: row.user.email,
        tier: row.tier,
        startsAt: row.startsAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        source: row.source,
        note: row.note,
        priceThb: row.priceThb,
        createdAt: row.createdAt.toISOString(),
      })),
      orders: orders.map((row) => ({
        id: row.id,
        userId: row.userId,
        displayName: row.user.displayName,
        email: row.user.email,
        tier: row.tier,
        priceThb: row.priceThb,
        status: row.status,
        beamChargeId: row.beamChargeId,
        createdAt: row.createdAt.toISOString(),
        paidAt: row.paidAt?.toISOString() ?? null,
      })),
    };
  }

  async searchForAdmin(queryRaw?: string) {
    const query = queryRaw?.trim() ?? '';
    if (query.length < 2) {
      throw new BadRequestException('Search needs at least 2 characters');
    }
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: query },
          { firebaseUid: query },
          { anonymousId: query },
          { email: { equals: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        firebaseUid: true,
        bananaBalance: true,
        subscriptionTier: true,
        subscriptionExpiresAt: true,
      },
    });
    return { users: users.map((user) => this.adminUserSummary(user)) };
  }

  async userInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        firebaseUid: true,
        anonymousId: true,
        bananaBalance: true,
        freeBananaBalance: true,
        xpBalance: true,
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        createdAt: true,
        lastAppOpenDate: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const grants = await this.prisma.subscriptionGrant.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      user: {
        ...this.adminUserSummary(user),
        anonymousId: user.anonymousId,
        freeBananaBalance: user.freeBananaBalance,
        xpBalance: user.xpBalance,
        createdAt: user.createdAt.toISOString(),
        lastAppOpenDate: user.lastAppOpenDate?.toISOString() ?? null,
      },
      grants: grants.map((row) => ({
        id: row.id,
        tier: row.tier,
        startsAt: row.startsAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        source: row.source,
        note: row.note,
        priceThb: row.priceThb,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private adminUserSummary(user: {
    id: string;
    displayName: string | null;
    email: string | null;
    firebaseUid: string | null;
    bananaBalance: number;
    subscriptionTier: string;
    subscriptionExpiresAt: Date | null;
  }) {
    const now = new Date();
    const paid = user.subscriptionTier === 'PRO' || user.subscriptionTier === 'PRO_MAX';
    const active = paid && !!user.subscriptionExpiresAt && user.subscriptionExpiresAt > now;
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      firebaseUid: user.firebaseUid,
      bananaBalance: user.bananaBalance,
      subscriptionTier: user.subscriptionTier,
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      subscriptionStatus: active ? 'active' : paid ? 'expired' : 'free',
    };
  }

  async publicStatus() {
    const sold = await this.prisma.presaleOrder.count({ where: { status: PAID } });
    return {
      sold,
      cap: FOUNDER_PRESALE_SEATS,
      remaining: Math.max(0, FOUNDER_PRESALE_SEATS - sold),
      priceThb: FOUNDER_PRESALE_PRICE_THB,
      closesAt: FOUNDER_PRESALE_CLOSES_AT.toISOString(),
    };
  }

  async createPresaleOrder(idToken: string) {
    const uid = await this.uidFromToken(idToken);
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (!user) {
      throw new BadRequestException({
        code: 'NO_APP_ACCOUNT',
        message: 'เปิดแอป Banana English ก่อน แล้วสมัครด้วย Google บัญชีเดียวกัน',
      });
    }
    if (Date.now() >= FOUNDER_PRESALE_CLOSES_AT.getTime()) {
      throw new BadRequestException({ code: 'SALE_CLOSED', message: 'ปิดการขายแล้ว' });
    }
    const active = effectiveSubscriptionTier(user);
    if (active === 'PRO_MAX') {
      return {
        alreadyActive: true,
        orderId: null,
        status: PAID,
        qrImageBase64: null,
        priceThb: FOUNDER_PRESALE_PRICE_THB,
        expiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      };
    }

    await this.expireStaleOrders(user.id);
    const reusable = await this.prisma.presaleOrder.findFirst({
      where: {
        userId: user.id,
        status: PENDING,
        createdAt: { gt: new Date(Date.now() - PRESALE_QR_TTL_MS) },
        qrImageBase64: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (reusable) return this.orderPayload(reusable);

    const sold = await this.prisma.presaleOrder.count({ where: { status: PAID } });
    if (sold >= FOUNDER_PRESALE_SEATS) {
      throw new BadRequestException({ code: 'SOLD_OUT', message: 'สิทธิ์ Founder ครบ 30 ที่แล้ว' });
    }

    const order = await this.prisma.presaleOrder.create({
      data: {
        userId: user.id,
        tier: SubscriptionTier.PRO_MAX,
        priceThb: FOUNDER_PRESALE_PRICE_THB,
        status: PENDING,
      },
    });
    const expiresAt = new Date(Date.now() + PRESALE_QR_TTL_MS);
    const charge = await this.beam.createPromptPayCharge({
      amountSatang: FOUNDER_PRESALE_PRICE_THB * 100,
      referenceId: order.id,
      expiresAt,
    });
    const saved = await this.prisma.presaleOrder.update({
      where: { id: order.id },
      data: { beamChargeId: charge.chargeId, qrImageBase64: charge.qrImageBase64 },
    });
    return this.orderPayload(saved);
  }

  async presaleOrderForToken(orderId: string, idToken: string) {
    const uid = await this.uidFromToken(idToken);
    const order = await this.prisma.presaleOrder.findUnique({
      where: { id: orderId },
      include: { user: true },
    });
    if (!order || order.user.firebaseUid !== uid) {
      throw new NotFoundException('Order not found');
    }
    if (order.status === PENDING && order.beamChargeId) {
      const synced = await this.syncPaidCharge(order);
      if (synced) return this.orderPayload(synced);
    }
    if (order.status === PENDING && this.isStale(order.createdAt)) {
      const expired = await this.prisma.presaleOrder.update({
        where: { id: order.id },
        data: { status: EXPIRED },
      });
      return this.orderPayload(expired);
    }
    return this.orderPayload(order);
  }

  async handleBeamWebhook(rawBody: Buffer, signature: string | undefined, event: string | undefined) {
    const secret = this.beam.webhookSecret();
    if (!secret || !beamSignatureMatches(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid Beam signature');
    }
    if (event !== 'charge.succeeded') return { ok: true, ignored: true };
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      referenceId?: string;
      status?: string;
      amount?: number;
      chargeId?: string;
    };
    if (payload.status !== 'SUCCEEDED' || !payload.referenceId) {
      return { ok: true, ignored: true };
    }
    const amount = payload.amount ?? 0;
    const expectedSatang = FOUNDER_PRESALE_PRICE_THB * 100;
    if (amount !== expectedSatang && amount !== FOUNDER_PRESALE_PRICE_THB) {
      return { ok: true, ignored: true };
    }
    await this.markOrderPaid(payload.referenceId, payload.chargeId);
    return { ok: true };
  }

  private async markOrderPaid(orderId: string, beamChargeId?: string) {
    const order = await this.prisma.presaleOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status === PAID) return;
    if (order.status !== PENDING && order.status !== EXPIRED) return;
    await this.prisma.presaleOrder.update({
      where: { id: order.id },
      data: {
        status: PAID,
        paidAt: new Date(),
        ...(beamChargeId ? { beamChargeId } : {}),
      },
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: order.userId } });
    const now = new Date();
    const base =
      effectiveSubscriptionTier(user, now) === 'PRO_MAX' &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt > now
        ? user.subscriptionExpiresAt
        : now;
    await this.grant({
      userId: user.id,
      tier: 'PRO_MAX',
      expiresAt: addYears(base, FOUNDER_PRESALE_YEARS),
      source: 'founder_presale',
      priceThb: order.priceThb,
      note: order.id,
    });
  }

  private async syncPaidCharge(order: {
    id: string;
    beamChargeId: string | null;
    status: string;
  }) {
    if (!order.beamChargeId) return null;
    const charge = await this.beam.getCharge(order.beamChargeId).catch(() => null);
    if (!charge || charge.status !== 'SUCCEEDED') return null;
    if (charge.referenceId !== order.id) return null;
    const expectedSatang = FOUNDER_PRESALE_PRICE_THB * 100;
    if (charge.amount !== expectedSatang && charge.amount !== FOUNDER_PRESALE_PRICE_THB) {
      return null;
    }
    await this.markOrderPaid(order.id, order.beamChargeId);
    return this.prisma.presaleOrder.findUnique({ where: { id: order.id } });
  }

  private async expireStaleOrders(userId: string) {
    await this.prisma.presaleOrder.updateMany({
      where: {
        userId,
        status: PENDING,
        createdAt: { lte: new Date(Date.now() - PRESALE_QR_TTL_MS) },
      },
      data: { status: EXPIRED },
    });
  }

  private isStale(createdAt: Date): boolean {
    return Date.now() - createdAt.getTime() > PRESALE_QR_TTL_MS;
  }

  private orderPayload(order: {
    id: string;
    status: string;
    qrImageBase64: string | null;
    priceThb: number;
    createdAt: Date;
  }) {
    return {
      alreadyActive: false,
      orderId: order.id,
      status: order.status,
      qrImageBase64: order.status === PENDING ? order.qrImageBase64 : null,
      priceThb: order.priceThb,
      expiresAt: new Date(order.createdAt.getTime() + PRESALE_QR_TTL_MS).toISOString(),
    };
  }

  private async uidFromToken(idToken: string): Promise<string> {
    const trimmed = idToken.trim();
    if (!trimmed) throw new UnauthorizedException('Missing Firebase token');
    try {
      const decoded = await this.firebase.verifyIdToken(trimmed);
      return decoded.uid;
    } catch {
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }
}

export function subscriptionPayload(user: User, now = new Date()): {
  tier: SubscriptionTierName;
  expiresAt: string | null;
} {
  const tier = effectiveSubscriptionTier(user, now);
  return {
    tier,
    expiresAt: tier === 'FREE' ? null : user.subscriptionExpiresAt?.toISOString() ?? null,
  };
}
