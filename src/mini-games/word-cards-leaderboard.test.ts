import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { wordCardsResetsIn, wordCardsWeekKey } from './word-cards-leaderboard.service';

describe('Word Cards weekly leaderboard', () => {
  it('keys weeks by ISO week in Bangkok time', () => {
    // Thu 29 Oct 2026 12:00 Bangkok
    assert.equal(wordCardsWeekKey(new Date('2026-10-29T05:00:00Z')), '2026-W44');
    // Sun 1 Nov 23:30 Bangkok is still W44; Mon 2 Nov 00:30 Bangkok is W45
    assert.equal(wordCardsWeekKey(new Date('2026-11-01T16:30:00Z')), '2026-W44');
    assert.equal(wordCardsWeekKey(new Date('2026-11-01T17:30:00Z')), '2026-W45');
    // Year boundary: 1 Jan 2027 (Fri) belongs to 2026-W53
    assert.equal(wordCardsWeekKey(new Date('2027-01-01T05:00:00Z')), '2026-W53');
  });

  it('counts down to next Monday 00:00 Bangkok', () => {
    assert.equal(wordCardsResetsIn(new Date('2026-10-29T05:00:00Z')), '3 วัน 12 ชม.');
    assert.equal(wordCardsResetsIn(new Date('2026-11-01T16:30:00Z')), '30 นาที');
  });
});
