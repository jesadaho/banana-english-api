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

const NOISE = /\[[^\]]*\]|\([^)]*(music|applause|laugh|sigh|gasp)[^)]*\)|♪+|>>/gi;

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
    const text = raw.replace(NOISE, ' ').replace(/^\s*-\s*/, '').replace(/\s+/g, ' ').trim();
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
