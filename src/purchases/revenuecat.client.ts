import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RevenueCatNonSubscription = {
  id?: string;
  store_transaction_id?: string;
  original_purchase_id?: string;
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

  /**
   * Confirm a consumable transaction exists on this RevenueCat subscriber.
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

    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(
      params.appUserId,
    )}`;
    let payload: RevenueCatSubscriberResponse;
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
      payload = (await response.json()) as RevenueCatSubscriberResponse;
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

    if (!this.transactionMatches(payload, params)) {
      throw new BadRequestException('Purchase could not be verified');
    }
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
