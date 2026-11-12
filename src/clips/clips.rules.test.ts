import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultDictationHide,
  normalizeDictation,
  normalizeHighlights,
  parseTranscript,
  parseYoutubeId,
  validateTimedLines,
} from './clips.rules';

describe('clips rules', () => {
  it('parses YouTube ids from common URLs', () => {
    assert.equal(parseYoutubeId('https://youtu.be/dQw4w9WgXcQ?t=3'), 'dQw4w9WgXcQ');
    assert.equal(parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x'), 'dQw4w9WgXcQ');
    assert.equal(parseYoutubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYoutubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYoutubeId('https://example.com'), null);
  });

  it('parses SRT with times and plain text without', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,500\nHi! What can I get\nfor you?\n\n2\n00:00:03,000 --> 00:00:04,000\nHmm, let me think.';
    assert.deepEqual(parseTranscript(srt), [
      { startMs: 1000, endMs: 2500, text: 'Hi! What can I get for you?' },
      { startMs: 3000, endMs: 4000, text: 'Hmm, let me think.' },
    ]);
    assert.deepEqual(parseTranscript('Hello there.\n\nBye!'), [
      { startMs: 0, endMs: 0, text: 'Hello there.' },
      { startMs: 0, endMs: 0, text: 'Bye!' },
    ]);
  });

  it('validates timing', () => {
    assert.equal(validateTimedLines([]), 'no_sentences');
    assert.equal(validateTimedLines([{ startMs: 0, endMs: 0, text: 'x' }]), 'bad_time_1');
    assert.equal(
      validateTimedLines([
        { startMs: 2000, endMs: 3000, text: 'a' },
        { startMs: 1000, endMs: 1500, text: 'b' },
      ]),
      'out_of_order_2',
    );
    assert.equal(validateTimedLines([{ startMs: 0, endMs: 900, text: 'ok' }]), null);
  });

  it('hides every word in short lines, key words in long ones', () => {
    assert.deepEqual(defaultDictationHide('Can I get a large latte?'), [0, 1, 2, 3, 4, 5]);
    const long = 'I usually take the bus to work because the traffic is terrible';
    const hide = defaultDictationHide(long);
    assert.ok(hide.length <= 6 && hide.length > 0);
    assert.ok(!hide.includes(3)); // "the"
  });

  it('normalizes dictation and drops distractors that are in the line', () => {
    const d = normalizeDictation({ hide: [4, 99, 4], distractors: ['lunch', 'large', ' '] }, 'Can I get a large latte?');
    assert.deepEqual(d, { hide: [4], distractors: ['lunch'] });
  });

  it('keeps valid non-overlapping phrase/pattern highlights', () => {
    const line = 'I need to figure out what to do next';
    const h = normalizeHighlights(
      [
        { start: 3, end: 5, kind: 'phrase', labelTh: 'figure out = คิดออก' },
        { start: 4, end: 7, kind: 'pattern', labelTh: 'overlap' },
        { start: 0, end: 1, kind: 'phrase', labelTh: 'too short' },
        { start: 5, end: 8, kind: 'pattern', labelTh: 'what to do = จะทำอะไร' },
        { start: 0, end: 2, kind: 'nope', labelTh: 'bad kind' },
      ],
      line,
    );
    assert.deepEqual(h, [
      { start: 3, end: 5, kind: 'phrase', labelTh: 'figure out = คิดออก' },
      { start: 5, end: 8, kind: 'pattern', labelTh: 'what to do = จะทำอะไร' },
    ]);
  });
});
