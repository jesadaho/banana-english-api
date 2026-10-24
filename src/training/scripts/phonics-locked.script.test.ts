import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChatTurn } from '../../session-store/session-store.service';
import { isTrainingV2Lesson } from '../training-v2.config';
import {
  buildPhonicsLockedAfterUser,
  buildPhonicsLockedOpening,
  collectPhonicsLockedBankLines,
  phonicsLockedMatches,
  PHONICS_LOCKED_SPECS,
} from './phonics-locked.script';

const ID = 'pron_phonics_05_short_u';

function walk(answers: string[]) {
  const turns: ChatTurn[] = [];
  let reply = buildPhonicsLockedOpening(ID);
  const seen = [reply];
  turns.push({ speaker: 'ai', textEn: reply.textEn, v7Step: reply.v7Step, v7Retry: reply.v7Retry, expectedSpeech: reply.expectedSpeech, expectsUserSpeech: reply.expectsUserSpeech });
  for (const answer of answers) {
    turns.push({ speaker: 'user', textEn: answer });
    reply = buildPhonicsLockedAfterUser({ lessonId: ID, turns, userText: answer });
    seen.push(reply);
    turns.push({ speaker: 'ai', textEn: reply.textEn, v7Step: reply.v7Step, v7Retry: reply.v7Retry, expectedSpeech: reply.expectedSpeech, expectsUserSpeech: reply.expectsUserSpeech });
    if (reply.isLessonComplete) break;
  }
  return seen;
}

describe('locked phonics — Short U', () => {
  it('runs on engine v2 without Gemini', () => {
    assert.equal(isTrainingV2Lesson(ID), true);
  });

  it('walks 8 beats when every answer matches', () => {
    const seen = walk(['cup', 'mug', 'cup cap', 'cup mug', 'mud', '[continue]', 'a cup']);
    assert.deepEqual(seen.map((r) => r.v7Step), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(seen[5]!.expectsUserSpeech, false); // reveal (hit) is listen-only
    assert.equal(seen.at(-1)!.isLessonComplete, true);
  });

  it('retries a speak beat once, then advances', () => {
    const seen = walk(['hello', 'nope']);
    assert.deepEqual(seen.map((r) => [r.v7Step, r.v7Retry ?? false]), [[1, false], [1, true], [2, false]]);
    assert.match(seen[1]!.textEn, /ลองอีกครั้งนะครับ\ncup/);
  });

  it('models and repeats the transfer word on a miss', () => {
    const seen = walk(['cup', 'mug', 'cup cap', 'cup mug', 'mad', 'mud', 'a cup']);
    assert.equal(seen[5]!.v7Step, 6);
    assert.equal(seen[5]!.expectedSpeech, 'mud');
    assert.equal(seen[6]!.v7Step, 7);
  });

  it('matches whole words from STT text only', () => {
    assert.equal(phonicsLockedMatches('Cup, cap.', 'cup cap'), true);
    assert.equal(phonicsLockedMatches('cup', 'cup cap'), false);
    assert.equal(phonicsLockedMatches('a cup please', 'a cup'), true);
  });

  it('never uses the learner name and keeps a small fixed bank', () => {
    const lines = collectPhonicsLockedBankLines();
    assert.ok(lines.length <= PHONICS_LOCKED_SPECS.length * 14, `bank lines: ${lines.length}`);
    for (const line of lines) assert.doesNotMatch(line, /\{|undefined|Rookie/);
  });

  it('covers all 20 phonics lessons and each walks 8 beats', () => {
    assert.equal(PHONICS_LOCKED_SPECS.length, 20);
    for (const spec of PHONICS_LOCKED_SPECS) {
      assert.equal(isTrainingV2Lesson(spec.lessonId), true);
      const turns: ChatTurn[] = [];
      let reply = buildPhonicsLockedOpening(spec.lessonId);
      const steps = [reply.v7Step];
      for (let i = 0; i < 20 && !reply.isLessonComplete; i++) {
        turns.push({ speaker: 'ai', textEn: reply.textEn, v7Step: reply.v7Step, v7Retry: reply.v7Retry, expectedSpeech: reply.expectedSpeech });
        const say = reply.expectedSpeech || '[continue]';
        turns.push({ speaker: 'user', textEn: say });
        reply = buildPhonicsLockedAfterUser({ lessonId: spec.lessonId, turns, userText: say });
        steps.push(reply.v7Step);
      }
      assert.deepEqual(steps, [1, 2, 3, 4, 5, 6, 7, 8], spec.lessonId);
    }
  });
});
