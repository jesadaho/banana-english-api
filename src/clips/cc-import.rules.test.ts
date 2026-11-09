import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cleanCues,
  needsPunctuation,
  parseCues,
  segmentsToWords,
  splitPunctuated,
} from './cc-import.rules';

const ROLLING = `1
00:00:00,359 --> 00:00:02,430

so do you recognize any of these men I

2
00:00:02,430 --> 00:00:02,440
so do you recognize any of these men I


3
00:00:02,440 --> 00:00:03,949
so do you recognize any of these men I
was hiding in the bathroom stall so I

4
00:00:03,949 --> 00:00:03,959
was hiding in the bathroom stall so I
 `;

describe('caption import rules', () => {
  it('de-duplicates rolling auto captions', () => {
    const { segments, auto } = cleanCues(parseCues(ROLLING));
    assert.equal(auto, true);
    assert.deepEqual(segments.map((s) => s.text), [
      'so do you recognize any of these men I',
      'was hiding in the bathroom stall so I',
    ]);
    assert.ok(segments[0].endMs <= segments[1].startMs);
  });

  it('keeps manual captions and drops [music]', () => {
    const srt = '1\n00:00:01.000 --> 00:00:02.000\n[music]\n\n2\n00:00:02,000 --> 00:00:04,000\n- How are you?\nI am fine.';
    const { segments, auto } = cleanCues(parseCues(srt));
    assert.equal(auto, false);
    assert.deepEqual(segments, [{ startMs: 2000, endMs: 4000, text: 'How are you? I am fine.' }]);
    assert.equal(needsPunctuation(segments), false);
  });

  it('spreads words over the segment', () => {
    const w = segmentsToWords([{ startMs: 1000, endMs: 2000, text: 'one two' }]);
    assert.deepEqual(w, [
      { word: 'one', start: 1, end: 1.5 },
      { word: 'two', start: 1.5, end: 2 },
    ]);
  });

  it('splits punctuated text', () => {
    assert.deepEqual(splitPunctuated('Hi! How are you? [x] Fine.'), ['Hi!', 'How are you?', '[x] Fine.']);
  });
});
