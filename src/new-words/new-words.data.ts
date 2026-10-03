import poolsJson from './new-words-pools.json';
import a2PoolsJson from './adventure-a2-pools.json';

export const NEW_WORDS_MIN_PACK_SIZE = 2;
export const NEW_WORDS_MAX_PACK_SIZE = 4;

export type NewWordsCard = {
  emoji: string;
  answer: string;
  reading: string;
  meaningTh: string;
  /** US/UK spellings or alternate forms graded as correct. */
  acceptedAnswers?: string[];
};

export type NewWordsPool = {
  title: string;
  items: NewWordsCard[];
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
  return n >= NEW_WORDS_MIN_PACK_SIZE && n <= NEW_WORDS_MAX_PACK_SIZE;
}
