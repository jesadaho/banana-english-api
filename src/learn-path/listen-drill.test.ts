import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FOUNDATION_V7_CAPABILITIES,
  FOUNDATION_V7_CATALOG,
  canonicalFoundationV7RewardId,
  listenDrillPoolById,
} from './foundation-v7-path.data';
import { toFoundationV7ClientChapters } from './foundation-v7-path.view';
import {
  LISTEN_DRILL_MIN_ITEMS,
  listenDrillItemsForChapter,
  listenDrillNodeId,
  listenDrillPoolId,
} from './listen-drill.data';

const WITHOUT = FOUNDATION_V7_CAPABILITIES.filter((cap) => cap !== 'listen_drill');

describe('Listen Up (easy) chapter drills', () => {
  it('has authored sentences for every A1 chapter, incl. conversation questions', () => {
    for (const chapter of FOUNDATION_V7_CATALOG.chapters) {
      const items = listenDrillItemsForChapter(chapter.id);
      assert.ok(items.length >= LISTEN_DRILL_MIN_ITEMS, chapter.id);
      assert.equal(new Set(items.map((i) => i.id)).size, items.length);
      for (const item of items) {
        assert.ok(item.text && item.textTh, chapter.id);
        assert.doesNotMatch(item.text, /\{name\}|[=👉]/u);
        const words = item.text.split(/\s+/).length;
        assert.ok(words >= 2 && words <= 10, `${chapter.id}: ${item.text}`);
      }
      const hasConversation = chapter.items.some((n) => n.type === 'conversation' || n.type === 'interactive_scenario');
      if (hasConversation) {
        assert.ok(items.some((i) => i.source === 'conversation'), chapter.id);
      }
    }
  });

  it('sits right before the conversation, after Word Cards, for new clients only', () => {
    const withDrill = toFoundationV7ClientChapters(FOUNDATION_V7_CAPABILITIES);
    const without = toFoundationV7ClientChapters(WITHOUT);
    for (let i = 0; i < withDrill.length; i++) {
      const ch = withDrill[i];
      const idx = ch.items.findIndex((n) => n.nodeType === 'listen_drill');
      assert.ok(idx >= 0, ch.id);
      const drill = ch.items[idx];
      assert.equal(drill.id, listenDrillNodeId(ch.id));
      assert.equal(drill.poolId, listenDrillPoolId(ch.id));
      assert.equal(drill.optional, true);
      assert.equal(drill.countsTowardProgress, false);
      assert.equal(drill.comingSoon, false, ch.id);
      const next = ch.items[idx + 1];
      if (next) assert.ok(['conversation', 'interactive_scenario'].includes(next.nodeType), `${ch.id}: ${next.nodeType}`);
      assert.ok(!without[i].items.some((n) => n.nodeType === 'listen_drill'));
    }
  });

  it('Ch 8 drill comes before the conversation, not between it and the interview', () => {
    const ch8 = toFoundationV7ClientChapters(FOUNDATION_V7_CAPABILITIES)[7];
    const idx = ch8.items.findIndex((n) => n.nodeType === 'listen_drill');
    assert.equal(ch8.items[idx + 1].id, 'v7_u08n10');
  });

  it('serves the pool and accepts the reward id', () => {
    const poolId = listenDrillPoolId('v7_u02');
    const pool = listenDrillPoolById(poolId);
    assert.ok(pool);
    assert.equal(pool.chapterId, 'v7_u02');
    assert.ok(pool.items.some((i) => i.text === 'Is this your student card?'));
    assert.equal(canonicalFoundationV7RewardId(poolId), `listen_drill:${poolId}`);
    assert.equal(canonicalFoundationV7RewardId(listenDrillNodeId('v7_u02')), `listen_drill:${poolId}`);
  });
});
