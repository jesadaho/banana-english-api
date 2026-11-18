import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_BANANA_DAY_BONUS,
  resolveBananaDayBonus,
  signupDayBonusAmount,
  signupDayEntitlement,
  signupLocalDayIndex,
} from './banana-day-caps';

describe('banana day bonus (base 5 + signup grants)', () => {
  it('maps Day 0 / 1 / 2 / 3+ bonuses and entitlements', () => {
    assert.equal(signupDayBonusAmount(0), 3);
    assert.equal(signupDayBonusAmount(1), 2);
    assert.equal(signupDayBonusAmount(2), 2);
    assert.equal(signupDayBonusAmount(3), 0);
    assert.equal(signupDayEntitlement(0), 8);
    assert.equal(signupDayEntitlement(1), 7);
    assert.equal(signupDayEntitlement(2), 7);
    assert.equal(signupDayEntitlement(3), 5);
    assert.deepEqual(DEFAULT_BANANA_DAY_BONUS, { baseCap: 5, day0: 3, day1: 2, day2: 2 });
  });

  it('counts local calendar days since signup (Bangkok)', () => {
    const created = new Date('2026-11-17T03:00:00.000Z');
    assert.equal(signupLocalDayIndex(created, 'Asia/Bangkok', new Date('2026-11-17T10:00:00.000Z')), 0);
    assert.equal(signupLocalDayIndex(created, 'Asia/Bangkok', new Date('2026-11-17T18:00:00.000Z')), 1);
    assert.equal(signupLocalDayIndex(created, 'Asia/Bangkok', new Date('2026-11-20T03:00:00.000Z')), 3);
  });

  it('lets env override, and maps legacy entitlement JSON to bonuses', () => {
    assert.deepEqual(
      resolveBananaDayBonus({
        env: { bonusJson: '{"baseCap":5,"day0":3,"day1":2,"day2":2}' },
      }),
      { baseCap: 5, day0: 3, day1: 2, day2: 2 },
    );
    assert.deepEqual(
      resolveBananaDayBonus({
        env: { capsJson: '{"day0":8,"day1to2":7,"day3plus":5}' },
      }),
      { baseCap: 5, day0: 3, day1: 2, day2: 2 },
    );
    assert.deepEqual(
      resolveBananaDayBonus({
        rc: { banana_day_bonus: '{"baseCap":5,"day0":1,"day1":1,"day2":1}' },
        env: { day0: '3', day1: '2', day2: '2' },
      }),
      { baseCap: 5, day0: 3, day1: 2, day2: 2 },
    );
  });
});
