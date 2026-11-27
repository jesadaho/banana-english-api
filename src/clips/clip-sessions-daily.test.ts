import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eachBangkokDayKey } from './clip-sessions.service';

describe('eachBangkokDayKey', () => {
  it('lists inclusive Bangkok calendar days', () => {
    // 2026-11-01 17:00Z = 2026-11-02 00:00 Bangkok → start day 11-02
    // 2026-11-03 16:59Z = 2026-11-03 23:59 Bangkok → end day 11-03
    const from = new Date('2026-11-01T17:00:00.000Z');
    const to = new Date('2026-11-03T16:59:59.999Z');
    assert.deepEqual(eachBangkokDayKey(from, to), [
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it('returns a single day when from and to are the same Bangkok day', () => {
    const from = new Date('2026-11-25T00:00:00.000Z'); // 07:00 Bangkok
    const to = new Date('2026-11-25T16:59:59.999Z'); // 23:59 Bangkok
    assert.deepEqual(eachBangkokDayKey(from, to), ['2026-11-25']);
  });
});
