import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PurchaseAlertInput = {
  kind: 'pro' | 'banana_pack' | 'beam_presale';
  userId?: string | null;
  productId?: string | null;
  platform?: string | null;
  storeTransactionId?: string | null;
  amountThb?: number | null;
  orderId?: string | null;
  isSandbox?: boolean | null;
};

/**
 * Fire-and-forget Telegram alerts for real-money purchases.
 * Missing env → no-op. Failures never throw into payment webhooks.
 */
@Injectable()
export class TelegramNotifier {
  private readonly logger = new Logger(TelegramNotifier.name);

  constructor(private readonly config: ConfigService) {}

  notifyPurchase(input: PurchaseAlertInput): void {
    void this.sendPurchase(input).catch((err) => {
      this.logger.warn(
        `Telegram purchase alert failed: ${String(err).slice(0, 180)}`,
      );
    });
  }

  private async sendPurchase(input: PurchaseAlertInput): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim();
    const chatId = this.config.get<string>('TELEGRAM_PURCHASE_CHAT_ID')?.trim();
    if (!token || !chatId) return;

    const env =
      this.config.get<string>('RAILWAY_ENVIRONMENT_NAME')?.trim() ||
      this.config.get<string>('NODE_ENV')?.trim() ||
      'local';
    const kindLabel =
      input.kind === 'pro'
        ? 'Pro purchase'
        : input.kind === 'banana_pack'
          ? 'Banana pack'
          : 'Beam PromptPay';
    const lines = [
      `[${env}] ${kindLabel}`,
      input.userId ? `user=${input.userId}` : null,
      input.productId ? `product=${input.productId}` : null,
      input.platform ? `platform=${input.platform}` : null,
      input.storeTransactionId ? `tx=${input.storeTransactionId}` : null,
      input.orderId ? `order=${input.orderId}` : null,
      input.amountThb != null ? `amount=${input.amountThb} THB` : null,
      input.isSandbox ? 'sandbox=true' : null,
    ].filter((line): line is string => !!line);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} ${body.slice(0, 160)}`);
    }
  }
}
