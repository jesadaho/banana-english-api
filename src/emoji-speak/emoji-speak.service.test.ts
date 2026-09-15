import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EmojiSpeakService } from './emoji-speak.service';
import { EMOJI_SPEAK_POOLS, isEmojiSpeakPoolId } from './emoji-speak.data';
import foundationV7Pools from './foundation-v7-pools.json';

describe('EmojiSpeakService', () => {
  const service = new EmojiSpeakService();

  it('serves the migrated Flutter pack catalog', () => {
    assert.equal(Object.keys(EMOJI_SPEAK_POOLS).filter(id => !id.startsWith('fnd_v7_')).length, 37);
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

  it('serves V7 spelling hints without header prompts', () => {
    assert.equal(Object.keys(foundationV7Pools).length, 17);
    let count = 0;
    for (const [id, pool] of Object.entries(foundationV7Pools)) {
      for (const card of pool.items) {
        count++;
        assert.equal(card.hint.length, card.answer.length);
        assert.match(card.hint, /_/);
        assert.doesNotMatch(card.hint, /[\u0E00-\u0E7F]/);
        [...card.hint].forEach((char, i) => {
          if (char !== '_') assert.equal(char, card.answer[i]);
          if (card.answer[i] === ' ') assert.equal(char, ' ');
        });
        assert.ok(card.meaningTh);
        assert.equal(card.promptTh, undefined);
        assert.notEqual(card.hint, card.meaningTh);
      }
      for (const card of service.dealForPool(id).items) {
        const source = pool.items.find(item => item.answer === card.answer)!;
        assert.equal(card.hint, source.hint);
        assert.equal(card.meaningTh, source.meaningTh);
      }
    }
    assert.equal(count, 83);
    assert.equal(foundationV7Pools.fnd_v7_u05n02.items[3].hint, 'ap__e');
    assert.equal(foundationV7Pools.fnd_v7_u05n06.dealCount, 10);
    assert.equal(foundationV7Pools.fnd_v7_u05n06.items[0].answer, 'a book');
  });
});
