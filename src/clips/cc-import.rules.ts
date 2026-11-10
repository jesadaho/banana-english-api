/**
 * Import YouTube caption files (.srt/.vtt) the team downloaded: clean them
 * into timed segments, then turn segments into per-word times so the same
 * sentence aligner as VOA (alignSentences) can time AI-punctuated sentences.
 */
import type { SttWord } from './voa-import.rules';

export type Cue = { startMs: number; endMs: number; lines: string[] };
export type Segment = { startMs: number; endMs: number; text: string };

function clock(raw: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(raw.trim());
  if (!m) return null;
  const [, h, mm, ss, ms] = m;
  return ((Number(h ?? 0) * 60 + Number(mm)) * 60 + Number(ss)) * 1000 + Number(ms.padEnd(3, '0'));
}

/**
 * Cue-by-timestamp parsing (not blank-line blocks): auto captions put a
 * whitespace-only line inside a cue, which would split it in two.
 */
export function parseCues(text: string): Cue[] {
  const out: Cue[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let cur: Cue | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('-->')) {
      const [a, b] = line.split('-->').map((x) => x.trim().split(/\s+/)[0]);
      const startMs = clock(a);
      const endMs = clock(b);
      cur = startMs == null || endMs == null ? null : { startMs, endMs, lines: [] };
      if (cur) out.push(cur);
      continue;
    }
    if (!cur) continue;
    const t = line.replace(/<[^>]+>/g, '').trim();
    // A bare number right before the next timestamp is the SRT index.
    if (/^\d+$/.test(t) && (lines[i + 1] ?? '').includes('-->')) continue;
    if (t && t.toUpperCase() !== 'WEBVTT') cur.lines.push(t);
  }
  return out;
}

/**
 * Not speech: every [..] and (..) caption note — sound effects and stage
 * directions like (GIGGLES), [Laughter], (Music) — music notes and ">>".
 */
const NOISE = /\[[^\]]*\]|\([^)]*\)|♪+|>>/g;

/**
 * Speaker labels at the start of a line or after a sentence end:
 * "MICKEY: Whoa!", "MAN 2: Hi", "- WOODY: Hey". ALL-CAPS names only, so a
 * normal "Note: …" or "Time: 5pm" in dialogue is kept.
 */
const SPEAKER = /(^|[.!?]\s+|\s-\s*)[A-Z][A-Z0-9 .'&-]{0,24}:\s+/g;

/** Caption line → spoken words only. */
export function stripCaptionNotes(raw: string): string {
  return raw
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^-\s*/, '')
    .replace(SPEAKER, '$1')
    .replace(/^\s*-\s*/, '')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.;:!?\s]+/, '');
}

/**
 * Auto captions "roll up": each cue repeats the previous line plus a new one,
 * with 10 ms filler cues between. Keep only new text; drop [music] etc.
 */
export function cleanCues(cues: Cue[]): { segments: Segment[]; auto: boolean } {
  const tiny = cues.filter((c) => c.endMs - c.startMs < 60).length;
  const auto = cues.length > 0 && tiny > cues.length * 0.3;
  const segments: Segment[] = [];
  let last = '';
  for (const c of cues) {
    if (c.endMs - c.startMs < 60 || c.lines.length === 0) continue;
    const raw = auto ? c.lines[c.lines.length - 1] : c.lines.join(' ');
    const text = stripCaptionNotes(raw);
    if (!text || text === last) continue;
    last = text;
    // Auto cues overlap (end = next cue's end): clamp to the next start.
    const prev = segments[segments.length - 1];
    if (prev && prev.endMs > c.startMs) prev.endMs = Math.max(prev.startMs + 100, c.startMs);
    segments.push({ startMs: c.startMs, endMs: c.endMs, text });
  }
  return { segments, auto };
}

/** Spread each segment's words evenly over its time (good enough to align). */
export function segmentsToWords(segments: Segment[]): SttWord[] {
  const words: SttWord[] = [];
  for (const s of segments) {
    const parts = s.text.split(/\s+/).filter(Boolean);
    const step = (s.endMs - s.startMs) / Math.max(1, parts.length);
    parts.forEach((w, i) => {
      words.push({
        word: w,
        start: (s.startMs + step * i) / 1000,
        end: (s.startMs + step * (i + 1)) / 1000,
      });
    });
  }
  return words;
}

