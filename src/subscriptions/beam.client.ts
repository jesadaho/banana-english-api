import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type BeamCharge = {
  chargeId?: string;
  status?: string;
  amount?: number;
  referenceId?: string;
  encodedImage?: { imageBase64Encoded?: string };
  actionRequired?: string;
  code?: string;
};

const PRESALE_RETURN_URL = 'https://bananaenglish.app/presale/';

@Injectable()
export class BeamClient {
  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    return Boolean(this.merchantId() && this.apiKey());
  }

  webhookSecret(): string {
    return this.config.get<string>('BEAM_WEBHOOK_SECRET')?.trim() ?? '';
  }

  /** Beam charge amounts are in satang. */
  async createPromptPayCharge(params: {
    amountSatang: number;
    referenceId: string;
    expiresAt: Date;
  }): Promise<{ chargeId: string; qrImageBase64: string }> {
    if (!this.configured()) {
      throw new ServiceUnavailableException('Beam is not configured');
    }
    const response = await fetch(`${this.baseUrl()}/api/v1/charges`, {
      method: 'POST',
      headers: {
        Authorization: this.authorization(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amountSatang,
        currency: 'THB',
        referenceId: params.referenceId,
        returnUrl: PRESALE_RETURN_URL,
        paymentMethod: {
          paymentMethodType: 'QR_PROMPT_PAY',
          qrPromptPay: { expiryTime: params.expiresAt.toISOString() },
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as BeamCharge | null;
    const qr = body?.encodedImage?.imageBase64Encoded?.trim();
    if (!response.ok || !body?.chargeId || !qr) {
      const code = body?.code ? ` (${body.code})` : '';
      throw new ServiceUnavailableException(
        `Beam could not create a PromptPay charge${code}`,
      );
    }
    return { chargeId: body.chargeId, qrImageBase64: qr };
  }

  /** Current charge. Null when Beam is unreachable or the id is unknown. */
  async getCharge(chargeId: string): Promise<{
    status: string;
    amount: number;
    referenceId: string;
  } | null> {
    if (!this.configured() || !chargeId.trim()) return null;
    const response = await fetch(
      `${this.baseUrl()}/api/v1/charges/${encodeURIComponent(chargeId)}`,
      { headers: { Authorization: this.authorization() } },
    );
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as BeamCharge | null;
    if (!body?.status) return null;
    return {
      status: body.status,
      amount: body.amount ?? 0,
      referenceId: body.referenceId ?? '',
    };
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('BEAM_API_BASE')?.trim() ||
      'https://api.beamcheckout.com'
    );
  }

  private merchantId(): string {
    return this.config.get<string>('BEAM_MERCHANT_ID')?.trim() ?? '';
  }

  private apiKey(): string {
    return this.config.get<string>('BEAM_API_KEY')?.trim() ?? '';
  }

  private authorization(): string {
    return `Basic ${Buffer.from(`${this.merchantId()}:${this.apiKey()}`).toString('base64')}`;
  }
}
