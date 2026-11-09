import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alignSentences,
  dialogueSentences,
  extractDialogue,
  htmlToLines,
  isVoaLessonUrl,
  parseVoaLesson,
  parseVoaSeries,
  pickVoaVideos,
} from './voa-import.rules';

const LESSON_HTML = `
<html><head>
<meta property="og:title" content="Lesson 1: Welcome! | VOA Learning English">
<meta property="og:image" content="https://gdb.voanews.com/thumb.jpg">
<script>var x = "Anna: not dialogue";</script>
</head><body>
<a href="https://voa-video-ns.akamaized.net/pangeavideo/2021/02/5/5f/5f00c78a_240p.mp4?cb=1&download=1">240p</a>
<a href="https://voa-video-ns.akamaized.net/pangeavideo/2021/02/5/5f/5f00c78a.mp4?cb=1">360p</a>
<a href="https://voa-video-ns.akamaized.net/pangeavideo/2021/02/5/5f/5f00c78a_480p.mp4?cb=1">480p</a>
<a href="https://voa-video-ns.akamaized.net/pangeavideo/2021/02/9/9a/other_hq.mp4">speaking</a>
<h2>Conversation</h2>
<p><strong>Pete:</strong> Hi! Are you Anna?</p>
<p><strong>Anna:</strong> Yes! Hi there! Are you Pete?</p>
<p>Pete: Yes. Welcome to Washington, D.C. It&#39;s a big city.</p>
<h2>Speaking Practice</h2>
<p>Anna: This is not part of it.</p>
</body></html>`;

describe('VOA importer rules', () => {
  it('tells lesson pages from series pages', () => {
    assert.equal(isVoaLessonUrl('https://learningenglish.voanews.com/a/lets-learn-english-lesson-one/3111026.html'), true);
    assert.equal(isVoaLessonUrl('https://learningenglish.voanews.com/p/5644.html'), false);
  });

  it('parses title, main video files and the conversation only', () => {
    const lesson = parseVoaLesson(LESSON_HTML);
    assert.equal(lesson.title, 'Lesson 1: Welcome!');
    assert.equal(lesson.thumbnailUrl, 'https://gdb.voanews.com/thumb.jpg');
    assert.deepEqual(lesson.videos.map((v) => v.quality), ['240p', 'default', '480p']);
    assert.deepEqual(lesson.lines, [
      { speaker: 'Pete', text: 'Hi! Are you Anna?' },
      { speaker: 'Anna', text: 'Yes! Hi there! Are you Pete?' },
      { speaker: 'Pete', text: "Yes. Welcome to Washington, D.C. It's a big city." },
    ]);
    const picked = pickVoaVideos(lesson.videos);
    assert.ok(picked?.play.endsWith('_480p.mp4'));
    assert.ok(picked?.stt.endsWith('_240p.mp4'));
  });

  it('falls back to the first run of speaker lines without a heading', () => {
    const lines = htmlToLines('<p>Intro text</p><p>Anna: Hello.</p><p>Pete: Hi.</p>');
    assert.deepEqual(extractDialogue(lines).map((l) => l.speaker), ['Anna', 'Pete']);
  });

  it('lists lesson links on a series page', () => {
    const series = parseVoaSeries(`
      <a href="/a/lets-learn-english-lesson-one/3111026.html" title="Lesson 1: Welcome!">x</a>
      <a href="https://learningenglish.voanews.com/a/lets-learn-english-lesson-2-hello/3113733.html">Lesson 2: Hello</a>
      <a href="/a/lets-learn-english-lesson-one/3111026.html">dup</a>
      <a href="/p/5644.html">series</a>`);
    assert.deepEqual(series, [
      { url: 'https://learningenglish.voanews.com/a/lets-learn-english-lesson-one/3111026.html', title: 'Lesson 1: Welcome!' },
      { url: 'https://learningenglish.voanews.com/a/lets-learn-english-lesson-2-hello/3113733.html', title: 'Lesson 2: Hello' },
    ]);
  });

  it('splits turns into practice sentences, keeping tiny bits together', () => {
    assert.deepEqual(
      dialogueSentences([{ speaker: 'Anna', text: 'Yes! Hi there! Are you Pete?' }]),
      ['Yes! Hi there!', 'Are you Pete?'],
    );
  });

  it('aligns sentences to word timestamps and interpolates misses', () => {
    const words = [
      { word: 'Hi', start: 1.0, end: 1.2 },
      { word: 'are', start: 1.3, end: 1.4 },
      { word: 'you', start: 1.4, end: 1.5 },
      { word: 'Anna', start: 1.5, end: 1.9 },
      { word: 'yes', start: 2.5, end: 2.7 },
      { word: 'welcome', start: 6.0, end: 6.4 },
    ];
    const out = alignSentences(['Hi! Are you Anna?', 'Zzz qqq.', 'Welcome!'], words);
    assert.equal(out[0].startMs, 850);
    assert.ok(out[0].endMs >= 1900);
    assert.ok(out[1].startMs >= out[0].endMs && out[1].endMs <= out[2].startMs);
    assert.ok(out[2].startMs <= 6000 && out[2].endMs >= 6400);
  });
});
