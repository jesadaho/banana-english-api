import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../prisma/prisma.service';
import { bananasForProduct, isKnownBananaPack } from '../purchases/product-catalog';
import { PurchasesService } from '../purchases/purchases.service';

const SEARCH_TAKE = 20;
const LEDGER_TAKE = 200;
const PURCHASE_TAKE = 50;
const ALL_PURCHASES_TAKE = 200;

type LedgerPurchaseRow = {
  id: string;
  productId: string;
  storeTransactionId: string;
  bananasGranted: number;
  platform: string | null;
  createdAt: string;
  claimed: boolean;
  status: string;
  source: string;
  error: string | null;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    firebaseUid: string | null;
  } | null;
};

@Injectable()
export class AdminLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly purchases: PurchasesService,
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
    const rows = await this.prisma.purchaseAttempt.findMany({
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

    const purchases: LedgerPurchaseRow[] = rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      storeTransactionId: row.storeTransactionId,
      bananasGranted: bananasForProduct(row.productId) ?? 0,
      platform: row.platform,
      createdAt: row.createdAt.toISOString(),
      claimed: row.status === 'claimed' || row.status === 'already_claimed',
      status: row.status,
      source: row.source,
      error: row.error,
      user: row.user
        ? {
            id: row.user.id,
            displayName: row.user.displayName,
            email: row.user.email,
            firebaseUid: row.user.firebaseUid,
          }
        : row.appUserId
          ? {
              id: '',
              displayName: null,
              email: null,
              firebaseUid: row.appUserId,
            }
          : null,
    }));

    return { count: purchases.length, purchases };
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

    const [transactions, purchases, attempts] = await Promise.all([
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
      this.prisma.purchaseAttempt.findMany({
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
      attempts: attempts.map((row) => ({
        id: row.id,
        productId: row.productId,
        storeTransactionId: row.storeTransactionId,
        status: row.status,
        source: row.source,
        error: row.error,
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

    if (storeTransactionId) {
      const productId = body.productId?.trim() || 'banana_tickets_28';
      if (!isKnownBananaPack(productId)) {
        throw new BadRequestException('Unknown product');
      }
      await this.purchases.recordStorePaid({
        userId: user.id,
        appUserId: user.firebaseUid,
        productId,
        storeTransactionId,
        platform: body.platform?.trim() || 'android',
        source: 'admin',
      });
      const claim = await this.purchases.claimPurchase(user, {
        productId,
        storeTransactionId,
        platform: body.platform?.trim() || 'android',
        verifiedExternally: true,
        skipSignedInCheck: true,
        source: 'admin',
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
