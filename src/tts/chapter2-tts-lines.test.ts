import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDATION_PROBE_LEARNER } from '../training/foundation/foundation-poolgate.fixtures';
import { lineContainsLearnerName } from './chapter1-tts-lines';
import { collectChapter2BankLines } from './chapter2-tts-lines';
import { ttsBankKey } from './tts-bank';

describe('chapter 2 TTS bank lines', () => {
  it('collects shared spoken lines and drops the learner name', async () => {
    const lines = await collectChapter2BankLines();
    assert.ok(lines.length > 2);
    for (const line of lines) {
      assert.equal(line, ttsBankKey(line));
      assert.equal(lineContainsLearnerName(line, FOUNDATION_PROBE_LEARNER), false);
      assert.equal(line.includes('{name}'), false);
      assert.equal(line.includes('GEMINI_SHOULD_NOT_APPEAR'), false);
    }
    assert.ok(lines.some((line) => line.includes('Water, please')));
    assert.ok(lines.some((line) => line.includes('See you tomorrow')));
  });
});
