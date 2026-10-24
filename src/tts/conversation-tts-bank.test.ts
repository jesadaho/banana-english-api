import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  audioClipsForConversationReply,
  audioUrlForConversationLine,
  collectConversationBankJobs,
  conversationClipHash,
  type ConversationTtsBank,
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

  it('banks Max name, country, and short reactions', () => {
    const maxLines = new Set(
      collectConversationBankJobs()
        .filter((job) => job.voice.voice === 'Achird')
        .map((job) => job.text),
    );
    assert.ok(maxLines.has('What is your name?'));
    assert.ok(maxLines.has('Where are you from?'));
    assert.ok(maxLines.has('That is cool!'));
    assert.ok(maxLines.has('Do you like English?'));
  });

  describe('two-part replies', () => {
    const sim = 'foundation_first_conversation';
    const voice = conversationVoiceFor(sim);
    const bankWith = (lines: string[]): ConversationTtsBank => ({
      model: 'gemini-2.5-flash-tts',
      clips: Object.fromEntries(
        lines.map((text) => [
          conversationClipHash(voice!, text),
          { voice: voice!.voice, text, url: `url:${text}` },
        ]),
      ),
    });

    it('prefers the whole-line clip', () => {
      const bank = bankWith(['That is cool! Do you like English?', 'That is cool!']);
      assert.deepEqual(
        audioClipsForConversationReply(sim, 'That is cool! Do you like English?', bank),
        { praiseAudioUrl: null, audioUrl: 'url:That is cool! Do you like English?' },
      );
    });

    it('plays a banked reaction then a banked question', () => {
      const bank = bankWith(['That is cool!', 'Do you like English?']);
      assert.deepEqual(
        audioClipsForConversationReply(sim, 'That is cool!  Do you like English?', bank),
        { praiseAudioUrl: 'url:That is cool!', audioUrl: 'url:Do you like English?' },
      );
    });

    it('falls back to live TTS when either half is missing', () => {
      const bank = bankWith(['Do you like English?']);
      assert.deepEqual(
        audioClipsForConversationReply(sim, 'So fun! Do you like English?', bank),
        { praiseAudioUrl: null, audioUrl: null },
      );
    });
  });
});
