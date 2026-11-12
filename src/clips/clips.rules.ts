/** Clips tab: pure helpers (parsing, validation, dictation defaults). */

export const CLIP_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
/** Section rails on the Clips tab (order = display order). */
export const CLIP_CATEGORIES = [
  'daily',
  'cartoons',
  'movies',
  'celebs',
  'songs',
  'learning',
  'toeic',
  'ielts',
  'tips',
] as const;
export const CLIP_MODES = ['watch', 'dictation', 'shadowing'] as const;
export type ClipMode = (typeof CLIP_MODES)[number];
export type ClipCategory = (typeof CLIP_CATEGORIES)[number];

export const CLIP_CATEGORY_TITLES: Record<ClipCategory, { en: string; th: string }> = {
  daily: { en: 'Daily conversation', th: 'บทสนทนาประจำวัน' },
  cartoons: { en: 'Cartoons & animation', th: 'การ์ตูน & แอนิเมชัน' },
  movies: { en: 'Movies & series', th: 'หนัง & ซีรีส์' },
  celebs: { en: 'Entertainment & celebs', th: 'บันเทิง & คนดัง' },
  songs: { en: 'Songs', th: 'เพลง' },
  learning: { en: 'Learning with BBC & VOA', th: 'Learning - เรียนกับ BBC & VOA' },
  toeic: { en: 'TOEIC Listening', th: 'TOEIC Listening' },
  ielts: { en: 'IELTS Listening', th: 'IELTS Listening' },
  tips: { en: 'Study tips', th: 'เคล็ดลับเรียนภาษา' },
};

/** Legacy ids → current rails (older imports / admin). */
const CLIP_CATEGORY_ALIASES: Record<string, ClipCategory> = {
  news: 'learning',
  stories: 'cartoons',
  entertainment: 'celebs',
  cartoon: 'cartoons',
  study_tips: 'tips',
  learning_broadcast: 'learning',
  bbc_voa: 'learning',
  listening: 'tips',
};

export function normalizeClipCategory(raw: unknown): ClipCategory {
  const s = String(raw ?? '').trim().toLowerCase();
  if ((CLIP_CATEGORIES as readonly string[]).includes(s)) return s as ClipCategory;
  return CLIP_CATEGORY_ALIASES[s] ?? 'daily';
}

/**
 * Pick a Clips-tab section from the title + optional catalog hint
 * (Parroto sheet name, channel, etc.).
 */
export function guessClipCategory(
  title: string,
  hint?: string | null,
): ClipCategory {
  const t = title ?? '';
  const h = (hint ?? '').toLowerCase();

  if (/toeic/i.test(t) || h.includes('toeic')) return 'toeic';
  if (/ielts/i.test(t) || h.includes('ielts')) return 'ielts';

  if (
    /official (music )?video|lyrics?\b|\bsong\b|karaoke|sing along|music video/i.test(t) ||
    (h.includes('song') && !h.includes('kids'))
  ) {
    return 'songs';
  }

  if (
    /bbc|voa|voice of america|english we speak|english in a minute|eiam|learners'? questions|news words|english at work/i.test(
      t,
    ) ||
    h.includes('bbc') ||
    h.includes('voa')
  ) {
    return 'learning';
  }

  if (
    /ghibli|disney|pixar|dreamworks|cartoon|anime|nickelodeon|spongebob|tom\s*&\s*jerry|tom and jerry|frozen|little fox|mickey|minnie|powerpuff|we bare bears|phineas|zootopia|toy story|rapunzel|tangled|whisper of the heart|your name|kiki'?s delivery|princess mononoke|penguin/i.test(
      t,
    ) ||
    h.includes('kid')
  ) {
    return 'cartoons';
  }

  if (
    /interview|celebrity|blackpink|taylor swift|emma watson|comedy central|talk show|fan questions/i.test(
      t,
    ) ||
    h.includes('entertainment')
  ) {
    return 'celebs';
  }

  if (
    /trailer|scene|movie|series|nine-nine|friends\b|stranger things|netflix|harry potter|short film|wonder woman|crazy rich/i.test(
      t,
    ) ||
    h.includes('movie')
  ) {
    return 'movies';
  }

  if (
    /tips?\b|how to (improve|learn|study|prepare)|fluent|mistake|listening practice|study smarter|learning resource/i.test(
      t,
    ) ||
    h.includes('listening time') ||
    h.includes('learning resource')
  ) {
    return 'tips';
  }

  if (h.includes('daily') || h.includes('conversation')) return 'daily';
  return 'daily';
}


/** Videos tab "Browse by Channel" tiles (derived from the clip's credit line). */
export const CLIP_CHANNELS = ['bbc', 'voa', 'listening_time', 'banana'] as const;
export type ClipChannel = (typeof CLIP_CHANNELS)[number];

export const CLIP_CHANNEL_TITLES: Record<ClipChannel, { en: string; th: string }> = {
  bbc: { en: 'BBC Learning English', th: 'BBC Learning English' },
  voa: { en: 'VOA Learning English', th: 'VOA Learning English' },
  listening_time: { en: 'Listening Time', th: 'Listening Time' },
  banana: { en: 'Banana Originals', th: 'Banana Originals' },
};

