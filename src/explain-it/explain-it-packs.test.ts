import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dealExplainItChallenge,
  dealExplainItItems,
  EXPLAIN_IT_CHALLENGE_DEAL_COUNT,
  EXPLAIN_IT_CHALLENGE_ID,
  EXPLAIN_IT_DEAL_COUNT,
  EXPLAIN_IT_TOPICS,
  explainItPoolForTopic,
  explainItTopicById,
  isExplainItChallenge,
  topicsForTier,
} from './explain-it.data';
import { ExplainItLeaderboardService } from './explain-it-leaderboard.service';

describe('Explain It packs', () => {
  it('lists 8 public topics and excludes challenge', () => {
    assert.equal(EXPLAIN_IT_TOPICS.length, 8);
    assert.equal(
      EXPLAIN_IT_TOPICS.some((t) => t.id === EXPLAIN_IT_CHALLENGE_ID),
      false,
    );
    assert.ok(explainItTopicById(EXPLAIN_IT_CHALLENGE_ID));
    assert.ok(isExplainItChallenge(EXPLAIN_IT_CHALLENGE_ID));
  });

  it('has 20 items per bundle', () => {
    for (const topic of EXPLAIN_IT_TOPICS) {
      const pool = explainItPoolForTopic(topic.id);
      assert.equal(pool.length, 20, topic.id);
      assert.equal(topic.poolSize, 20, topic.id);
    }
  });

  it('groups topics by tier', () => {
    assert.equal(topicsForTier(1).length, 3);
    assert.equal(topicsForTier(2).length, 4);
    assert.equal(topicsForTier(3).length, 1);
  });

  it('deals 7 items for a practice topic', () => {
    const items = dealExplainItItems('everyday_objects', EXPLAIN_IT_DEAL_COUNT);
    assert.equal(items.length, EXPLAIN_IT_DEAL_COUNT);
  });

  it('deals challenge as 4 Tier1 + 3 Tier2 + 3 Tier3', () => {
    const tierById = new Map<string, number>();
    for (const topic of EXPLAIN_IT_TOPICS) {
      for (const item of explainItPoolForTopic(topic.id)) {
        tierById.set(item.id, topic.tier);
      }
    }

    const items = dealExplainItChallenge();
    assert.equal(items.length, EXPLAIN_IT_CHALLENGE_DEAL_COUNT);

    const counts = { 1: 0, 2: 0, 3: 0 };
    for (const item of items) {
      const tier = tierById.get(item.id);
      assert.ok(tier === 1 || tier === 2 || tier === 3, item.id);
      counts[tier] += 1;
    }
    assert.equal(counts[1], 4);
    assert.equal(counts[2], 3);
    assert.equal(counts[3], 3);
  });

  it('accepts challenge for leaderboard topic lookup', () => {
    assert.ok(explainItTopicById('challenge'));
    assert.equal(explainItTopicById('not-a-topic'), undefined);
    assert.equal(ExplainItLeaderboardService.LEADERBOARD_TOP_SIZE, 10);
  });
});
