import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  beamSignatureMatches,
  effectiveSubscriptionTier,
  FOUNDER_PRESALE_OPENS_AT,
  presaleIsSoldOut,
  presaleSeatsRemaining,
} from './subscription.constants';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('effectiveSubscriptionTier', () => {
  it('keeps an unexpired Pro Max grant', () => {
    assert.equal(
      effectiveSubscriptionTier({ subscriptionTier: 'PRO_MAX', subscriptionExpiresAt: future }),
      'PRO_MAX',
    );
  });

  it('falls back to free after expiry', () => {
    assert.equal(
      effectiveSubscriptionTier({ subscriptionTier: 'PRO', subscriptionExpiresAt: past }),
      'FREE',
    );
  });

  it('ignores a tier with no expiry', () => {
    assert.equal(
      effectiveSubscriptionTier({ subscriptionTier: 'PRO_MAX', subscriptionExpiresAt: null }),
      'FREE',
    );
  });
});

describe('presaleSeatsRemaining', () => {
  it('holds 9 seats off the public remaining count', () => {
    assert.equal(presaleSeatsRemaining(19), 2);
    assert.equal(presaleIsSoldOut(21), true);
    assert.equal(presaleIsSoldOut(20), false);
  });
});

describe('FOUNDER_PRESALE_OPENS_AT', () => {
  it('opens Sunday 18 Oct 2026 at 21:00 Bangkok', () => {
    assert.equal(FOUNDER_PRESALE_OPENS_AT.toISOString(), '2026-10-18T14:00:00.000Z');
  });
});

describe('beamSignatureMatches', () => {
  it('accepts Beam’s published webhook sample', () => {
    const body = Buffer.from(
      '{"chargeId":"ch_30GtUweMWec7r2hHIsV5xxQeJKp","merchantId":"m_2sHxsByPwESKYM4nMwdEBdhubPS","referenceId":"order#10001","status":"SUCCEEDED","currency":"THB","amount":3000000,"source":"PAYMENT_LINK","sourceId":"57Iot6c11o","transactionTime":"2025-07-23T10:16:12Z","paymentMethod":{"paymentMethodType":"CARD","card":{"last4":"1111","brand":"VISA"},"cardInstallments":null,"cardNetworkToken":null,"qrPromptPay":null,"alipay":null,"weChatPay":null,"trueMoney":null,"linePay":null,"shopeePay":null,"bangkokBankApp":null,"kPlus":null,"scbEasy":null,"krungsriApp":null},"failureCode":"","customer":{"primaryPhone":{"countryCode":"+66","number":"0958051075"},"email":"","deliveryAddress":{"contactName":"","phone":{"countryCode":"","number":""},"address":{"streetAddress":"","city":"","country":"","postCode":""}}},"createdAt":"2025-07-23T10:15:56.102401Z","updatedAt":"2025-07-23T10:16:17.418991Z"}',
    );
    const secret = 'KOFELguf5L1ltuDlkDHGUkPPnQhrgYYijTR4Fqh7APc=';
    const signature = '1XzWtJHZ9Y1tmjkA/XZUIn1ZHrUQp1d0Ms0oDQfJBto=';
    assert.equal(beamSignatureMatches(body, signature, secret), true);
    assert.equal(beamSignatureMatches(body, signature, 'other-key-value'), false);
    assert.equal(beamSignatureMatches(body, 'not-the-signature', secret), false);
  });
});
