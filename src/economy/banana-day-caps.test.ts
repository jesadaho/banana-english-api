import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_BANANA_DAY_CAPS,
  freeBananaCapForSignupDay,
  parseBananaDayCapsFromRc,
  resolveBananaDayCaps,
  signupLocalDayIndex,
} from './banana-day-caps';

describe('banana day caps', () => {
  it('maps Day 0 / 1–2 / 3+ to 8 / 7 / 5 by default', () => {
    assert.equal(freeBananaCapForSignupDay(0), 8);
    assert.equal(freeBananaCapForSignupDay(1), 7);
    assert.equal(freeBananaCapForSignupDay(2), 7);
    assert.equal(freeBananaCapForSignupDay(3), 5);
    assert.equal(freeBananaCapForSignupDay(30), 5);
  });

  it('counts local calendar days since signup (Bangkok)', () => {
    const created = new Date('2026-11-17T03:00:00.000Z');
    assert.equal(signupLocalDayIndex(created, 'Asia/Bangkok', new Date('2026-11-17T10:00:00.000Z')), 0);
    assert.equal(signupLocalDayIndex(created, 'Asia/Bangkok', new Date('2026-11-17T18:00:00.000Z')), 1);
    assert.equal(signupLocalDayIndex(created, 'Asia/Bangkok', new Date('2026-11-19T03:00:00.000Z')), 2);
    assert.equal(signupLocalDayIndex(created, 'Asia/Bangkok', new Date('2026-11-20T03:00:00.000Z')), 3);
  });

  it('parses Remote Config JSON and rejects junk', () => {
    assert.deepEqual(
      parseBananaDayCapsFromRc({ banana_day_caps: '{"day0":10,"day1to2":9,"day3plus":6}' }),
      { day0: 10, day1to2: 9, day3plus: 6 },
    );
    assert.equal(parseBananaDayCapsFromRc(null), null);
    assert.equal(parseBananaDayCapsFromRc({ banana_day_caps: 'nope' }), null);
    assert.deepEqual(DEFAULT_BANANA_DAY_CAPS, { day0: 8, day1to2: 7, day3plus: 5 });
  });

  it('lets Railway env override RC / defaults', () => {
    assert.deepEqual(
      resolveBananaDayCaps({
        rc: { banana_day_caps: '{"day0":10,"day1to2":9,"day3plus":6}' },
        env: { dayCapsJson: '{"day0":8,"day1to2":7,"day3plus":5}' },
      }),
      { day0: 8, day1to2: 7, day3plus: 5 },
    );
    assert.deepEqual(
      resolveBananaDayCaps({
        env: { day0: '8', day1to2: '7', maxBananaBalance: '5' },
      }),
      { day0: 8, day1to2: 7, day3plus: 5 },
    );
  });
});
