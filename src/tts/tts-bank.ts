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

/**
 * Loose key for lookup only — not used in object hashes.
 * Hits the same clip when Gemini changes Latin case, trailing punct, or ๆ spacing.
 */
export function ttsBankLookupKey(text: string | null | undefined): string {
  return ttsBankKey(text)
    .normalize('NFC')
    // Emoji are never spoken (sanitizeTtsSpeech drops them), so 🎉 / 🍌✨
    // variants must hit the same clip.
    .replace(
      /[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\uFE0F\u200D]|[\u{1F000}-\u{1FAFF}]/gu,
      ' ',
    )
    .replace(/^["“']+|["”']+$/g, '')
    .replace(/\s*ๆ/gu, ' ๆ')
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
  foldedIndex?: Map<string, string>,
): string | null {
  const key = ttsBankKey(spokenTurnText(ttsText, textEn));
  if (!key) return null;
  const direct = lines[key];
  if (direct) return direct;
  const folded = ttsBankLookupKey(key);
  if (!folded) return null;
  const indexed = foldedIndex?.get(folded);
  if (indexed) return indexed;
  if (foldedIndex) return null;
  for (const [banked, url] of Object.entries(lines)) {
    if (ttsBankLookupKey(banked) === folded) return url;
  }
  return null;
}

let cached: TtsBankFile | null = null;
let cachedFolded: Map<string, string> | null = null;

function foldedBankIndex(lines: Record<string, string>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [banked, url] of Object.entries(lines)) {
    const folded = ttsBankLookupKey(banked);
    if (folded && !index.has(folded)) index.set(folded, url);
  }
  return index;
}

export function loadTtsBank(): TtsBankFile {
  if (cached) return cached;
  const path = join(__dirname, 'tts-bank.json');
  cached = JSON.parse(readFileSync(path, 'utf8')) as TtsBankFile;
  cachedFolded = foldedBankIndex(cached.lines);
  return cached;
}

/** Public URL when this turn's spoken line is in the bank; otherwise null (live TTS). */
export function audioUrlForTurn(
  ttsText: string | null | undefined,
  textEn?: string | null,
): string | null {
  const bank = loadTtsBank();
  return lookupTtsBankUrl(bank.lines, ttsText, textEn, cachedFolded ?? undefined);
}

/** Body clip plus an optional praise clip. Praise is never folded into the body URL. */
export function audioUrlsForSpokenTurn(input: {
  ttsText?: string | null;
  textEn?: string | null;
  praiseText?: string | null;
}): { audioUrl: string | null; praiseAudioUrl: string | null } {
  const body = spokenTurnText(input.ttsText, input.textEn);
  const praise = input.praiseText?.trim();
  const bank = loadTtsBank();
  const folded = cachedFolded ?? undefined;
  return {
    audioUrl: body
      ? lookupTtsBankUrl(bank.lines, body, null, folded)
      : null,
    praiseAudioUrl: praise
      ? lookupTtsBankUrl(bank.lines, praise, null, folded)
      : null,
  };
}

/**
 * Banked audio for a turn spoken as `lead` + `body` (reaction, then the next
 * question). Prefer two half clips when both are banked so praise and the
 * question stay reusable; fall back to the joined line if a half is missing.
 */
export function audioUrlsForSplitTurn(
  full: string,
  parts?: { lead: string; body: string } | null,
): { audioUrl: string | null; praiseAudioUrl: string | null } {
  const lead = parts?.lead?.trim();
  const body = parts?.body?.trim();
  if (lead && body) {
    const leadUrl = audioUrlForTurn(lead);
    const bodyUrl = audioUrlForTurn(body);
    if (leadUrl && bodyUrl) {
      return { audioUrl: bodyUrl, praiseAudioUrl: leadUrl };
    }
  }
  const whole = audioUrlForTurn(full);
  if (whole) return { audioUrl: whole, praiseAudioUrl: null };
  return { audioUrl: null, praiseAudioUrl: null };
}
