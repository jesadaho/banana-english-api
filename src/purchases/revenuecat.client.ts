import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isKnownBananaPack } from './product-catalog';

type RevenueCatNonSubscription = {
  id?: string;
  store_transaction_id?: string;
  original_purchase_id?: string;
  purchase_date?: string;
};

export type RevenueCatPackPurchase = {
  productId: string;
  storeTransactionId: string;
  purchasedAt: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    non_subscriptions?: Record<string, RevenueCatNonSubscription[] | undefined>;
    other_purchases?: Record<string, RevenueCatNonSubscription | undefined>;
    subscriptions?: Record<
      string,
      { store_transaction_id?: string; original_transaction_id?: string }
    >;
  };
};

@Injectable()
export class RevenueCatClient {
  private readonly logger = new Logger(RevenueCatClient.name);

  constructor(private readonly config: ConfigService) {}

  secretKey(): string | undefined {
    const key = this.config.get<string>('REVENUECAT_SECRET_API_KEY')?.trim();
    return key || undefined;
  }

  async listBananaPackPurchases(
    appUserId: string,
  ): Promise<RevenueCatPackPurchase[]> {
    const secret = this.secretKey();
    if (!secret || !appUserId.trim()) return [];
    try {
      const payload = await this.fetchSubscriber(appUserId.trim(), secret);
      return this.extractBananaPackPurchases(payload);
    } catch {
      return [];
    }
  }

  private static readonly verifyAttempts = 3;
  private static readonly verifyRetryDelaysMs = [2_000, 4_000];

  /**
   * Confirm a consumable transaction exists on this RevenueCat subscriber.
   * Play can mark the order Processed before RC indexes it, so look up again
   * a few times before failing the claim.
   */
  async assertStoreTransaction(params: {
    appUserId: string;
    productId: string;
    storeTransactionId: string;
  }): Promise<void> {
    const secret = this.secretKey();
    if (!secret) {
      throw new BadGatewayException('Purchase verification is not configured');
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= RevenueCatClient.verifyAttempts; attempt++) {
      try {
        const payload = await this.fetchSubscriber(params.appUserId, secret);
        if (this.transactionMatches(payload, params)) {
          if (attempt > 1) {
            this.logger.log(
              `RevenueCat transaction visible on attempt ${attempt}`,
            );
          }
          return;
        }
        lastError = new BadRequestException('Purchase could not be verified');
        this.logger.warn(
          `RevenueCat transaction not visible yet attempt=${attempt}/${RevenueCatClient.verifyAttempts}`,
        );
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `RevenueCat subscriber lookup attempt=${attempt}/${RevenueCatClient.verifyAttempts} failed`,
        );
        if (
          !(error instanceof BadGatewayException) &&
          !(error instanceof BadRequestException)
        ) {
          lastError = new BadGatewayException('Could not verify purchase');
        }
      }

      if (attempt >= RevenueCatClient.verifyAttempts) break;
      await this.delay(RevenueCatClient.verifyRetryDelaysMs[attempt - 1] ?? 2_000);
    }

    if (
      lastError instanceof BadGatewayException ||
      lastError instanceof BadRequestException
    ) {
      throw lastError;
    }
    throw new BadRequestException('Purchase could not be verified');
  }

  private async fetchSubscriber(
    appUserId: string,
    secret: string,
  ): Promise<RevenueCatSubscriberResponse> {
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(
      appUserId,
    )}`;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        this.logger.warn(
          `RevenueCat subscriber lookup failed: ${response.status}`,
        );
        throw new BadGatewayException('Could not verify purchase');
      }
      return (await response.json()) as RevenueCatSubscriberResponse;
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.warn(
        `RevenueCat subscriber lookup error: ${String(error).slice(0, 160)}`,
      );
      throw new BadGatewayException('Could not verify purchase');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private extractBananaPackPurchases(
    payload: RevenueCatSubscriberResponse,
  ): RevenueCatPackPurchase[] {
    const nonSubs = payload.subscriber?.non_subscriptions ?? {};
    const found: RevenueCatPackPurchase[] = [];
    const seen = new Set<string>();
    for (const [productId, rows] of Object.entries(nonSubs)) {
      if (!isKnownBananaPack(productId)) continue;
      for (const row of rows ?? []) {
        const storeTransactionId = [
          row.store_transaction_id,
          row.id,
          row.original_purchase_id,
        ]
          .map((value) => value?.trim())
          .find((value): value is string => Boolean(value));
        if (!storeTransactionId || !seen.add(storeTransactionId)) continue;
        found.push({
          productId,
          storeTransactionId,
          purchasedAt: row.purchase_date?.trim() || null,
        });
      }
    }
    return found;
  }

  private transactionMatches(
    payload: RevenueCatSubscriberResponse,
    params: {
      productId: string;
      storeTransactionId: string;
    },
  ): boolean {
    const wanted = params.storeTransactionId.trim();
    if (!wanted) return false;
    const subscriber = payload.subscriber;
    if (!subscriber) return false;

    const idsOf = (row: RevenueCatNonSubscription | undefined): string[] => {
      if (!row) return [];
      return [row.store_transaction_id, row.id, row.original_purchase_id]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
    };

    const nonSubs = subscriber.non_subscriptions ?? {};
    const productRows = nonSubs[params.productId] ?? [];
    const allRows = Object.values(nonSubs).flatMap((rows) => rows ?? []);
    for (const row of [...productRows, ...allRows]) {
      if (idsOf(row).includes(wanted)) return true;
    }

    const other = subscriber.other_purchases ?? {};
    for (const row of Object.values(other)) {
      if (idsOf(row).includes(wanted)) return true;
    }

    const subs = subscriber.subscriptions ?? {};
    for (const row of Object.values(subs)) {
      if (
        row.store_transaction_id === wanted ||
        row.original_transaction_id === wanted
      ) {
        return true;
      }
    }

    return false;
  }
}
