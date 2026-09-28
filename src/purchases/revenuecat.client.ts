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
  is_sandbox?: boolean;
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
      {
        store_transaction_id?: string;
        original_transaction_id?: string;
        is_sandbox?: boolean;
      }
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
  /**
   * The SDK reports different ids for the same consumable (store tx id after
   * purchase, RevenueCat's own id in CustomerInfo), so callers must dedupe on
   * [canonicalId] and every alias.
   */
  async assertStoreTransaction(params: {
    appUserIds: string[];
    productId: string;
    storeTransactionId: string;
  }): Promise<VerifiedStoreTransaction> {
    const secret = this.secretKey();
    if (!secret) {
      throw new BadGatewayException('Purchase verification is not configured');
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= RevenueCatClient.verifyAttempts; attempt++) {
      try {
        for (const appUserId of params.appUserIds) {
          const payload = await this.fetchSubscriber(appUserId, secret);
          const matched = this.matchTransaction(payload, params);
          if (matched) {
            if (attempt > 1) {
              this.logger.log(
                `RevenueCat transaction visible on attempt ${attempt}`,
              );
            }
            return matched;
          }
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

  /** is_sandbox for a store transaction, or null when RevenueCat has no match. */
  async lookupSandboxFlag(
    appUserIds: string[],
    productId: string,
    storeTransactionId: string,
  ): Promise<boolean | null> {
    const secret = this.secretKey();
    if (!secret) return null;
    for (const appUserId of appUserIds) {
      try {
        const payload = await this.fetchSubscriber(appUserId, secret);
        const matched = this.matchTransaction(payload, {
          productId,
          storeTransactionId,
        });
        if (matched) return matched.isSandbox ?? null;
      } catch {
        // Try the next app user id.
      }
    }
    return null;
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

  private matchTransaction(
    payload: RevenueCatSubscriberResponse,
    params: {
      productId: string;
      storeTransactionId: string;
    },
  ): VerifiedStoreTransaction | null {
    const wanted = params.storeTransactionId.trim();
    if (!wanted) return null;
    const subscriber = payload.subscriber;
    if (!subscriber) return null;

    const nonSubs = subscriber.non_subscriptions ?? {};
    const productRows = nonSubs[params.productId] ?? [];
    const allRows = Object.values(nonSubs).flatMap((rows) => rows ?? []);
    const otherRows = Object.values(subscriber.other_purchases ?? {});
    for (const row of [...productRows, ...allRows, ...otherRows]) {
      const verified = verifiedFromIds(
        [row?.store_transaction_id, row?.id, row?.original_purchase_id],
        wanted,
        row?.is_sandbox,
      );
      if (verified) return verified;
    }

    for (const row of Object.values(subscriber.subscriptions ?? {})) {
      const verified = verifiedFromIds(
        [row.store_transaction_id, row.original_transaction_id],
        wanted,
        row.is_sandbox,
      );
      if (verified) return verified;
    }

    return null;
  }
}

export type VerifiedStoreTransaction = {
  /** Store transaction id when RevenueCat has it, else the matched id. */
  canonicalId: string;
  aliases: string[];
  /** RevenueCat is_sandbox for the matched purchase (undefined if not sent). */
  isSandbox?: boolean;
};

/** First id is the store transaction id, preferred as canonical. */
function verifiedFromIds(
  ids: Array<string | undefined>,
  wanted: string,
  isSandbox?: boolean,
): VerifiedStoreTransaction | null {
  const aliases = [
    ...new Set(
      ids
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (!aliases.includes(wanted)) return null;
  return {
    canonicalId: aliases[0],
    aliases,
    ...(typeof isSandbox === 'boolean' ? { isSandbox } : {}),
  };
}
