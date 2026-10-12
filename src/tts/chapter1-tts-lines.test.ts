import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDATION_PROBE_LEARNER } from '../training/foundation/foundation-poolgate.fixtures';
import {
  collectChapter1BankLines,
  lineContainsLearnerName,
  praiseSeeds,
} from './chapter1-tts-lines';
import { lookupTtsBankUrl, spokenTurnText, ttsBankKey, ttsBankObjectPath } from './tts-bank';
import { synthesisText } from './tts-speech-text';

describe('chapter 1 TTS bank lines', () => {
  const lines = collectChapter1BankLines();

  it('collects shared spoken lines and drops the learner name', () => {
    assert.ok(lines.length > 0);
    for (const line of lines) {
      assert.equal(line, ttsBankKey(line));
      assert.equal(lineContainsLearnerName(line, FOUNDATION_PROBE_LEARNER), false);
      assert.equal(line.includes('{name}'), false);
    }
  });

  it('covers more than the three openings', () => {
    assert.ok(lines.length > 3);
  });
});

describe('tts bank lookup', () => {
  it('prefers ttsText and ignores whitespace differences', () => {
    const lines = { 'สวัสดีครับ ลองพูดตามครับ': 'https://example/a.mp3' };
    assert.equal(
      lookupTtsBankUrl(lines, 'สวัสดีครับ   ลองพูดตามครับ', 'other'),
      'https://example/a.mp3',
    );
    assert.equal(lookupTtsBankUrl(lines, null, 'missing'), null);
  });

  it('speaks ttsText when the bubble text differs', () => {
    assert.equal(spokenTurnText('พูดอย่างนี้', 'bubble'), 'พูดอย่างนี้');
    assert.equal(spokenTurnText('  ', 'bubble'), 'bubble');
  });

  it('hashes model and voice into the object path', () => {
    const path = ttsBankObjectPath('Hello');
    assert.match(path, /^tts\/v1\/[a-f0-9]{64}\.mp3$/);
    assert.equal(praiseSeeds().length, 3);
    assert.equal(synthesisText('เช้า 7 โมง 🕖'), 'เช้า เจ็ด โมง');
  });
});
