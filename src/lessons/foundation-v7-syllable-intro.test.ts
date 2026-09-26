import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { syllableCountSpeechMatches } from './foundation-v7-runtime';
import { V7_LEGACY_FLOWS } from './foundation-v7-legacy-flows';
import { FND_V7_SYLLABLE_WORDS } from './foundation-v7-syllable-words.data';
import { getLesson } from './lessons.data';

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, '').replace(/[^a-z0-9]/g, '');

describe('fnd_v7_syllable_intro', () => {
  it('ships intro listens then counting flow', () => {
    const steps = V7_LEGACY_FLOWS.fnd_v7_syllable_intro;
    assert.ok(steps);
    assert.equal(steps.length, 8);
    assert.equal(steps[0].expectsUserSpeech, false);
    assert.match(steps[0].instruction, /syllable แปลว่า “พยางค์”/);
    assert.match(steps[0].instruction, /กดฟังคำว่า syllable/);
    assert.equal(steps[1].expectsUserSpeech, false);
    assert.match(steps[1].instruction, /one syllable/);
    assert.match(steps[1].instruction, /two syllables/);
    assert.equal(steps[2].expectedSpeech, 'One syllable.');
    assert.match(steps[2].instruction, /bag/);
    assert.match(steps[2].instruction, /syllables/);
    assert.equal(steps[3].expectedSpeech, 'apple');
    assert.equal(steps[4].expectedSpeech, 'Two syllables.');
    assert.equal(steps[5].expectedSpeech, 'One syllable.');
    assert.equal(steps[6].expectedSpeech, 'Two syllables.');
    assert.equal(steps[7].kind, 'complete');
    const lesson = getLesson('fnd_v7_syllable_intro');
    assert.equal(lesson?.progressMax, 8);
    assert.equal(lesson?.titleEn, 'Word Beats');
  });

  it('accepts short one/two syllable answers', () => {
    const one = normalize('One syllable.');
    const two = normalize('Two syllables.');
    for (const got of ['one', 'One syllable', 'one syllable.', 'it has one syllable']) {
      assert.equal(syllableCountSpeechMatches('One syllable.', normalize(got)), true, got);
      assert.equal(syllableCountSpeechMatches('Two syllables.', normalize(got)), false, got);
    }
    for (const got of ['two', 'two syllable', 'Two syllables.', 'it has two syllables']) {
      assert.equal(syllableCountSpeechMatches('Two syllables.', normalize(got)), true, got);
      assert.equal(syllableCountSpeechMatches('One syllable.', normalize(got)), false, got);
    }
    assert.equal(one.startsWith('one'), true);
    assert.equal(two.startsWith('two'), true);
  });

  it('has segmented word bank for lesson vocab', () => {
    for (const word of ['book', 'bag', 'pen', 'apple', 'teacher', 'doctor']) {
      assert.ok(FND_V7_SYLLABLE_WORDS[word], word);
    }
    assert.equal(FND_V7_SYLLABLE_WORDS.teacher.syllableCount, 2);
    assert.deepEqual(FND_V7_SYLLABLE_WORDS.teacher.segments, ['tea', 'cher']);
  });
});
