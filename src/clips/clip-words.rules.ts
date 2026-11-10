/**
 * Tap-a-word in a clip line: which word was tapped, and IPA from the free
 * dictionaryapi.dev response.
 */

/** Same split as the app (whitespace); core = letters/digits/apostrophes. */
export function wordAt(text: string, wordIdx: number): { word: string; core: string } | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!Number.isInteger(wordIdx) || wordIdx < 0 || wordIdx >= words.length) return null;
  const word = words[wordIdx];
  const core = word.toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  if (!/[a-z]/.test(core)) return null;
  return { word, core };
}

/** First IPA in a dictionaryapi.dev entries response ("/ɡræb/"), else ''. */
export function pickIpa(json: unknown): string {
  if (!Array.isArray(json)) return '';
  for (const entry of json) {
    const e = entry as { phonetic?: unknown; phonetics?: Array<{ text?: unknown }> };
    if (typeof e.phonetic === 'string' && e.phonetic.trim()) return e.phonetic.trim();
    for (const ph of e.phonetics ?? []) {
      if (typeof ph?.text === 'string' && ph.text.trim()) return ph.text.trim();
    }
  }
  return '';
}

export type WordGloss = {
  lemma: string;
  pos: string;
  th: string;
  note: string;
  example: string;
  exampleTh: string;
};

/** Trim / bound what the model returns; th is required. */
export function cleanGloss(raw: Partial<Record<keyof WordGloss, unknown>>): WordGloss | null {
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const th = str(raw.th, 120);
  if (!th) return null;
  return {
    lemma: str(raw.lemma, 40).toLowerCase(),
    pos: str(raw.pos, 20).toLowerCase(),
    th,
    note: str(raw.note, 160),
    example: str(raw.example, 140),
    exampleTh: str(raw.exampleTh, 140),
  };
}
