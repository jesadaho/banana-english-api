/** Praise clips played before a Foundation lesson line, from Chapter 2 on. */
export const ENGLISH_PRAISES = ['Good!', 'Great!', 'Excellent!'] as const;

export type EnglishPraise = (typeof ENGLISH_PRAISES)[number];

/** Stable pick so the same turn hears the same word, and the three words all appear. */
export function englishPraiseFor(seed: string): EnglishPraise {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return ENGLISH_PRAISES[hash % ENGLISH_PRAISES.length];
}
