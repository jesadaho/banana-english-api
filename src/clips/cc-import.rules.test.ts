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

import { MAX_LINE_WORDS, splitLongLine } from './cc-import.rules';

describe('splitLongLine', () => {
  it('keeps short lines', () => {
    assert.deepEqual(splitLongLine('Can I get a large iced latte, please?'), [
      'Can I get a large iced latte, please?',
    ]);
  });

  it('splits after a comma near the middle, keeping every word', () => {
    const s =
      'And remember to subscribe to the channel, click on the bell, and follow us on Instagram for more English tips and lessons.';
    const parts = splitLongLine(s);
    assert.ok(parts.length >= 2);
    assert.ok(parts.every((p) => p.split(' ').length <= MAX_LINE_WORDS));
    assert.equal(parts.join(' '), s);
    assert.ok(parts[0].endsWith(','));
  });

  it('falls back to a conjunction, then the middle; never < 3 words', () => {
    const s = 'And I wouldn\'t be who I am without my hat And I wouldn\'t be who I am without my';
    const parts = splitLongLine(s);
    assert.equal(parts.join(' '), s);
    assert.ok(parts[1].startsWith('And'));
    const flat = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ');
    const p2 = splitLongLine(flat);
    assert.ok(p2.every((p) => p.split(' ').length >= 3 && p.split(' ').length <= MAX_LINE_WORDS));
    assert.equal(p2.join(' '), flat);
  });
});

import { cueStartIndexes, splitLongLines } from './cc-import.rules';

describe('splitLongLines with caption cues', () => {
  it('splits manual captions where the cues break', () => {
    const segments = [
      { startMs: 0, endMs: 1000, text: 'and then they leave' },
      { startMs: 1000, endMs: 5000, text: 'then somehow you find yourself after all those year sitting in a closet' },
      { startMs: 5000, endMs: 6000, text: 'just feeling useless' },
      { startMs: 6000, endMs: 7000, text: 'yeah' },
      { startMs: 7000, endMs: 8000, text: 'Tell me this Sheriff' },
    ];
    const text = segments.map((s) => s.text).join(' ');
    const parts = splitLongLines([text], undefined, cueStartIndexes(segments));
    assert.equal(parts.join(' '), text);
    assert.equal(parts[0], 'and then they leave');
    assert.ok(parts.every((p) => p.split(' ').length <= MAX_LINE_WORDS));
  });
});

import { stripCaptionNotes } from './cc-import.rules';

describe('stripCaptionNotes', () => {
  it('drops (..) / [..] notes and ALL-CAPS speaker labels', () => {
    assert.equal(stripCaptionNotes('(GIGGLES) MICKEY: Whoa!'), 'Whoa!');
    assert.equal(stripCaptionNotes('[Laughter] Oh, Monica!'), 'Oh, Monica!');
    assert.equal(stripCaptionNotes('- WOODY: Hey, Buzz. (SIGHS)'), 'Hey, Buzz.');
    assert.equal(stripCaptionNotes('Wait. MAN 2: No way!'), 'Wait. No way!');
    assert.equal(stripCaptionNotes('♪ (MUSIC PLAYING) ♪'), '');
    assert.equal(stripCaptionNotes('（เสียงประกอบ）'), '');
    assert.equal(stripCaptionNotes('【Music】'), '');
    assert.equal(stripCaptionNotes('(light music)'), '');
    assert.equal(stripCaptionNotes('Hello （หัวเราะ）'), 'Hello');
  });

  it('keeps normal colons and words', () => {
    assert.equal(stripCaptionNotes('Note: the store opens at 9:30.'), 'Note: the store opens at 9:30.');
    assert.equal(stripCaptionNotes('I am OK, Mom.'), 'I am OK, Mom.');
  });
});

import { isChannelNameLine } from './cc-import.rules';

describe('isChannelNameLine', () => {
  it('matches the channel name card only', () => {
    assert.equal(isChannelNameLine('English Singsing', 'English Singsing'), true);
    assert.equal(isChannelNameLine('Welcome to English Singsing!', 'English Singsing'), true);
    assert.equal(isChannelNameLine('What day is it today?', 'English Singsing'), false);
    assert.equal(isChannelNameLine('Hello', ''), false);
  });
});
