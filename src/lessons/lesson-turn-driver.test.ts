import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMOJI_SPEAK_COMPLETE_SENTINEL,
  TAP_TO_CONTINUE_SENTINEL,
} from '../common/api.types';
import { pickUserSpeechForTurn } from './lesson-turn-driver';

describe('pickUserSpeechForTurn', () => {
  it('returns null when lesson is complete', () => {
    assert.equal(
      pickUserSpeechForTurn({ isTaskComplete: true, expectsUserSpeech: false }),
      null,
    );
  });

  it('sends continue for listen-only turns', () => {
    assert.equal(
      pickUserSpeechForTurn({ expectsUserSpeech: false }),
      TAP_TO_CONTINUE_SENTINEL,
    );
  });

  it('sends emoji-speak-complete when a batch is attached', () => {
    assert.equal(
      pickUserSpeechForTurn({
        expectsUserSpeech: false,
        emojiSpeakSet: [{ emoji: '📅', answer: 'yesterday' }],
      }),
      EMOJI_SPEAK_COMPLETE_SENTINEL,
    );
  });

  it('prefers expectedSpeech over guided options', () => {
    assert.equal(
      pickUserSpeechForTurn({
        expectsUserSpeech: true,
        expectedSpeech: 'Hello',
        guidedSpeaking: {
          stem: '...',
          emoji: '👋',
          speak: 'Hi',
          options: [{ emoji: '👋', speak: 'Hi' }],
        },
      }),
      'Hello',
    );
  });

  it('uses first guided option when expectedSpeech is empty', () => {
    assert.equal(
      pickUserSpeechForTurn({
        expectsUserSpeech: true,
        expectedSpeech: '',
        guidedSpeaking: {
          stem: 'I like...',
          emoji: '🍕',
          speak: '',
          options: [
            { emoji: '🍕', speak: 'I like pizza.' },
            { emoji: '🍣', speak: 'I like sushi.' },
          ],
        },
      }),
      'I like pizza.',
    );
  });
});
