import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { describe, it } from 'node:test';
import {
  beamSignatureMatches,
  effectiveSubscriptionTier,
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

describe('beamSignatureMatches', () => {
  it('accepts the HMAC-SHA256 base64 of the raw body', () => {
    const body = Buffer.from('{"status":"SUCCEEDED"}');
    const signature = createHmac('sha256', 'secret').update(body).digest('base64');
    assert.equal(beamSignatureMatches(body, signature, 'secret'), true);
    assert.equal(beamSignatureMatches(body, signature, 'other'), false);
  });
});
