import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  earlyBirdReserveSource,
  mergeStorePeriod,
  normalizeSubscriptionProductId,
  subscriptionProduct,
} from './subscription-products';

const now = new Date('2026-11-02T00:00:00Z');
const day = 86_400_000;
const at = (days: number) => new Date(now.getTime() + days * day);

describe('subscriptionProduct', () => {
  it('maps store ids, including Play base plans', () => {
    assert.equal(subscriptionProduct('promax_yearly_earlybird')?.priceThb, 280);
    assert.equal(subscriptionProduct('promax_yearly_earlybird:yearly')?.earlyBird, true);
    assert.equal(subscriptionProduct('pro_monthly')?.tier, 'PRO');
    assert.equal(subscriptionProduct('banana_tickets_28'), null);
    assert.equal(normalizeSubscriptionProductId(' pro_yearly:p1y '), 'pro_yearly');
  });
});

describe('mergeStorePeriod', () => {
  it('grants when free or expired', () => {
    const r = mergeStorePeriod({
      currentTier: 'PRO_MAX',
      currentExpiresAt: at(-1),
      newTier: 'PRO',
      newExpiresAt: at(30),
      now,
    });
    assert.deepEqual(r, { tier: 'PRO', expiresAt: at(30), changed: true });
  });

  it('never shortens a Founder Pro Max year', () => {
    const r = mergeStorePeriod({
      currentTier: 'PRO_MAX',
      currentExpiresAt: at(300),
      newTier: 'PRO_MAX',
      newExpiresAt: at(30),
      now,
    });
    assert.equal(r.changed, false);
    assert.deepEqual(r.expiresAt, at(300));
  });

  it('extends the same tier', () => {
    const r = mergeStorePeriod({
      currentTier: 'PRO_MAX',
      currentExpiresAt: at(300),
      newTier: 'PRO_MAX',
      newExpiresAt: at(365),
      now,
    });
    assert.deepEqual(r, { tier: 'PRO_MAX', expiresAt: at(365), changed: true });
  });

  it('does not downgrade active Pro Max to Pro', () => {
    const r = mergeStorePeriod({
      currentTier: 'PRO_MAX',
      currentExpiresAt: at(10),
      newTier: 'PRO',
      newExpiresAt: at(365),
      now,
    });
    assert.equal(r.tier, 'PRO_MAX');
    assert.equal(r.changed, false);
  });

  it('upgrades Pro to Pro Max', () => {
    const r = mergeStorePeriod({
      currentTier: 'PRO',
      currentExpiresAt: at(100),
      newTier: 'PRO_MAX',
      newExpiresAt: at(30),
      now,
    });
    assert.deepEqual(r, { tier: 'PRO_MAX', expiresAt: at(30), changed: true });
  });
});

describe('earlyBirdReserveSource', () => {
  it('keeps known sources only', () => {
    assert.equal(earlyBirdReserveSource('offer_day_3'), 'offer_day_3');
    assert.equal(earlyBirdReserveSource('settings'), 'settings');
    assert.equal(earlyBirdReserveSource('<script>'), 'other');
    assert.equal(earlyBirdReserveSource(undefined), 'other');
  });
});