/** Captions without sentence punctuation need AI to split them. */
export function needsPunctuation(segments: Segment[]): boolean {
  const words = segments.flatMap((s) => s.text.split(/\s+/)).filter(Boolean);
  if (words.length === 0) return false;
  const ends = words.filter((w) => /[.?!]["”’)]?$/.test(w)).length;
  return ends < words.length / 25;
}

/** Keep the first [maxMs] of a long video (a practice clip, not a lecture). */
export function limitSegments(segments: Segment[], maxMs: number): Segment[] {
  return segments.filter((s) => s.startMs < maxMs);
}

export function splitPunctuated(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s));
}

/** Longest practice line (words) before it's split in two. */
export const MAX_LINE_WORDS = 14;

/** Words a part shouldn't end on when we have to cut mid-clause. */
const WEAK_END = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by',
  'that', 'my', 'your', 'his', 'her', 'our', 'their', 'its', 'i', 'you', 'we',
  'they', 'he', 'she', 'it', 'is', 'are', 'was', 'were', 'be', 'can', 'will',
  'would', 'could', 'should', 'some', 'any', 'this', 'these', 'those', 'very',
]);

const BREAK_BEFORE = new Set([
  'and', 'but', 'so', 'because', 'cause', 'when', 'while', 'if', 'then', 'or',
  'which', 'who', 'where', 'after', 'before', 'until', 'although', 'though',
  'unless', 'since', 'whether',
]);

/**
 * Splits a long line at the most natural point near its middle and repeats
 * until every part is ≤ [max] words (never a part under 3 words). Preference:
 *   1. after , ; : — or at a caption-cue boundary ([cueBreaks]: word indexes
 *      that start a new cue — manual captions break where the speaker pauses)
 *   2. before a conjunction (and, but, because, when…) or a capitalised word
 *      (a missing full stop: "…useless yeah | Tell me this…")
 *   3. the middle, avoiding a part that ends on "the / to / that…"
 * Word order is kept exactly, so the aligner still finds every word.
 */
export function splitLongLine(
  text: string,
  max = MAX_LINE_WORDS,
  cueBreaks: ReadonlySet<number> = new Set(),
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.length ? [words.join(' ')] : [];
  const n = words.length;
  const minPart = 3;
  let best = -1;
  let bestScore = Infinity;
  for (let i = minPart; i <= n - minPart; i++) {
    // split between words[i-1] and words[i]
    const prev = words[i - 1];
    const nextRaw = words[i];
    const next = nextRaw.toLowerCase().replace(/[^a-z']/g, '');
    const capital = /^[A-Z]/.test(nextRaw) && !/^I('|$)/.test(nextRaw);
    const kind =
      /[,;:—–]["”’)]*$|-$/.test(prev) || cueBreaks.has(i)
        ? 0
        : BREAK_BEFORE.has(next) || capital
          ? 1
          : 2;
    const weak = kind === 2 && WEAK_END.has(prev.toLowerCase().replace(/[^a-z']/g, '')) ? 3 : 0;
    // A natural break may sit well away from the middle.
    const score = kind * n + Math.abs(i - n / 2) * (kind === 2 ? 1 : 2) + weak;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  const shift = (set: ReadonlySet<number>, by: number) =>
    new Set([...set].map((x) => x - by).filter((x) => x > 0));
  const left = words.slice(0, best).join(' ');
  const right = words.slice(best).join(' ');
  return [
    ...splitLongLine(left, max, cueBreaks),
    ...splitLongLine(right, max, shift(cueBreaks, best)),
  ];
}

/**
 * [cueStarts]: global word indexes (over all lines joined) where a caption
 * cue starts — pass them for manual captions so splits follow the speaker.
 */
export function splitLongLines(
  lines: string[],
  max = MAX_LINE_WORDS,
  cueStarts: ReadonlySet<number> = new Set(),
): string[] {
  const out: string[] = [];
  let offset = 0;
  for (const line of lines) {
    const count = line.trim().split(/\s+/).filter(Boolean).length;
    const local = new Set(
      [...cueStarts].filter((g) => g > offset && g < offset + count).map((g) => g - offset),
    );
    out.push(...splitLongLine(line, max, local));
    offset += count;
  }
  return out;
}

/** Word indexes (over all segments joined with spaces) where each cue starts. */
export function cueStartIndexes(segments: Segment[]): Set<number> {
  const out = new Set<number>();
  let at = 0;
  for (const s of segments) {
    out.add(at);
    at += s.text.trim().split(/\s+/).filter(Boolean).length;
  }
  return out;
}

/** "English Singsing" intro card etc.: the line is only the channel name. */
export function isChannelNameLine(text: string, channel: string): boolean {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const c = norm(channel);
  if (!c) return false;
  const t = norm(text);
  return t === c || t === `${c} channel` || t === `welcome to ${c}`;
}
