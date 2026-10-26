import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_PERFECT_STAR_KEYS_PER_REQUEST,
  parsePerfectStarKeys,
  perfectStarKey,
} from './perfect-stars';

describe('parsePerfectStarKeys', () => {
  it('keeps known games and drops junk and duplicates', () => {
    const keys = parsePerfectStarKeys([
      'emoji_speak:emoji_speak_first_contact',
      'say_it:fnd_v7_u03n04',
      'say_it:fnd_v7_u03n04',
      'listen_up:a2_c01n03',
      'made_up:pool',
      'describe_it:',
      ':pool',
      'word_choice:bad pool id',
      42,
    ]);
    assert.deepEqual(keys.map(perfectStarKey), [
      'emoji_speak:emoji_speak_first_contact',
      'say_it:fnd_v7_u03n04',
      'listen_up:a2_c01n03',
    ]);
  });

  it('ignores non-arrays and caps one request', () => {
    assert.deepEqual(parsePerfectStarKeys('say_it:x'), []);
    const many = Array.from({ length: 900 }, (_, i) => `story_builder:pool_${i}`);
    assert.equal(parsePerfectStarKeys(many).length, MAX_PERFECT_STAR_KEYS_PER_REQUEST);
  });
});
