import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  completedOnLocalDay,
  getUserLocalTime,
  resolveUserTimezone,
} from './timezone.util';

describe('completedOnLocalDay', () => {
  it('matches the learner calendar day, not UTC midnight', () => {
    const tz = 'Asia/Bangkok';
    // 00:00 on 3 Nov 2026 in Bangkok.
    const now = new Date('2026-11-02T17:00:00.000Z');
    const laterSameLocalDay = new Date('2026-11-02T17:30:00.000Z');
    const previousLocalDay = new Date('2026-11-02T16:59:00.000Z');

    assert.equal(getUserLocalTime(tz, now).dateKey, '2026-11-03');
    assert.equal(completedOnLocalDay(laterSameLocalDay, tz, now), true);
    assert.equal(completedOnLocalDay(previousLocalDay, tz, now), false);
    assert.equal(completedOnLocalDay(now, tz, now), true);
  });

  it('treats missing timestamps as not today', () => {
    assert.equal(completedOnLocalDay(null, 'Asia/Bangkok'), false);
    assert.equal(completedOnLocalDay(undefined, 'UTC'), false);
  });

  it('falls back to Bangkok when the user timezone is blank', () => {
    assert.equal(resolveUserTimezone(null), 'Asia/Bangkok');
    assert.equal(resolveUserTimezone('  '), 'Asia/Bangkok');
    assert.equal(resolveUserTimezone('America/Los_Angeles'), 'America/Los_Angeles');
  });
});
