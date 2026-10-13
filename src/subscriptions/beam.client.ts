import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type BeamCharge = {
  chargeId?: string;
  encodedImage?: { imageBase64Encoded?: string };
  actionRequired?: string;
};

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
        Authorization: `Basic ${Buffer.from(`${this.merchantId()}:${this.apiKey()}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amountSatang,
        currency: 'THB',
        referenceId: params.referenceId,
        paymentMethod: {
          paymentMethodType: 'QR_PROMPT_PAY',
          qrPromptPay: { expiryTime: params.expiresAt.toISOString() },
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as BeamCharge | null;
    const qr = body?.encodedImage?.imageBase64Encoded?.trim();
    if (!response.ok || !body?.chargeId || !qr) {
      throw new ServiceUnavailableException('Beam could not create a PromptPay charge');
    }
    return { chargeId: body.chargeId, qrImageBase64: qr };
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
}
