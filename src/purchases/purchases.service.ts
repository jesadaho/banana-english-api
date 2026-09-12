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

  async claimPurchase(
    user: User,
    params: {
      productId: string;
      storeTransactionId: string;
      platform?: string;
      verifiedExternally?: boolean;
      skipSignedInCheck?: boolean;
    },
  ): Promise<ClaimPurchaseResult> {
    if (!params.skipSignedInCheck && !user.firebaseUid) {
      throw new ForbiddenException(
        'Sign in with Apple or Google before purchasing',
      );
    }

    const productId = params.productId.trim();
    const storeTransactionId = params.storeTransactionId.trim();
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

    return this.prisma.$transaction(async (tx) => {
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
    if (!user) return;

    const platform =
      event.store === 'APP_STORE'
        ? 'ios'
        : event.store === 'PLAY_STORE'
          ? 'android'
          : undefined;

    await this.claimPurchase(user, {
      productId,
      storeTransactionId,
      platform,
      verifiedExternally: true,
    });
  }
}
