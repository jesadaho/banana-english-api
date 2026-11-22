import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyBananaBonusArm,
  bananaBonusArmFor,
  hashBananaBonusArm,
  parseBananaBonusAbSettings,
  twoProportionPValue,
} from './banana-bonus-ab';

const settings = parseBananaBonusAbSettings(undefined, '2026-11-23T00:00:00+07:00');
const after = new Date('2026-11-24T00:00:00Z');

describe('banana bonus A/B', () => {
  it('splits about 50/50 and is stable', () => {
    let a = 0;
    for (let i = 0; i < 2000; i++) if (hashBananaBonusArm(`u${i}`) === 'A') a++;
    assert.ok(a > 900 && a < 1100, `A=${a}`);
    assert.equal(hashBananaBonusArm('x'), hashBananaBonusArm('x'));
  });

  it('only users created after the start join; stored arm wins; off stops new ones', () => {
    assert.equal(bananaBonusArmFor({ id: 'u1', createdAt: new Date('2026-11-01') }, settings), null);
    assert.equal(bananaBonusArmFor({ id: 'u1', createdAt: after, bananaBonusArm: 'A' }, settings), 'A');
    const off = parseBananaBonusAbSettings('off', '2026-11-23T00:00:00+07:00');
    assert.equal(bananaBonusArmFor({ id: 'u1', createdAt: after }, off), null);
    assert.equal(bananaBonusArmFor({ id: 'u1', createdAt: after, bananaBonusArm: 'B' }, off), 'B');
  });

  it('arm A has no signup-day bonus, same free pool', () => {
    const cfg = { baseCap: 5, day0: 3, day1: 2, day2: 2 };
    assert.deepEqual(applyBananaBonusArm(cfg, 'A'), { baseCap: 5, day0: 0, day1: 0, day2: 0 });
    assert.deepEqual(applyBananaBonusArm(cfg, 'B'), cfg);
    assert.deepEqual(applyBananaBonusArm(cfg, null), cfg);
  });

  it('p-value: same rates ~1, big gap small', () => {
    assert.equal(twoProportionPValue(30, 100, 30, 100), 1);
    assert.ok((twoProportionPValue(150, 500, 220, 500) ?? 1) < 0.001);
    assert.equal(twoProportionPValue(1, 3, 1, 3), null);
  });
});
