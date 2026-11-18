/**
 * Tap Mode ("ไม่สะดวกพูด"): the learner builds the answer from word chips
 * instead of speaking. Pure helpers: chip words for an answer, plus a few
 * distractor words the learner has already met on the path.
 *
 * Rules (agreed 2026-11):
 * - Chips = the answer's words + 2–3 distractors, about 8 chips at most.
 * - Distractors come from earlier nodes (same chapter first, then the
 *   1–2 chapters before), never from chapters the learner has not reached.
 * - A word that would make another accepted answer is never a distractor.
 * - No duplicate chips (case-insensitive); same item → same chips (seeded).
 */

/** Words of a sentence as chips: punctuation dropped, `I` / names kept. */
export function tapWords(sentence: string): string[] {
  const raw = sentence
    .replace(/[“”"]/g, ' ')
    .replace(/’/g, "'")
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '').replace(/^'+|'+$/g, ''))
    .filter(Boolean);
  // Sentence-start capital would give away the first chip.
  return raw.map((w, i) => (i === 0 && !isAlwaysCapital(w) ? lowerFirst(w) : w));
}

function lowerFirst(word: string): string {
  // Keep acronyms / names written in caps after the first letter (TV, OK).
  if (/^[A-Z]{2,}$/.test(word)) return word;
  return word.charAt(0).toLowerCase() + word.slice(1);
}

function isAlwaysCapital(word: string): boolean {
  return /^I('|$)/.test(word) || /^[A-Z]{2,}$/.test(word);
}

/** Compare built and expected answers on letters/digits only. */
export function tapKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function seededRandom(seedText: string): () => number {
  let h = 2166136261;
  for (const ch of seedText) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export const TAP_MAX_CHIPS = 8;

export type TapChoiceInput = {
  /** The main answer (built from chips). */
  answer: string;
  /** Other answers that also count (never split into distractors). */
  accepted?: string[];
  /** Choice steps: every option's sentence goes in as chips too. */
  options?: string[];
  /** Candidate distractor words, best first (nearest earlier content). */
  distractorWords: string[];
  seed: string;
};

/** Chips for one item, shuffled (stable for the same seed). */
export function buildTapChoices(input: TapChoiceInput): string[] {
  // A word used twice in one answer ("me … me") needs two chips: keep the
  // highest count any one sentence needs.
  const need = new Map<string, { word: string; count: number }>();
  for (const sentence of [input.answer, ...(input.options ?? [])]) {
    const counts = new Map<string, { word: string; count: number }>();
    for (const w of tapWords(sentence)) {
      const key = w.toLowerCase();
      const c = counts.get(key) ?? { word: w, count: 0 };
      c.count += 1;
      counts.set(key, c);
    }
    for (const [key, c] of counts) {
      const prev = need.get(key);
      if (!prev || prev.count < c.count) need.set(key, prev ? { ...prev, count: c.count } : c);
    }
  }
  const chips: string[] = [];
  const seen = new Set<string>();
  for (const [key, { word, count }] of need) {
    seen.add(key);
    for (let i = 0; i < count; i++) chips.push(word);
  }
  const add = (word: string) => {
    const key = word.toLowerCase();
    if (!word || seen.has(key)) return false;
    seen.add(key);
    chips.push(word);
    return true;
  };
  // Words of other accepted answers are not wrong — keep them out entirely.
  const blocked = new Set(
    [input.answer, ...(input.accepted ?? []), ...(input.options ?? [])]
      .flatMap((s) => tapWords(s))
      .map((w) => w.toLowerCase()),
  );
  const own = chips.length;
  const want = Math.max(2, Math.min(3, TAP_MAX_CHIPS - own));
  const rand = seededRandom(input.seed);
  // Nearest words first, with a little shuffle inside the first dozen so the
  // same lesson does not always get the same three.
  const pool = input.distractorWords.filter(
    (w) => /^[A-Za-z][A-Za-z']*$/.test(w) && !blocked.has(w.toLowerCase()),
  );
  const head = pool.slice(0, 12);
  for (let i = head.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [head[i], head[j]] = [head[j], head[i]];
  }
  let added = 0;
  for (const w of [...head, ...pool.slice(12)]) {
    if (added >= want) break;
    if (add(isAlwaysCapital(w) ? w : w.toLowerCase())) added++;
  }
  for (let i = chips.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [chips[i], chips[j]] = [chips[j], chips[i]];
  }
  return chips;
}
