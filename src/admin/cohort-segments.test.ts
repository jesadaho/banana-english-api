import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { overallStats, segmentStats, type CohortUserRow } from './cohort-segments';

const row = (activeDays: number[], ageDays = 10, paid = false, g = 'x'): CohortUserRow => ({
  ageDays,
  activeDays,
  paid,
  dims: { g },
});

describe('cohort segments', () => {
  it('D1/D2/D3/D7, drop-off after D1 and comeback', () => {
    const s = overallStats([
      row([0, 1, 2, 3, 7], 10, true), // stays
      row([0, 1]), // D1 then drops
      row([0, 4]), // comeback on day 4
      row([0]), // gone
    ]);
    assert.equal(s.n, 4);
    assert.equal(s.paid, 1);
    assert.equal(s.d1, 50);
    assert.equal(s.d2, 25);
    assert.equal(s.d7, 25);
    assert.equal(s.dropAfterD1, 50); // 1 of the 2 D1 returners
    assert.equal(s.comeback, 50); // 1 of the 2 gone on D1+D2
  });

  it('only counts days that are over', () => {
    const s = overallStats([row([0, 1], 1), row([0], 2)]);
    assert.equal(s.d1, 0); // ageDays 1: day 1 not over yet → only the 2nd user counts
    assert.equal(s.d2, null);
  });

  it('bananas spent and out of bananas on signup day', () => {
    const s = overallStats([
      { ...row([0]), bananasSpent0: 5, outOfBananas0: true },
      { ...row([0]), bananasSpent0: 2, outOfBananas0: false },
    ]);
    assert.equal(s.bananas0, 3.5);
    assert.equal(s.outOfBananas0, 50);
    assert.equal(overallStats([row([0])]).bananas0, null);
  });

  it('average activities on day 0 and days 0–7', () => {
    const s = overallStats([
      { ...row([0], 10), activities0: 4, activities7: 10 },
      { ...row([0], 3), activities0: 2, activities7: 2 },
    ]);
    assert.equal(s.acts0, 3);
    assert.equal(s.acts7, 10); // 2nd user's day 7 is not over
  });

  it('groups by value and hides small groups', () => {
    const rows = [...Array(20)].map(() => row([0, 1], 10, false, 'big')).concat([row([0], 10, false, 'small')]);
    const seg = segmentStats(rows, ['g'], 15);
    assert.deepEqual(seg.g.map((r) => r.value), ['big']);
    assert.equal(seg.g[0].d1, 100);
  });
});
