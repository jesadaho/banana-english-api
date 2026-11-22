import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTapChoices, tapKey, tapWords } from './tap-choices';
import { tapAllowDistractors, tapDistractorWords } from './tap-vocab';

describe('tap mode chips', () => {
  it('splits answers into chips without punctuation or a give-away capital', () => {
    assert.deepEqual(tapWords('Water, please.'), ['water', 'please']);
    assert.deepEqual(tapWords("I'm fine, thank you!"), ["I'm", 'fine', 'thank', 'you']);
    assert.deepEqual(tapWords('Hello'), ['hello']);
    assert.equal(tapKey('Water, please'), tapKey('water please'));
  });

  it('keeps Thai (and other non-Latin) name chips — not stripped as punctuation', () => {
    assert.deepEqual(tapWords('My name is นักเรียน.'), ['my', 'name', 'is', 'นักเรียน']);
    const chips = buildTapChoices({
      answer: 'My name is นักเรียน.',
      distractorWords: ['to', 'in', 'nice', 'hello'],
      seed: 'name-th',
    });
    assert.ok(chips.includes('นักเรียน'), chips.join(','));
    assert.ok(chips.includes('my') && chips.includes('name') && chips.includes('is'));
    assert.notEqual(tapKey('My name is นักเรียน'), tapKey('my name is'));
  });

  it('adds 2–3 distractors, never words of another accepted answer, no duplicates', () => {
    const chips = buildTapChoices({
      answer: 'Hello',
      accepted: ['Hi'],
      distractorWords: ['hi', 'hello', 'you', 'am', 'name', 'my'],
      seed: 's',
    });
    assert.ok(chips.includes('hello'));
    assert.ok(!chips.includes('hi'));
    assert.equal(chips.length, 4); // hello + 3
    assert.equal(new Set(chips.map((c) => c.toLowerCase())).size, chips.length);
  });

  it('keeps a word twice when the answer needs it twice', () => {
    const chips = buildTapChoices({
      answer: 'Excuse me, can you help me?',
      distractorWords: ['please', 'sorry', 'water'],
      seed: 's',
    });
    assert.equal(chips.filter((c) => c === 'me').length, 2);
    assert.equal(chips.length, 6 + 2);
  });

  it('choice steps: every option sentence is in the chips', () => {
    const chips = buildTapChoices({
      answer: 'I like cats',
      options: ['I like dogs', 'I like fish'],
      distractorWords: ['am', 'you'],
      seed: 's',
    });
    for (const w of ['I', 'like', 'cats', 'dogs', 'fish']) assert.ok(chips.includes(w), w);
  });

  it('same seed → same chips in the same order', () => {
    const input = { answer: 'Thank you', distractorWords: ['a', 'please', 'sorry', 'water', 'yes'], seed: 'x' };
    assert.deepEqual(buildTapChoices(input), buildTapChoices(input));
  });

  it('opening chapters still have a distractor pool (for short answers)', () => {
    assert.ok(tapDistractorWords({ lessonId: 'greetings' }).length >= 6);
  });

  it('early chapters: no distractors unless the answer is very short', () => {
    // Ch 3 Say It "Are you sick" (3 words) → answer words only.
    assert.equal(tapAllowDistractors({ topicId: 'fnd_v7_u03n09' }, 3), false);
    assert.equal(tapAllowDistractors({ topicId: 'fnd_v7_u03n09' }, 2), true);
    // Later chapters keep distractors even for longer answers.
    assert.equal(tapAllowDistractors({ topicId: 'fnd_v7_u10n10' }, 5), true);
    const chips = buildTapChoices({
      answer: 'Are you sick',
      distractorWords: tapAllowDistractors({ topicId: 'fnd_v7_u03n09' }, 3)
        ? tapDistractorWords({ topicId: 'fnd_v7_u03n09' })
        : [],
      seed: 'early-sick',
    });
    assert.deepEqual(chips.sort(), ['are', 'sick', 'you'].sort());
  });

  it('distractors come from earlier content, not later chapters', () => {
    // Ch 2 Say It: words from ch 1 / earlier ch 2 nodes appear, ch 10 words do not.
    const words = tapDistractorWords({ topicId: 'fnd_v7_u02n02' });
    assert.ok(words.length > 0);
    const late = tapDistractorWords({ topicId: 'fnd_v7_u10_him_her_them' });
    assert.ok(late.length > 0);
    assert.ok(!words.includes('them'), 'ch 2 must not borrow ch 10 words');
  });
});
