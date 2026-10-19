import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DAILY_PRACTICE_CORE,
  DAILY_PRACTICE_EVENING,
  DAILY_PRACTICE_MORNING,
  pickDailyPracticeTemplate,
  poolForReminderSlot,
  rememberDailyPracticeTemplate,
} from './notification-templates';

describe('daily practice copy pools', () => {
  it('always includes the 20 core messages', () => {
    assert.equal(DAILY_PRACTICE_CORE.length, 20);
    assert.equal(poolForReminderSlot('noon').length, 20);
    assert.equal(poolForReminderSlot('morning').length, 25);
    assert.equal(poolForReminderSlot('evening').length, 25);
  });

  it('adds morning lines only in the morning slot', () => {
    const morningIds = new Set(poolForReminderSlot('morning').map((t) => t.id));
    const noonIds = new Set(poolForReminderSlot('noon').map((t) => t.id));
    for (const row of DAILY_PRACTICE_MORNING) {
      assert.equal(morningIds.has(row.id), true);
      assert.equal(noonIds.has(row.id), false);
    }
  });

  it('adds evening lines only in the evening slot', () => {
    const eveningIds = new Set(poolForReminderSlot('evening').map((t) => t.id));
    const noonIds = new Set(poolForReminderSlot('noon').map((t) => t.id));
    for (const row of DAILY_PRACTICE_EVENING) {
      assert.equal(eveningIds.has(row.id), true);
      assert.equal(noonIds.has(row.id), false);
    }
  });

  it('avoids the last 7 template ids', () => {
    const recent = ['01', '02', '03', '04', '05', '06', '07'];
    const picked = pickDailyPracticeTemplate('noon', recent, () => 0);
    assert.equal(recent.includes(picked.id), false);
  });

  it('keeps a 7-send memory window', () => {
    assert.deepEqual(
      rememberDailyPracticeTemplate(['01', '02', '03', '04', '05', '06', '07'], '08'),
      ['02', '03', '04', '05', '06', '07', '08'],
    );
  });
});
