import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTapChoices, tapKey, tapWords } from './tap-choices';
import { tapDistractorWords } from './tap-vocab';

describe('tap mode chips', () => {
  it('splits answers into chips without punctuation or a give-away capital', () => {
    assert.deepEqual(tapWords('Water, please.'), ['water', 'please']);
    assert.deepEqual(tapWords("I'm fine, thank you!"), ["I'm", 'fine', 'thank', 'you']);
    assert.deepEqual(tapWords('Hello'), ['hello']);
    assert.equal(tapKey('Water, please'), tapKey('water please'));
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

  it('the very first lesson still gets distractors (opening chapters)', () => {
    assert.ok(tapDistractorWords({ lessonId: 'greetings' }).length >= 6);
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
