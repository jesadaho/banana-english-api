import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FOUNDATION_V7_CATALOG } from './foundation-v7-path.data';
import { listenDrillItemsForChapter } from './listen-drill.data';
import {
  collectListenDrillConversationJobs,
  collectListenDrillLessonLines,
  listenDrillConversationVoice,
  withListenDrillAudio,
} from './listen-drill.audio';

describe('Listen Up (easy) audio', () => {
  it('uses the conversation character voice for conversation lines', () => {
    const items = withListenDrillAudio('v7_u02', listenDrillItemsForChapter('v7_u02'));
    const card = items.find((i) => i.text === 'Is this your student card?');
    assert.ok(card);
    assert.equal(card.voice, listenDrillConversationVoice('v7_u02')?.voice);
    // Same file the learner hears in the conversation.
    assert.match(card.audioUrl ?? '', /tts%2Fconversation%2Fv1%2F/);
    // Taught sentences: the authored character (Mali → Callirrhoe).
    const thanks = items.find((i) => i.text === 'Thank you.');
    assert.equal(thanks?.speaker, 'Mali');
    assert.equal(thanks?.voice, 'Callirrhoe');
  });

  it('falls back to live TTS (null url) when a line is not banked yet', () => {
    const [item] = withListenDrillAudio(
      'v7_u02',
      [{ id: 'x', text: 'Zebra purple quietly.', textTh: 'x', source: 'lesson' }],
      { lesson: { model: 'm', voice: 'v', lines: {} }, conversation: { model: 'm', clips: {} } },
    );
    assert.equal(item.audioUrl, null);
  });

  it('every chapter with conversation lines has a character voice, and bank jobs cover them', () => {
    const jobs = collectListenDrillConversationJobs();
    assert.ok(jobs.length > 0);
    assert.equal(new Set(jobs.map((j) => j.hash)).size, jobs.length);
    assert.ok(jobs.length >= 90);
    // Every line has a character voice — nothing left for the Teacher B bank.
    assert.deepEqual(collectListenDrillLessonLines(), []);
  });

  it('A1 drills only use A1 characters', () => {
    const allowed = new Set(['Max', 'May', 'Mali', 'John', 'Minnie']);
    for (const chapter of FOUNDATION_V7_CATALOG.chapters) {
      for (const item of withListenDrillAudio(chapter.id, listenDrillItemsForChapter(chapter.id))) {
        assert.ok(allowed.has(item.speaker ?? ''), `${chapter.id}: ${item.text} → ${item.speaker}`);
      }
    }
  });
});
