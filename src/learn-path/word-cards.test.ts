import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ADVENTURE_A2_COURSE,
  FOUNDATION_V7_CAPABILITIES,
  FOUNDATION_V7_CATALOG,
  canonicalFoundationV7RewardId,
  wordCardsPoolById,
} from './foundation-v7-path.data';
import { toFoundationV7ClientChapters } from './foundation-v7-path.view';
import {
  WORD_CARDS_MIN_WORDS,
  wordCardsInsertIndex,
  wordCardsItemsForChapter,
  wordCardsNodeId,
  wordCardsPoolId,
} from './word-cards.data';

const CORE = FOUNDATION_V7_CAPABILITIES.filter((cap) => cap !== 'word_cards');

describe('Word Cards review nodes', () => {
  it('uses the chapter New Words + Emoji Speak words, without duplicates', () => {
    const ch4 = FOUNDATION_V7_CATALOG.chapters[3];
    const items = wordCardsItemsForChapter(ch4);
    assert.ok(items.length >= WORD_CARDS_MIN_WORDS);
    assert.ok(items.some((i) => i.answer.toLowerCase() === 'teacher'));
    assert.equal(new Set(items.map((i) => i.answer.toLowerCase())).size, items.length);
    for (const item of items) {
      assert.ok(item.emoji && item.meaningTh);
      assert.ok(item.acceptedAnswers.includes(item.answer));
    }
  });

  it('adds one optional node before the chapter conversation for new clients only', () => {
    const withCards = toFoundationV7ClientChapters(FOUNDATION_V7_CAPABILITIES);
    const without = toFoundationV7ClientChapters(CORE);
    const ch = withCards[3];
    const review = ch.items.find((n) => n.nodeType === 'word_cards');
    assert.ok(review);
    assert.equal(review.id, wordCardsNodeId(ch.id));
    assert.equal(review.poolId, wordCardsPoolId(ch.id));
    assert.equal(review.countsTowardProgress, false);
    assert.equal(review.optional, true);
    assert.equal(review.comingSoon, false);
    const idx = ch.items.indexOf(review);
    assert.equal(ch.items[idx + 1]?.nodeType, 'conversation');
    // The review never gates the conversation after it.
    assert.equal(ch.items[idx + 1].unlockAfterNodeIds.includes(review.id), false);
    assert.equal(
      without.flatMap((c) => c.items).some((n) => n.nodeType === 'word_cards'),
      false,
    );
  });

  it('serves the pool and accepts completion by node id', () => {
    const ch = FOUNDATION_V7_CATALOG.chapters[3];
    const pool = wordCardsPoolById(wordCardsPoolId(ch.id));
    assert.equal(pool?.chapterId, ch.id);
    assert.equal(
      canonicalFoundationV7RewardId(wordCardsNodeId(ch.id)),
      `word_cards:${wordCardsPoolId(ch.id)}`,
    );
  });

  it('is Foundation (A1) only for now — A2 has none', () => {
    const chapters = toFoundationV7ClientChapters(
      FOUNDATION_V7_CAPABILITIES,
      ADVENTURE_A2_COURSE,
    );
    assert.equal(
      chapters.some((c) => c.items.some((n) => n.nodeType === 'word_cards')),
      false,
    );
  });

  it('inserts before the last conversation or at the end', () => {
    const node = (type: string) => ({ type }) as never;
    assert.equal(wordCardsInsertIndex([node('lesson'), node('conversation')]), 1);
    assert.equal(wordCardsInsertIndex([node('lesson'), node('say_it')]), 2);
  });
});
