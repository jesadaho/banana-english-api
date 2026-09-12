import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../prisma/prisma.service';
import { bananasForProduct, isKnownBananaPack } from '../purchases/product-catalog';
import { PurchasesService } from '../purchases/purchases.service';
import { RevenueCatClient } from '../purchases/revenuecat.client';

const SEARCH_TAKE = 20;
const LEDGER_TAKE = 200;
const PURCHASE_TAKE = 50;
const ALL_PURCHASES_TAKE = 200;
const RC_SCAN_USER_TAKE = 80;
const RC_SCAN_CONCURRENCY = 8;
const RC_SCAN_TTL_MS = 90_000;

type LedgerPurchaseRow = {
  id: string;
  productId: string;
  storeTransactionId: string;
  bananasGranted: number;
  platform: string | null;
  createdAt: string;
  claimed: boolean;
  source: 'db' | 'revenuecat';
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    firebaseUid: string | null;
  };
};

@Injectable()
export class AdminLedgerService {
  private purchaseCache:
    | { expiresAt: number; payload: { count: number; purchases: LedgerPurchaseRow[] } }
    | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly purchases: PurchasesService,
    private readonly revenueCat: RevenueCatClient,
  ) {}

  async searchUsers(queryRaw?: string) {
    const query = queryRaw?.trim() ?? '';
    if (query.length < 2) {
      throw new BadRequestException('Search needs at least 2 characters');
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: query },
          { firebaseUid: query },
          { email: { equals: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: SEARCH_TAKE,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        firebaseUid: true,
        bananaBalance: true,
        freeBananaBalance: true,
        updatedAt: true,
      },
    });

    return { users: users.map((user) => this.toUserSummary(user)) };
  }

  async listPurchases() {
    if (this.purchaseCache && this.purchaseCache.expiresAt > Date.now()) {
      return this.purchaseCache.payload;
    }

    const rows = await this.prisma.purchaseRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: ALL_PURCHASES_TAKE,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            firebaseUid: true,
          },
        },
      },
    });

    const claimed = new Map<string, LedgerPurchaseRow>();
    for (const row of rows) {
      claimed.set(row.storeTransactionId, {
        id: row.id,
        productId: row.productId,
        storeTransactionId: row.storeTransactionId,
        bananasGranted: row.bananasGranted,
        platform: row.platform,
        createdAt: row.createdAt.toISOString(),
        claimed: true,
        source: 'db',
        user: {
          id: row.user.id,
          displayName: row.user.displayName,
          email: row.user.email,
          firebaseUid: row.user.firebaseUid,
        },
      });
    }

    const since = new Date(Date.now() - 21 * 86_400_000);
    const recentUsers = await this.prisma.user.findMany({
      where: {
        firebaseUid: { not: null },
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: 'desc' },
      take: RC_SCAN_USER_TAKE,
      select: {
        id: true,
        displayName: true,
        email: true,
        firebaseUid: true,
      },
    });

    const extras: LedgerPurchaseRow[] = [];
    if (this.revenueCat.secretKey()) {
      await this.mapPool(recentUsers, RC_SCAN_CONCURRENCY, async (user) => {
        const uid = user.firebaseUid;
        if (!uid) return;
        const packs = await this.revenueCat.listBananaPackPurchases(uid);
        for (const pack of packs) {
          if (claimed.has(pack.storeTransactionId)) continue;
          extras.push({
            id: `rc:${pack.storeTransactionId}`,
            productId: pack.productId,
            storeTransactionId: pack.storeTransactionId,
            bananasGranted: bananasForProduct(pack.productId) ?? 0,
            platform: null,
            createdAt: pack.purchasedAt ?? new Date().toISOString(),
            claimed: false,
            source: 'revenuecat',
            user: {
              id: user.id,
              displayName: user.displayName,
              email: user.email,
              firebaseUid: user.firebaseUid,
            },
          });
        }
      });
    }

    const purchases = [...claimed.values(), ...extras].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const payload = { count: purchases.length, purchases };
    this.purchaseCache = { expiresAt: Date.now() + RC_SCAN_TTL_MS, payload };
    return payload;
  }

  private async mapPool<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>,
  ): Promise<void> {
    let index = 0;
    const worker = async () => {
      while (index < items.length) {
        const current = items[index];
        index += 1;
        if (current !== undefined) await fn(current);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () =>
        worker(),
      ),
    );
  }

  async getLedger(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        firebaseUid: true,
        bananaBalance: true,
        freeBananaBalance: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [transactions, purchases] = await Promise.all([
      this.prisma.economyTransaction.findMany({
        where: { userId, currency: 'BANANA' },
        orderBy: { createdAt: 'desc' },
        take: LEDGER_TAKE,
      }),
      this.prisma.purchaseRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: PURCHASE_TAKE,
      }),
    ]);

    return {
      user: this.toUserSummary(user),
      purchases: purchases.map((row) => ({
        id: row.id,
        productId: row.productId,
        storeTransactionId: row.storeTransactionId,
        bananasGranted: row.bananasGranted,
        platform: row.platform,
        createdAt: row.createdAt.toISOString(),
      })),
      transactions: transactions.map((row) => ({
        id: row.id,
        amount: row.amount,
        source: row.source,
        referenceId: row.referenceId,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async creditBananas(
    userId: string,
    body: {
      bananas?: number;
      storeTransactionId?: string;
      productId?: string;
      platform?: string;
      note: string;
    },
    adminEmail: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const note = body.note.trim();
    const storeTransactionId = body.storeTransactionId?.trim();
    this.purchaseCache = null;

    if (storeTransactionId) {
      const productId = body.productId?.trim() || 'banana_tickets_28';
      if (!isKnownBananaPack(productId)) {
        throw new BadRequestException('Unknown product');
      }
      const claim = await this.purchases.claimPurchase(user, {
        productId,
        storeTransactionId,
        platform: body.platform?.trim() || 'android',
        verifiedExternally: true,
        skipSignedInCheck: true,
      });
      return {
        kind: 'iap' as const,
        alreadyClaimed: claim.alreadyClaimed,
        bananasGranted: claim.bananasGranted,
        bananaBalance: claim.bananaBalance,
        note,
        adminEmail,
      };
    }

    const bananas = body.bananas;
    if (bananas == null) {
      throw new BadRequestException('bananas is required without a store transaction');
    }

    const referenceId = `admin:${adminEmail}:${note}`.slice(0, 200);
    const updated = await this.economy.creditAdminBananas(
      user.id,
      bananas,
      referenceId,
    );
    return {
      kind: 'admin_credit' as const,
      alreadyClaimed: false,
      bananasGranted: bananas,
      bananaBalance: updated.bananaBalance,
      note,
      adminEmail,
    };
  }

  private toUserSummary(user: {
    id: string;
    displayName: string | null;
    email: string | null;
    firebaseUid: string | null;
    bananaBalance: number;
    freeBananaBalance: number;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      firebaseUid: user.firebaseUid,
      bananaBalance: user.bananaBalance,
      freeBananaBalance: user.freeBananaBalance,
      purchasedBananas: Math.max(0, user.bananaBalance - user.freeBananaBalance),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
