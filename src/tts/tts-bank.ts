import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Cloud TTS model used for scripted lesson clips. */
export const TTS_BANK_MODEL = 'gemini-3.1-flash-tts-preview';

/** Same prebuilt voice the app uses for Teacher B. */
export const TTS_BANK_VOICE = 'Sadachbia';

/**
 * Short Teacher B prompt, sent as Cloud TTS `input.prompt` — not spoken text.
 * Matches the app default so banked clips sound like live gRPC.
 */
export const TTS_BANK_PROMPT =
  'Speak warmly and naturally as Teacher B, a friendly English teacher for Thai learners.';

export type TtsBankFile = {
  model: string;
  voice: string;
  lines: Record<string, string>;
};

/** Collapse whitespace so the same spoken line always hits one file. */
export function ttsBankKey(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Object name for one spoken line. Includes model and voice so a regen does not collide. */
export function ttsBankObjectPath(
  text: string,
  model: string = TTS_BANK_MODEL,
): string {
  const hash = createHash('sha256')
    .update(`${model}\n${TTS_BANK_VOICE}\n${ttsBankKey(text)}`)
    .digest('hex');
  return `tts/v1/${hash}.mp3`;
}

/** Speech the app will play: backend ttsText when present, otherwise the bubble text. */
export function spokenTurnText(
  ttsText: string | null | undefined,
  textEn: string | null | undefined,
): string {
  const spoken = ttsText?.trim();
  if (spoken) return spoken;
  return (textEn ?? '').trim();
}

export function lookupTtsBankUrl(
  lines: Record<string, string>,
  ttsText: string | null | undefined,
  textEn?: string | null,
): string | null {
  const key = ttsBankKey(spokenTurnText(ttsText, textEn));
  if (!key) return null;
  return lines[key] ?? null;
}

let cached: TtsBankFile | null = null;

export function loadTtsBank(): TtsBankFile {
  if (cached) return cached;
  const path = join(__dirname, 'tts-bank.json');
  cached = JSON.parse(readFileSync(path, 'utf8')) as TtsBankFile;
  return cached;
}

/** Public URL when this turn's spoken line is in the bank; otherwise null (live TTS). */
export function audioUrlForTurn(
  ttsText: string | null | undefined,
  textEn?: string | null,
): string | null {
  return lookupTtsBankUrl(loadTtsBank().lines, ttsText, textEn);
}

/** Body clip plus an optional praise clip. Praise is never folded into the body URL. */
export function audioUrlsForSpokenTurn(input: {
  ttsText?: string | null;
  textEn?: string | null;
  praiseText?: string | null;
}): { audioUrl: string | null; praiseAudioUrl: string | null } {
  const body = spokenTurnText(input.ttsText, input.textEn);
  const praise = input.praiseText?.trim();
  return {
    audioUrl: body ? lookupTtsBankUrl(loadTtsBank().lines, body, null) : null,
    praiseAudioUrl: praise
      ? lookupTtsBankUrl(loadTtsBank().lines, praise, null)
      : null,
  };
}
