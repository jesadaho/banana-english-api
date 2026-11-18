import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BARE_PRAISE_LINES } from './english-praises';

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
 * Emoji are never spoken (sanitizeTtsSpeech drops them), so variants must collide.
 */
export function ttsBankLookupKey(text: string | null | undefined): string {
  return ttsBankKey(text)
    .normalize('NFC')
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

/** Leading praise that may glue onto old bank clips or be split at runtime. */
const LEADING_PRAISE_RE = (() => {
  const extras = [
    'ดีครับ',
    'ถูกต้องครับ',
    'ใช่เลยครับ',
    'เยี่ยมครับ',
    'สุดยอดครับ',
    'เก่งมากครับ',
    'ถูกต้อง',
    'ดีมาก',
    'เยี่ยม',
  ];
  const parts = [...BARE_PRAISE_LINES, ...extras]
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  return new RegExp(`^(?:${parts.join('|')})[!！]?\\s+`, 'iu');
})();

/** Drop one leading praise token. Lookup-only — does not change bank keys. */
export function stripLeadingPraise(text: string): string {
  const key = ttsBankKey(text);
  if (!key) return '';
  const next = key.replace(LEADING_PRAISE_RE, '').trim();
  return next === key ? key : next;
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

function lookupExactOrFolded(
  lines: Record<string, string>,
  key: string,
  foldedIndex?: Map<string, string>,
): string | null {
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

/**
 * Resolve a spoken line to a bank URL.
 * Order: exact → folded (emoji/case/punct) → strip leading praise → repeat.
 */
export function lookupTtsBankUrl(
  lines: Record<string, string>,
  ttsText: string | null | undefined,
  textEn?: string | null,
  foldedIndex?: Map<string, string>,
): string | null {
  let key = ttsBankKey(spokenTurnText(ttsText, textEn));
  if (!key) return null;

  for (let i = 0; i < 4; i++) {
    const hit = lookupExactOrFolded(lines, key, foldedIndex);
    if (hit) return hit;
    const stripped = stripLeadingPraise(key);
    if (!stripped || stripped === key) break;
    key = stripped;
  }

  // Legacy: bank has "Praise + body" but request is bare body — try prefixing.
  const bare = ttsBankKey(spokenTurnText(ttsText, textEn));
  if (
    bare &&
    !BARE_PRAISE_LINES.some((p) => bare === p || bare.startsWith(`${p} `))
  ) {
    for (const praise of BARE_PRAISE_LINES) {
      for (const sep of [' ', '\n'] as const) {
        const prefixed = lookupExactOrFolded(
          lines,
          `${praise}${sep}${bare}`,
          foldedIndex,
        );
        if (prefixed) return prefixed;
      }
    }
  }
  return null;
}

let cached: TtsBankFile | null = null;
let cachedFolded: Map<string, string> | null = null;

/**
 * Folded index plus praise-stripped aliases so a banked
 * "Very good! body…" still hits a request that is only "body…".
 */
function foldedBankIndex(lines: Record<string, string>): Map<string, string> {
  const index = new Map<string, string>();
  const indexOne = (text: string, url: string) => {
    const folded = ttsBankLookupKey(text);
    if (folded && !index.has(folded)) index.set(folded, url);
  };
  for (const [banked, url] of Object.entries(lines)) {
    indexOne(banked, url);
    let cursor = banked;
    for (let i = 0; i < 3; i++) {
      const stripped = stripLeadingPraise(cursor);
      if (!stripped || stripped === cursor) break;
      indexOne(stripped, url);
      cursor = stripped;
    }
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
