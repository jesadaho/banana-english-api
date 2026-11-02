import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dateKey,
  estimatedThbForGrant,
  estimatedThbForProduct,
  parseDateRange,
  pctChange,
  previousRange,
  weekStartKey,
} from './admin-metrics.util';

describe('admin-metrics.util', () => {
  it('estimates pack prices', () => {
    assert.equal(estimatedThbForProduct('banana_tickets_28'), 79);
    assert.equal(estimatedThbForProduct('banana_tickets_70'), 199);
    assert.equal(estimatedThbForProduct('unknown'), 0);
  });

  it('estimates subscription list prices', () => {
    assert.equal(estimatedThbForProduct('pro_monthly'), 120);
    assert.equal(estimatedThbForProduct('promax_yearly'), 780);
    assert.equal(estimatedThbForProduct('promax_yearly_earlybird'), 280);
    assert.equal(estimatedThbForProduct('promax_yearly:monthly'), 780);
  });

  it('prefers the grant price when stored', () => {
    assert.equal(estimatedThbForGrant({ productId: 'pro_monthly', priceThb: 99 }), 99);
    assert.equal(estimatedThbForGrant({ productId: 'pro_monthly', priceThb: null }), 120);
  });

  it('parses default 30-day range ending today UTC', () => {
    const range = parseDateRange(undefined, '2026-09-07');
    assert.equal(dateKey(range.from), '2026-08-09');
    assert.equal(dateKey(range.to), '2026-09-07');
  });

  it('builds previous equal-length range', () => {
    const range = parseDateRange('2026-09-01', '2026-09-07');
    const prev = previousRange(range);
    assert.equal(dateKey(prev.to), '2026-08-31');
    assert.equal(dateKey(prev.from), '2026-08-25');
  });

  it('computes percent change', () => {
    assert.equal(pctChange(110, 100), 10);
    assert.equal(pctChange(0, 0), 0);
    assert.equal(pctChange(5, 0), null);
  });

  it('weeks start on Monday UTC', () => {
    // 2026-09-07 is Monday
    assert.equal(weekStartKey(new Date('2026-09-07T12:00:00Z')), '2026-09-07');
    // Sunday 6 Sep → previous Monday 31 Aug
    assert.equal(weekStartKey(new Date('2026-09-06T12:00:00Z')), '2026-08-31');
  });
});
