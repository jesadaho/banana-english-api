/** Clips tab: pure helpers (parsing, validation, dictation defaults). */

export const CLIP_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export const CLIP_CATEGORIES = ['daily', 'movies', 'stories', 'songs', 'news'] as const;
export const CLIP_MODES = ['watch', 'dictation', 'shadowing'] as const;
export type ClipMode = (typeof CLIP_MODES)[number];

export const CLIP_CATEGORY_TITLES: Record<string, { en: string; th: string }> = {
  daily: { en: 'Daily life', th: 'ชีวิตประจำวัน' },
  movies: { en: 'Series & movies', th: 'ซีรีส์ & หนังสั้น' },
  stories: { en: 'Stories', th: 'เรื่องสั้น' },
  songs: { en: 'Songs', th: 'เพลง' },
  news: { en: 'Easy news', th: 'ข่าวง่าย ๆ' },
};

export function isClipMode(v: unknown): v is ClipMode {
  return typeof v === 'string' && (CLIP_MODES as readonly string[]).includes(v);
}

/** youtu.be/ID · watch?v=ID · shorts/ID · embed/ID · raw 11-char id. */
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m =
    /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(s);
  return m ? m[1] : null;
}

export type TimedLine = { startMs: number; endMs: number; text: string };

function parseClock(raw: string): number | null {
  // 00:01:02,345 · 01:02.345 · 62.3
  const t = raw.trim().replace(',', '.');
  const parts = t.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return Math.round(sec * 1000);
}

/**
 * Transcript import. Accepts SRT / WebVTT (keeps times) or plain text, one
 * sentence per line (times 0 → set them with the admin timing tool).
 */
export function parseTranscript(input: string): TimedLine[] {
  const text = input.replace(/\r/g, '').trim();
  if (!text) return [];
  const cue = /(\d{1,2}:)?\d{1,2}:\d{1,2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{1,2}[.,]\d{1,3}/;
  if (cue.test(text)) {
    const out: TimedLine[] = [];
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const i = lines.findIndex((l) => cue.test(l));
      if (i < 0) continue;
      const [a, b] = lines[i].split('-->').map((x) => x.trim().split(/\s+/)[0]);
      const startMs = parseClock(a);
      const endMs = parseClock(b);
      const body = lines
        .slice(i + 1)
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (startMs == null || endMs == null || !body) continue;
      out.push({ startMs, endMs, text: body });
    }
    return out;
  }
  return text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && l.toUpperCase() !== 'WEBVTT')
    .map((l) => ({ startMs: 0, endMs: 0, text: l }));
}

/** Returns an error code, or null when the lines can be published. */
export function validateTimedLines(lines: TimedLine[]): string | null {
  if (lines.length === 0) return 'no_sentences';
  let prevStart = -1;
  for (const [i, l] of lines.entries()) {
    if (!l.text.trim()) return `empty_text_${i + 1}`;
    if (!(l.endMs > l.startMs)) return `bad_time_${i + 1}`;
    if (l.startMs < prevStart) return `out_of_order_${i + 1}`;
    prevStart = l.startMs;
  }
  return null;
}

const STOP = new Set([
  'a', 'an', 'the', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'is', 'am',
  'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'and', 'or', 'but',
  'for', 'my', 'your', 'me', 'do', 'so', 'oh',
]);

export function clipWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Default dictation: short lines hide every word (rebuild the whole line);
 * longer lines hide up to 6 content words, the rest stay shown.
 */
export function defaultDictationHide(text: string): number[] {
  const words = clipWords(text);
  if (words.length <= 8) return words.map((_, i) => i);
  const scored = words
    .map((w, i) => ({ i, core: w.toLowerCase().replace(/[^a-z']/g, '') }))
    .filter((w) => w.core.length >= 3 && !STOP.has(w.core));
  return scored
    .sort((a, b) => b.core.length - a.core.length)
    .slice(0, 6)
    .map((w) => w.i)
    .sort((a, b) => a - b);
}

export type ClipDictation = { hide: number[]; distractors: string[] };

export function normalizeDictation(raw: unknown, text: string): ClipDictation {
  const words = clipWords(text);
  const r = (raw ?? {}) as { hide?: unknown; distractors?: unknown };
  const hide = Array.isArray(r.hide)
    ? [...new Set(r.hide.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < words.length))].sort((a, b) => a - b)
    : [];
  const distractors = Array.isArray(r.distractors)
    ? r.distractors
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
        .map((d) => d.trim())
        .filter((d) => !words.some((w) => w.toLowerCase() === d.toLowerCase()))
        .slice(0, 3)
    : [];
  return { hide: hide.length ? hide : defaultDictationHide(text), distractors };
}
