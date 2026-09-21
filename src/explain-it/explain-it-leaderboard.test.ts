import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { explainItTopicById } from './explain-it.data';
import { ExplainItLeaderboardService } from './explain-it-leaderboard.service';

describe('Explain It Demo leaderboard', () => {
  it('accepts the Demo topic id', () => {
    assert.ok(explainItTopicById('demo'));
  });

  it('rejects unknown topics', () => {
    assert.equal(explainItTopicById('not-a-topic'), undefined);
  });

  it('keeps a top 10 board', () => {
    assert.equal(ExplainItLeaderboardService.LEADERBOARD_TOP_SIZE, 10);
  });
});
