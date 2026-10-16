import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  audioUrlForConversationLine,
  collectConversationBankJobs,
  conversationClipHash,
} from './conversation-tts-bank';
import { conversationVoiceFor } from './conversation-voices';
import { ttsBankObjectPath } from './tts-bank';

describe('conversation voice bank', () => {
  it('gives Max and May a lighter child voice than the other characters', () => {
    const max = conversationVoiceFor('foundation_v7_u03n06');
    const may = conversationVoiceFor('foundation_v7_u13n06');
    const mali = conversationVoiceFor('foundation_v7_u09n09');
    assert.equal(max?.voice, 'Achird');
    assert.match(max?.prompt ?? '', /10 to 13/);
    assert.equal(may?.voice, 'Leda');
    assert.match(may?.prompt ?? '', /10 or 11/);
    assert.equal(mali?.voice, 'Callirrhoe');
    assert.doesNotMatch(mali?.prompt ?? '', /10 or 11|10 to 13/);
  });

  it('does not reuse the Teacher B clip for a conversation line', () => {
    const line = 'Hello! How can I help?';
    const voice = conversationVoiceFor('foundation_v7_u09n09');
    assert.ok(voice);
    const teacherPath = ttsBankObjectPath(line);
    const characterPath = conversationClipHash(voice, line);
    assert.equal(teacherPath.includes(characterPath), false);
    assert.equal(
      audioUrlForConversationLine('foundation_v7_u09n09', line, {
        model: 'gemini-2.5-flash-tts',
        clips: {},
      }),
      null,
    );
  });

  it('records a shared sentence once per character voice', () => {
    const jobs = collectConversationBankJobs();
    const help = jobs.filter((job) => job.text === 'Hi! Can I help you?');
    const voices = new Set(help.map((job) => job.voice.voice));
    assert.ok(voices.has('Callirrhoe'));
    assert.equal(help.length, voices.size);
    assert.ok(jobs.length > 40);
  });
});
