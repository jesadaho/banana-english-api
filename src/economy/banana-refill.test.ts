import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { timedBananaRefill } from './economy.constants';

const H = 3_600_000;
const INTERVAL = 4 * H;
const t0 = new Date('2026-10-04T00:00:00Z');
const at = (hours: number) => new Date(t0.getTime() + hours * H);

describe('timedBananaRefill (+1 every 4h, free cap 5)', () => {
  it('does nothing while the free pool is full', () => {
    assert.deepEqual(timedBananaRefill(5, t0, at(100), INTERVAL), { credit: 0, nextAnchor: null });
  });

  it('starts the clock when below cap with no anchor', () => {
    assert.deepEqual(timedBananaRefill(2, null, at(1), INTERVAL), { credit: 0, nextAnchor: at(1) });
  });

  it('waits until a full interval has passed', () => {
    assert.deepEqual(timedBananaRefill(2, t0, at(3.9), INTERVAL), { credit: 0, nextAnchor: null });
  });

  it('credits one banana per elapsed interval and keeps the remainder', () => {
    const r = timedBananaRefill(1, t0, at(9), INTERVAL);
    assert.equal(r.credit, 2);
    assert.deepEqual(r.nextAnchor, at(8));
  });

  it('caps at 5 free bananas', () => {
    const r = timedBananaRefill(3, t0, at(40), INTERVAL);
    assert.equal(r.credit, 2);
    assert.deepEqual(r.nextAnchor, at(40));
  });
});
