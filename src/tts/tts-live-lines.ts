import { createHash } from 'node:crypto';
import { ttsBankKey } from './tts-bank';

/** Lines longer than this are one-off essays, not candidates to bank. */
export const TTS_LIVE_LINE_MAX_CHARS = 800;

export type LiveSpeechInput = {
  text?: string | null;
  audioUrl?: string | null;
  praiseText?: string | null;
  praiseAudioUrl?: string | null;
  sceneLines?: Array<{ textEn?: string | null }> | null;
  /** Drop the line when it contains this learner name. */
  excludeName?: string | null;
};

/**
 * Sentences the app will speak with live TTS on this turn.
 * A scene replaces the bubble. A banked URL is already covered.
 */
export function liveSpeechLines(input: LiveSpeechInput): string[] {
  const scene = (input.sceneLines ?? [])
    .map((line) => acceptLiveLine(line.textEn, input.excludeName))
    .filter((line): line is string => line != null);
  if (scene.length > 0) return unique(scene);

  const out: string[] = [];
  if (!input.audioUrl) {
    const body = acceptLiveLine(input.text, input.excludeName);
    if (body) out.push(body);
  }
  if (!input.praiseAudioUrl) {
    const praise = acceptLiveLine(input.praiseText, input.excludeName);
    if (praise && !out.includes(praise)) out.push(praise);
  }
  return out;
}

export function ttsLiveLineKey(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function acceptLiveLine(
  raw: string | null | undefined,
  excludeName?: string | null,
): string | null {
  const text = ttsBankKey(raw);
  if (!text || text.length > TTS_LIVE_LINE_MAX_CHARS) return null;
  if (text.includes('{') || text.includes('}') || text.includes('<')) {
    return null;
  }
  const name = excludeName?.trim();
  if (name && name.length >= 2 && text.toLowerCase().includes(name.toLowerCase())) {
    return null;
  }
  return text;
}

function unique(lines: string[]): string[] {
  return [...new Set(lines)];
}
