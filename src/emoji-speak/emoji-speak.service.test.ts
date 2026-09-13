import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EmojiSpeakService } from './emoji-speak.service';
import { EMOJI_SPEAK_POOLS, isEmojiSpeakPoolId } from './emoji-speak.data';

describe('EmojiSpeakService', () => {
  const service = new EmojiSpeakService();

  it('serves the migrated Flutter pack catalog', () => {
    assert.equal(Object.keys(EMOJI_SPEAK_POOLS).length, 37);
    assert.equal(isEmojiSpeakPoolId('emoji_speak_first_contact'), true);
    assert.equal(isEmojiSpeakPoolId('fnd_v6_emoji_one_or_many'), true);
    assert.equal(isEmojiSpeakPoolId('missing_pool'), false);
  });

  it('deals the configured count and keeps card fields', () => {
    const deal = service.dealForPool('emoji_speak_first_contact');
    assert.equal(deal.poolId, 'emoji_speak_first_contact');
    assert.equal(deal.dealCount, 5);
    assert.equal(deal.items.length, 5);
    for (const card of deal.items) {
      assert.ok(card.emoji);
      assert.ok(card.answer);
      assert.ok(card.meaningTh);
    }
  });

  it('keeps Thai prompt cards intact', () => {
    const pool = service.getPool('emoji_speak_numbers_daily_utility');
    const am = pool.items.find((card) => card.answer === 'AM');
    assert.ok(am);
    assert.equal(am?.emoji, '🌅');
    assert.match(am?.promptTh ?? '', /wake up/);
  });
});
