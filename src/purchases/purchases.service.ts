import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../prisma/prisma.service';
import { bananasForProduct, isKnownBananaPack } from './product-catalog';
import { RevenueCatClient } from './revenuecat.client';

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
    transaction_id?: string;
    store?: string;
  };
};

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly config: ConfigService,
    private readonly revenueCat: RevenueCatClient,
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
      skipSignedInCheck?: boolean;
      source?: PurchaseAttemptSource;
    },
  ): Promise<ClaimPurchaseResult> {
    const productId = params.productId.trim();
    const storeTransactionId = params.storeTransactionId.trim();
    const source = params.source ?? 'app';

    try {
      if (!params.skipSignedInCheck && !user.firebaseUid) {
        throw new ForbiddenException(
          'Sign in with Apple or Google before purchasing',
        );
      }

      if (!isKnownBananaPack(productId)) {
        throw new BadRequestException('Unknown product');
      }

      const bananas = bananasForProduct(productId);
      if (bananas == null || bananas <= 0) {
        throw new BadRequestException('Invalid product configuration');
      }

      if (!params.verifiedExternally) {
        if (!user.firebaseUid) {
          throw new ForbiddenException(
            'Sign in with Apple or Google before purchasing',
          );
        }
        await this.revenueCat.assertStoreTransaction({
          appUserId: user.firebaseUid,
          productId,
          storeTransactionId,
        });
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.purchaseRecord.findUnique({
          where: { storeTransactionId },
        });

        if (existing) {
          if (existing.userId !== user.id) {
            throw new BadRequestException('Transaction already claimed');
          }
          const { user: creditedUser, credited } =
            await this.economy.creditIapIfNeeded(
              tx,
              user.id,
              bananas,
              storeTransactionId,
            );
          return {
            bananasGranted: existing.bananasGranted,
            bananaBalance: creditedUser.bananaBalance,
            alreadyClaimed: !credited,
          };
        }

        try {
          await tx.purchaseRecord.create({
            data: {
              userId: user.id,
              productId,
              storeTransactionId,
              bananasGranted: bananas,
              platform: params.platform?.trim() || null,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            const raced = await tx.purchaseRecord.findUniqueOrThrow({
              where: { storeTransactionId },
            });
            if (raced.userId !== user.id) {
              throw new BadRequestException('Transaction already claimed');
            }
            const { user: creditedUser, credited } =
              await this.economy.creditIapIfNeeded(
                tx,
                user.id,
                bananas,
                storeTransactionId,
              );
            return {
              bananasGranted: raced.bananasGranted,
              bananaBalance: creditedUser.bananaBalance,
              alreadyClaimed: !credited,
            };
          }
          throw error;
        }

        const { user: creditedUser, credited } =
          await this.economy.creditIapIfNeeded(
            tx,
            user.id,
            bananas,
            storeTransactionId,
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
        appUserId: user.firebaseUid,
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
        appUserId: user.firebaseUid,
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

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: appUserId },
    });

    const platform =
      event.store === 'APP_STORE'
        ? 'ios'
        : event.store === 'PLAY_STORE'
          ? 'android'
          : undefined;

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
      source: 'webhook',
    });
  }
}
