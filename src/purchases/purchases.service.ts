import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../prisma/prisma.service';
import { subscriptionProduct } from '../subscriptions/subscription-products';
import {
  SubscriptionsService,
  subscriptionPayload,
} from '../subscriptions/subscriptions.service';
import { bananasForProduct, isKnownBananaPack } from './product-catalog';
import {
  anonymousIdFromGuestAppUserId,
  revenueCatAppUserId,
  revenueCatAppUserIdCandidates,
} from './revenuecat-app-user';
import {
  RevenueCatClient,
  type VerifiedStoreTransaction,
} from './revenuecat.client';

export type ClaimPurchaseResult = {
  bananasGranted: number;
  bananaBalance: number;
  alreadyClaimed: boolean;
};

export type PurchaseAttemptSource = 'app' | 'webhook' | 'admin';
export type PurchaseAttemptStatus =
  | 'store_paid'
  | 'claimed'
  | 'already_claimed'
  | 'failed';

type RevenueCatWebhookBody = {
  event?: {
    type?: string;
    app_user_id?: string;
    product_id?: string;
    new_product_id?: string;
    transaction_id?: string;
    original_transaction_id?: string;
    store?: string;
    environment?: string;
    expiration_at_ms?: number | null;
    purchased_at_ms?: number | null;
  };
};

