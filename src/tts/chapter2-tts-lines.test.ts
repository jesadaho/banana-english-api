import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDATION_PROBE_LEARNER } from '../training/foundation/foundation-poolgate.fixtures';
import { lineContainsLearnerName } from './chapter1-tts-lines';
import {
  adventureA2LessonIds,
  collectAdventureA2BankLines,
  collectChapter2BankLines,
  collectFoundationBankLines,
} from './chapter2-tts-lines';
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
    assert.equal(lines.some((line) => line.startsWith('ดีครับ')), false);
    for (const praise of ['Good!', 'Great!', 'Excellent!']) {
      assert.ok(lines.includes(praise));
    }
  });

  it('includes a later chapter body without baking in the praise word', async () => {
    const lines = await collectFoundationBankLines(3, 3);
    assert.ok(lines.some((line) => line.includes('I am ready')));
    assert.equal(lines.filter((line) => line.startsWith('Good!')).length, 1);
  });

  it('collects A2 chapter 1 lesson lines with English praise in the sentence', async () => {
    assert.equal(adventureA2LessonIds(1, 8).length, 22);
    const lines = await collectAdventureA2BankLines(1, 1);
    assert.ok(lines.some((line) => line.includes('baking')));
    assert.ok(
      lines.some((line) => /^(?:That's right!|Very good!|Excellent!) /.test(line)),
    );
    assert.equal(lines.some((line) => line.includes('GEMINI_SHOULD_NOT_APPEAR')), false);
    for (const line of lines) {
      assert.equal(lineContainsLearnerName(line, FOUNDATION_PROBE_LEARNER), false);
    }
  });
});
