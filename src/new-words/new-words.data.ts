import poolsJson from './new-words-pools.json';
import a2PoolsJson from './adventure-a2-pools.json';

export const NEW_WORDS_MIN_PACK_SIZE = 2;
export const NEW_WORDS_MAX_PACK_SIZE = 4;
/** List-view packs show a whole closed set (always … never, dawn … midnight) on one screen. */
export const NEW_WORDS_LIST_MAX_PACK_SIZE = 7;

export type NewWordsCard = {
  emoji: string;
  answer: string;
  reading: string;
  meaningTh: string;
  /** US/UK spellings or alternate forms graded as correct. */
  acceptedAnswers?: string[];
  /** List view: filled bars out of 5 (e.g. how often a frequency word means). */
  level?: number;
  /** List view: short label in place of the bars (e.g. `05:00–06:00`). */
  detail?: string;
  /** List view: how the word is used (e.g. `at dawn`). */
  usage?: string;
};

export type NewWordsPool = {
  title: string;
  items: NewWordsCard[];
  /** `list` shows every word as a row and repeats them one by one. */
  layout?: 'list';
  /** Footnote under the list (e.g. what the bars mean). */
  note?: string;
  /** List view: sentence with `___` filled by the highlighted word (e.g. `I ___ have breakfast.`). */
  example?: string;
  /** List view: draw `level` as stars (ratings) instead of bars. */
  levelStyle?: 'stars';
};

const catalog = {
  ...(poolsJson as Record<string, NewWordsPool>),
  ...(a2PoolsJson as Record<string, NewWordsPool>),
};

export const NEW_WORDS_POOLS = catalog;

export function isNewWordsPoolId(poolId: string): boolean {
  return poolId in NEW_WORDS_POOLS;
}

export function newWordsPoolById(poolId: string): NewWordsPool | undefined {
  return NEW_WORDS_POOLS[poolId];
}

export function isValidNewWordsPack(pool: NewWordsPool | undefined): boolean {
  const n = pool?.items.length ?? 0;
  const max = pool?.layout === 'list' ? NEW_WORDS_LIST_MAX_PACK_SIZE : NEW_WORDS_MAX_PACK_SIZE;
  return n >= NEW_WORDS_MIN_PACK_SIZE && n <= max;
}