const SUBSCRIPTION_GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
]);

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly config: ConfigService,
    private readonly revenueCat: RevenueCatClient,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async recordStorePaid(params: {
    userId?: string | null;
    appUserId?: string | null;
    productId: string;
    storeTransactionId: string;
    platform?: string;
    source: PurchaseAttemptSource;
  }) {
    const productId = params.productId.trim();
    const storeTransactionId = params.storeTransactionId.trim();
    if (!productId || !storeTransactionId) {
      throw new BadRequestException('Missing purchase identifiers');
    }

    return this.prisma.purchaseAttempt.create({
      data: {
        userId: params.userId ?? null,
        appUserId: params.appUserId?.trim() || null,
        productId,
        storeTransactionId,
        platform: params.platform?.trim() || null,
        source: params.source,
        status: 'store_paid',
      },
    });
  }

  async claimPurchase(
    user: User,
    params: {
      productId: string;
      storeTransactionId: string;
      platform?: string;
      verifiedExternally?: boolean;
      /** Webhook environment when [verifiedExternally]. */
      isSandbox?: boolean;
      source?: PurchaseAttemptSource;
    },
  ): Promise<ClaimPurchaseResult> {
    const productId = params.productId.trim();
    const storeTransactionId = params.storeTransactionId.trim();
    const source = params.source ?? 'app';

    try {
      if (!isKnownBananaPack(productId)) {
        throw new BadRequestException('Unknown product');
      }

      const bananas = bananasForProduct(productId);
      if (bananas == null || bananas <= 0) {
        throw new BadRequestException('Invalid product configuration');
      }

      const verified: VerifiedStoreTransaction = params.verifiedExternally
        ? {
            canonicalId: storeTransactionId,
            aliases: [storeTransactionId],
            isSandbox: params.isSandbox,
          }
        : await this.revenueCat.assertStoreTransaction({
            appUserIds: revenueCatAppUserIdCandidates(user),
            productId,
            storeTransactionId,
          });
      const aliases = [
        ...new Set([verified.canonicalId, storeTransactionId, ...verified.aliases]),
      ];

      const result = await this.prisma.$transaction(async (tx) => {
        const creditExisting = async (existing: {
          userId: string;
          storeTransactionId: string;
          bananasGranted: number;
        }) => {
          if (existing.userId !== user.id) {
            throw new BadRequestException('Transaction already claimed');
          }
          const { user: creditedUser, credited } =
            await this.economy.creditIapIfNeeded(
              tx,
              user.id,
              bananas,
              existing.storeTransactionId,
              aliases,
            );
          return {
            bananasGranted: existing.bananasGranted,
            bananaBalance: creditedUser.bananaBalance,
            alreadyClaimed: !credited,
          };
        };

        const existing = await tx.purchaseRecord.findFirst({
          where: { storeTransactionId: { in: aliases } },
        });
        if (existing) return creditExisting(existing);

        try {
          await tx.purchaseRecord.create({
            data: {
              userId: user.id,
              productId,
              storeTransactionId: verified.canonicalId,
              bananasGranted: bananas,
              platform: params.platform?.trim() || null,
              isSandbox: verified.isSandbox ?? null,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            return creditExisting(
              await tx.purchaseRecord.findUniqueOrThrow({
                where: { storeTransactionId: verified.canonicalId },
              }),
            );
          }
          throw error;
        }

        const { user: creditedUser, credited } =
          await this.economy.creditIapIfNeeded(
            tx,
            user.id,
            bananas,
            verified.canonicalId,
            aliases,
          );
        return {
          bananasGranted: bananas,
          bananaBalance: creditedUser.bananaBalance,
          alreadyClaimed: !credited,
        };
      });

      await this.finalizeAttemptSafe({
        storeTransactionId,
        userId: user.id,
        appUserId: revenueCatAppUserId(user),
        productId,
        platform: params.platform,
        source,
        status: result.alreadyClaimed ? 'already_claimed' : 'claimed',
      });
      return result;
    } catch (error) {
      await this.finalizeAttemptSafe({
        storeTransactionId,
        userId: user.id,
        appUserId: revenueCatAppUserId(user),
        productId,
        platform: params.platform,
        source,
        status: 'failed',
        error: this.claimErrorMessage(error),
      });
      throw error;
    }
  }

  private claimErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim().slice(0, 300);
    }
    return String(error).slice(0, 300);
  }

  private async finalizeAttemptSafe(params: {
    storeTransactionId: string;
    userId?: string | null;
    appUserId?: string | null;
    productId?: string;
    platform?: string;
    source: PurchaseAttemptSource;
    status: Exclude<PurchaseAttemptStatus, 'store_paid'>;
    error?: string | null;
  }): Promise<void> {
    const storeTransactionId = params.storeTransactionId.trim();
    if (!storeTransactionId) return;
    try {
      const latest = await this.prisma.purchaseAttempt.findFirst({
        where: { storeTransactionId },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        await this.prisma.purchaseAttempt.update({
          where: { id: latest.id },
          data: {
            status: params.status,
            error: params.error ?? null,
            userId: latest.userId ?? params.userId ?? undefined,
            appUserId: latest.appUserId ?? params.appUserId ?? undefined,
          },
        });
        return;
      }
      await this.prisma.purchaseAttempt.create({
        data: {
          userId: params.userId ?? null,
          appUserId: params.appUserId?.trim() || null,
          productId: params.productId?.trim() || 'unknown',
          storeTransactionId,
          platform: params.platform?.trim() || null,
          source: params.source,
          status: params.status,
          error: params.error ?? null,
        },
      });
    } catch {
      // Never hide the original claim error.
    }
  }

  verifyRevenueCatWebhookAuth(authorizationHeader?: string): void {
    const expected = this.config.get<string>('REVENUECAT_WEBHOOK_AUTH')?.trim();
    if (!expected) {
      throw new UnauthorizedException('Webhook auth is not configured');
    }
    const header = authorizationHeader?.trim() ?? '';
    const bearer = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : header;
    if (bearer !== expected) {
      throw new UnauthorizedException('Invalid webhook authorization');
    }
  }

  async handleRevenueCatWebhook(body: RevenueCatWebhookBody): Promise<void> {
    const event = body.event;
    if (!event) return;

    const type = event.type ?? '';
    const platform =
      event.store === 'APP_STORE'
        ? 'ios'
        : event.store === 'PLAY_STORE'
          ? 'android'
          : undefined;

    if (subscriptionProduct(event.product_id)) {
      await this.handleSubscriptionEvent(type, event, platform);
      return;
    }

    const allowed = new Set([
      'NON_RENEWING_PURCHASE',
      'INITIAL_PURCHASE',
      'PRODUCT_CHANGE',
    ]);
    if (!allowed.has(type)) return;

    const appUserId = event.app_user_id?.trim();
    const productId = event.product_id?.trim();
    const storeTransactionId = event.transaction_id?.trim();
    if (!appUserId || !productId || !storeTransactionId) return;
    if (!isKnownBananaPack(productId)) return;

    const user = await this.userForAppUserId(appUserId);

    await this.recordStorePaid({
      userId: user?.id,
      appUserId,
      productId,
      storeTransactionId,
      platform,
      source: 'webhook',
    });

    if (!user) return;

    await this.claimPurchase(user, {
      productId,
      storeTransactionId,
      platform,
      verifiedExternally: true,
      isSandbox: event.environment
        ? event.environment.toUpperCase() === 'SANDBOX'
        : undefined,
      source: 'webhook',
    });
  }

  private async handleSubscriptionEvent(
    type: string,
    event: NonNullable<RevenueCatWebhookBody['event']>,
    platform: string | undefined,
  ): Promise<void> {
    const appUserId = event.app_user_id?.trim();
    const storeTransactionId = event.transaction_id?.trim();
    const expiresMs = event.expiration_at_ms;
    if (!appUserId || !storeTransactionId || !expiresMs) return;
    const user = await this.userForAppUserId(appUserId);
    if (!user) return;
    const expiresAt = new Date(expiresMs);
    const isSandbox = event.environment
      ? event.environment.toUpperCase() === 'SANDBOX'
      : null;

    if (SUBSCRIPTION_GRANT_EVENTS.has(type)) {
      const productId =
        type === 'PRODUCT_CHANGE' && event.new_product_id
          ? event.new_product_id
          : event.product_id!;
      await this.subscriptions.applyStorePeriod({
        userId: user.id,
        productId,
        storeTransactionId,
        expiresAt,
        purchasedAt: event.purchased_at_ms ? new Date(event.purchased_at_ms) : null,
        platform: platform ?? null,
        isSandbox,
      });
      return;
    }
    // CANCELLATION keeps access until expiry; only an earlier expiry (refund) cuts it.
    if (type === 'CANCELLATION' || type === 'EXPIRATION') {
      await this.subscriptions.expireStorePeriod({
        userId: user.id,
        storeTransactionId,
        expiresAt,
      });
    }
  }

  /** App → API right after a store subscription purchase or restore. */
  async syncSubscriptions(user: User) {
    const periods = await this.revenueCat.listActiveSubscriptions(
      revenueCatAppUserIdCandidates(user),
    );
    let applied = 0;
    for (const period of periods) {
      if (!subscriptionProduct(period.productId)) continue;
      const result = await this.subscriptions.applyStorePeriod({
        userId: user.id,
        productId: period.productId,
        storeTransactionId: period.storeTransactionId,
        expiresAt: period.expiresAt,
        purchasedAt: period.purchasedAt,
        platform: period.platform,
        isSandbox: period.isSandbox,
      });
      if (result.applied) applied += 1;
    }
    const refreshed = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return {
      applied,
      subscription: subscriptionPayload(refreshed),
    };
  }

  private userForAppUserId(appUserId: string): Promise<User | null> {
    const guestAnonymousId = anonymousIdFromGuestAppUserId(appUserId);
    return this.prisma.user.findUnique({
      where: guestAnonymousId
        ? { anonymousId: guestAnonymousId }
        : { firebaseUid: appUserId },
    });
  }

  /**
   * Fill PurchaseRecord.isSandbox for older rows from RevenueCat so admin
   * revenue can drop test purchases. Rows RevenueCat can't match stay null.
   */
  async backfillSandboxFlags(limit = 40): Promise<number> {
    if (!this.revenueCat.secretKey()) return 0;
    const rows = await this.prisma.purchaseRecord.findMany({
      where: { isSandbox: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        productId: true,
        storeTransactionId: true,
        user: { select: { firebaseUid: true, anonymousId: true } },
      },
    });
    let updated = 0;
    for (const row of rows) {
      const flag = await this.revenueCat.lookupSandboxFlag(
        revenueCatAppUserIdCandidates(row.user),
        row.productId,
        row.storeTransactionId,
      );
      if (flag == null) continue;
      await this.prisma.purchaseRecord.update({
        where: { id: row.id },
        data: { isSandbox: flag },
      });
      updated += 1;
    }
    return updated;
  }
}