/** "YouTube · BBC Learning English" → bbc · VOA credit → voa · no credit → banana. */
export function clipChannelOf(credit: string | null | undefined): ClipChannel | null {
  const c = (credit ?? '').trim().toLowerCase();
  if (!c || c.includes('banana')) return 'banana';
  if (c.includes('bbc')) return 'bbc';
  if (c.includes('voa') || c.includes('voice of america')) return 'voa';
  if (c.includes('listening time')) return 'listening_time';
  return null;
}

/**
 * "Recommended for You" level: the level the learner practises most in
 * Videos, else their Level Test band, else the onboarding self-report, else A2.
 */
export function recommendedClipLevel(p: {
  practisedLevels: string[];
  placementBand?: string | null;
  selfReported?: string | null;
}): (typeof CLIP_LEVELS)[number] {
  const levels = CLIP_LEVELS as readonly string[];
  const counts = new Map<string, number>();
  for (const l of p.practisedLevels) {
    if (levels.includes(l)) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  if (counts.size > 0) {
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] as (typeof CLIP_LEVELS)[number];
  }
  const band = (p.placementBand ?? '').trim();
  if (band.startsWith('Seed') || band.startsWith('A1')) return 'A1';
  if (band.startsWith('A2')) return 'A2';
  if (band.startsWith('B1')) return 'B1';
  if (band.startsWith('B2') || band.startsWith('C')) return 'B2';
  switch (p.selfReported) {
    case 'beginner':
      return 'A1';
    case 'elementary':
      return 'A2';
    case 'intermediate':
      return 'B1';
    case 'advanced':
      return 'B2';
    default:
      return 'A2';
  }
}

/**
 * Order clips for one learner: their level first, then harder levels, then
 * easier ones; within a level, Parroto popularity, then the original order.
 */
export function sortClipsForLearner<T extends { level: string }>(
  clips: T[],
  p: { level: string; popularity: (c: T) => number },
): T[] {
  const levels = CLIP_LEVELS as readonly string[];
  const target = levels.indexOf(p.level);
  const rank = (l: string) => {
    const i = levels.indexOf(l);
    if (i < 0 || target < 0) return 9;
    // Own level, then harder levels upward, then easier ones (nearest first).
    return i >= target ? i - target : levels.length + (target - i);
  };
  return clips
    .map((c, order) => ({ c, order, r: rank(c.level), n: p.popularity(c) }))
    .sort((a, b) => a.r - b.r || b.n - a.n || a.order - b.order)
    .map(({ c }) => c);
}

export function pickRecommendedClips<T extends { id: string; level: string }>(
  clips: T[],
  p: { level: string; startedIds: Set<string>; popularity: (c: T) => number; limit?: number },
): T[] {
  return sortClipsForLearner(
    clips.filter((c) => !p.startedIds.has(c.id)),
    p,
  ).slice(0, p.limit ?? 10);
}

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

/** Phrase / pattern spans to highlight in the watch transcript. */
export type ClipHighlightKind = 'phrase' | 'pattern';
export type ClipHighlight = {
  /** Inclusive word index (space-split, same as dictation). */
  start: number;
  /** Exclusive word index. */
  end: number;
  kind: ClipHighlightKind;
  /** Short Thai tip, e.g. "figure out = เข้าใจ / คิดออก". */
  labelTh: string;
};

/** Short lines (≤ 6 words) may be rebuilt whole; longer ones get ~half, 3–6 blanks. */
export function maxDictationBlanks(wordCount: number): number {
  return wordCount <= 6 ? wordCount : Math.min(6, Math.max(3, Math.ceil(wordCount / 2)));
}

/** Keep at most maxDictationBlanks of hide, preferring longer (content) words. */
export function limitDictationHide(words: string[], hide: number[]): number[] {
  const max = maxDictationBlanks(words.length);
  if (hide.length <= max) return hide;
  const len = (i: number) => (words[i] ?? '').toLowerCase().replace(/[^a-z0-9']/g, '').length;
  return [...hide]
    .sort((a, b) => len(b) - len(a) || a - b)
    .slice(0, max)
    .sort((a, b) => a - b);
}

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
  return {
    hide: limitDictationHide(words, hide.length ? hide : defaultDictationHide(text)),
    distractors,
  };
}

const HIGHLIGHT_KINDS = new Set<ClipHighlightKind>(['phrase', 'pattern']);

/**
 * Keep 0–2 valid, non-overlapping word spans. Prefer longer / earlier spans
 * when Gemini returns junk indexes.
 */
export function normalizeHighlights(raw: unknown, text: string): ClipHighlight[] {
  const words = clipWords(text);
  if (!Array.isArray(raw) || words.length === 0) return [];
  const parsed: ClipHighlight[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const start = Number(o.start);
    const end = Number(o.end);
    const kind = String(o.kind ?? '') as ClipHighlightKind;
    const labelTh = String(o.labelTh ?? '').trim().slice(0, 80);
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (start < 0 || end > words.length || end - start < 2) continue;
    if (!HIGHLIGHT_KINDS.has(kind) || !labelTh) continue;
    parsed.push({ start, end, kind, labelTh });
  }
  parsed.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: ClipHighlight[] = [];
  for (const h of parsed) {
    if (out.some((x) => h.start < x.end && h.end > x.start)) continue;
    out.push(h);
    if (out.length >= 2) break;
  }
  return out;
}
