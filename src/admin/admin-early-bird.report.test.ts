import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEarlyBirdRows,
  earlyBirdDaily,
  filterEarlyBirdRows,
  summarizeEarlyBird,
} from './admin-early-bird.report';

const d = (iso: string) => new Date(iso);
const user = { displayName: null, email: null };

const reserved = [
  { id: 'a', displayName: 'Ann', email: 'ann@x.com', earlyBirdReservedAt: d('2026-10-25T03:00:00Z'), earlyBirdReserveSource: 'offer_day_1' },
  { id: 'b', displayName: 'Bo', email: null, earlyBirdReservedAt: d('2026-10-26T18:00:00Z'), earlyBirdReserveSource: 'offer_day_3' },
];
const purchases = [
  { userId: 'a', createdAt: d('2026-11-01T04:00:00Z'), priceThb: 280, platform: 'android', productId: 'promax_yearly_earlybird', isSandbox: false, user },
  { userId: 'a', createdAt: d('2027-11-01T04:00:00Z'), priceThb: 280, platform: 'android', productId: 'promax_yearly_earlybird', isSandbox: false, user },
  { userId: 'c', createdAt: d('2026-11-02T04:00:00Z'), priceThb: 280, platform: 'ios', productId: 'promax_yearly_earlybird', isSandbox: true, user },
];

describe('early bird report', () => {
  const rows = buildEarlyBirdRows(reserved, purchases);

  it('one row per user, first purchase wins', () => {
    assert.equal(rows.length, 3);
    const a = rows.find((r) => r.userId === 'a')!;
    assert.equal(a.status, 'purchased');
    assert.equal(a.purchasedAt, '2026-11-01T04:00:00.000Z');
    assert.equal(rows.find((r) => r.userId === 'b')!.status, 'reserved');
    assert.equal(rows.find((r) => r.userId === 'c')!.status, 'walk_in');
  });

  it('summary excludes sandbox revenue', () => {
    const k = summarizeEarlyBird(rows, d('2026-10-27T01:00:00Z'));
    assert.equal(k.reserved, 2);
    assert.equal(k.reservedToday, 1); // 26 Oct 18:00Z is 27 Oct in Bangkok
    assert.equal(k.converted, 1);
    assert.equal(k.conversionPct, 50);
    assert.equal(k.buyers, 1);
    assert.equal(k.revenueThb, 280);
    assert.equal(k.sandboxBuyers, 1);
  });

  it('daily buckets by Bangkok day', () => {
    const daily = earlyBirdDaily(rows, d('2026-10-25T00:00:00Z'), d('2026-11-02T23:59:59Z'));
    assert.equal(daily.find((x) => x.day === '2026-10-27')?.reservations, 1);
    assert.equal(daily.find((x) => x.day === '2026-11-01')?.purchases, 1);
  });

  it('filters by status, query and range', () => {
    const range = { from: d('2026-10-01T00:00:00Z'), to: d('2026-12-01T00:00:00Z') };
    assert.equal(filterEarlyBirdRows(rows, { ...range, status: 'reserved' }).length, 1);
    assert.equal(filterEarlyBirdRows(rows, { ...range, q: 'ann@' }).length, 1);
    assert.equal(
      filterEarlyBirdRows(rows, { from: d('2026-10-30T00:00:00Z'), to: d('2026-12-01T00:00:00Z') }).length,
      2,
    );
  });
});
