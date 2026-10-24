import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSimulation } from '../simulations/simulations.data';
import { cacheableLinesForSimulation } from './conversation-tts-lines';
import {
  conversationSimulationIds,
  conversationVoiceFor,
  type ConversationVoice,
} from './conversation-voices';
import { ttsBankKey } from './tts-bank';

/** Same Cloud TTS model the app uses for live conversation speech. */
export const CONVERSATION_TTS_MODEL = 'gemini-2.5-flash-tts';

export interface ConversationClip {
  voice: string;
  text: string;
  url: string;
}

export interface ConversationTtsBank {
  model: string;
  clips: Record<string, ConversationClip>;
}

export interface ConversationBankJob {
  voice: ConversationVoice;
  text: string;
  hash: string;
}

export function conversationClipHash(
  voice: Pick<ConversationVoice, 'voice' | 'prompt'>,
  text: string,
  model: string = CONVERSATION_TTS_MODEL,
): string {
  return createHash('sha256')
    .update(`${model}\n${voice.voice}\n${voice.prompt}\n${ttsBankKey(text)}`)
    .digest('hex');
}

export function conversationClipObjectPath(hash: string): string {
  return `tts/conversation/v1/${hash}.mp3`;
}

/** One clip per voice + line. Shared sentences are recorded again for each character. */
export function collectConversationBankJobs(): ConversationBankJob[] {
  const jobs = new Map<string, ConversationBankJob>();
  for (const simulationId of conversationSimulationIds()) {
    const sim = getSimulation(simulationId);
    const voice = conversationVoiceFor(simulationId);
    if (!sim || !voice) continue;
    for (const text of cacheableLinesForSimulation(sim)) {
      const hash = conversationClipHash(voice, text);
      if (jobs.has(hash)) continue;
      jobs.set(hash, { voice, text, hash });
    }
  }
  return [...jobs.values()].sort((a, b) =>
    a.text.localeCompare(b.text) || a.voice.voice.localeCompare(b.voice.voice),
  );
}

let cached: ConversationTtsBank | null = null;

export function loadConversationTtsBank(): ConversationTtsBank {
  if (cached) return cached;
  try {
    const path = join(__dirname, 'conversation-tts-bank.json');
    cached = JSON.parse(readFileSync(path, 'utf8')) as ConversationTtsBank;
  } catch {
    cached = { model: CONVERSATION_TTS_MODEL, clips: {} };
  }
  return cached;
}

/** Character clip only. A missing line stays on live TTS instead of Teacher B's bank. */
export function audioUrlForConversationLine(
  simulationId: string,
  text: string | null | undefined,
  bank: ConversationTtsBank = loadConversationTtsBank(),
): string | null {
  const voice = conversationVoiceFor(simulationId);
  const key = ttsBankKey(text);
  if (!voice || !key) return null;
  const clip = bank.clips[conversationClipHash(voice, key)];
  return clip?.url ?? null;
}

export interface ConversationReplyClips {
  /** Played first. Set only when the reply is split into two banked parts. */
  praiseAudioUrl: string | null;
  audioUrl: string | null;
}

const SENTENCE_BREAK_RE = /(?<=[.!?])\s+/;

/**
 * Whole-reply clip, or two banked parts played back to back.
 * Gemini often adds a short reaction ("That is cool!") before a scripted
 * question, which misses the whole-line bank even when both halves exist.
 * The app plays `praiseAudioUrl` then `audioUrl`, so at most two parts.
 */
export function audioClipsForConversationReply(
  simulationId: string,
  text: string | null | undefined,
  bank: ConversationTtsBank = loadConversationTtsBank(),
): ConversationReplyClips {
  const whole = audioUrlForConversationLine(simulationId, text, bank);
  if (whole) return { praiseAudioUrl: null, audioUrl: whole };

  const sentences = ttsBankKey(text).split(SENTENCE_BREAK_RE).filter(Boolean);
  for (let cut = 1; cut < sentences.length; cut++) {
    const head = audioUrlForConversationLine(
      simulationId,
      sentences.slice(0, cut).join(' '),
      bank,
    );
    if (!head) continue;
    const tail = audioUrlForConversationLine(
      simulationId,
      sentences.slice(cut).join(' '),
      bank,
    );
    if (tail) return { praiseAudioUrl: head, audioUrl: tail };
  }
  return { praiseAudioUrl: null, audioUrl: null };
}
