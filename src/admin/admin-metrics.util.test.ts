import { describe, expect, it } from 'vitest';
import {
  dateKey,
  estimatedThbForProduct,
  parseDateRange,
  pctChange,
  previousRange,
  weekStartKey,
} from './admin-metrics.util';

describe('admin-metrics.util', () => {
  it('estimates pack prices', () => {
    expect(estimatedThbForProduct('banana_tickets_28')).toBe(99);
    expect(estimatedThbForProduct('banana_tickets_70')).toBe(199);
    expect(estimatedThbForProduct('unknown')).toBe(0);
  });

  it('parses default 30-day range ending today UTC', () => {
    const range = parseDateRange(undefined, '2026-09-07');
    expect(dateKey(range.from)).toBe('2026-08-09');
    expect(dateKey(range.to)).toBe('2026-09-07');
  });

  it('builds previous equal-length range', () => {
    const range = parseDateRange('2026-09-01', '2026-09-07');
    const prev = previousRange(range);
    expect(dateKey(prev.to)).toBe('2026-08-31');
    expect(dateKey(prev.from)).toBe('2026-08-25');
  });

  it('computes percent change', () => {
    expect(pctChange(110, 100)).toBe(10);
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(5, 0)).toBeNull();
  });

  it('weeks start on Monday UTC', () => {
    // 2026-09-07 is Monday
    expect(weekStartKey(new Date('2026-09-07T12:00:00Z'))).toBe('2026-09-07');
    // Sunday 6 Sep → previous Monday 31 Aug
    expect(weekStartKey(new Date('2026-09-06T12:00:00Z'))).toBe('2026-08-31');
  });
});
