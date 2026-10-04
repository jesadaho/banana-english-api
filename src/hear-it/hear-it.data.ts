import poolsJson from './hear-it-pools.json';

/** Audio-first item: learner hears `audioText` (device TTS) and speaks the key info. */
export type HearItItem = {
  id: string;
  audioText: string;
  questionTh: string;
  answerEn: string;
  acceptedAnswers: string[];
  hints: string[];
};

export type HearItPool = {
  id: string;
  titleEn: string;
  titleTh: string;
  items: HearItItem[];
};

/** Temporarily off: Hear It nodes show as coming soon on every path. */
export const HEAR_IT_ENABLED = false;
export const HEAR_IT_MIN_ITEMS = 3;
export const HEAR_IT_DEAL_COUNT = 5;

const catalog = poolsJson as Record<string, HearItPool>;

export const HEAR_IT_POOLS = catalog;

export function hearItPoolById(poolId: string): HearItPool | undefined {
  return HEAR_IT_POOLS[poolId];
}

export function isValidHearItPack(pool: HearItPool | undefined): boolean {
  return Boolean(
    pool &&
      pool.items.length >= HEAR_IT_MIN_ITEMS &&
      pool.items.every((item) => item.audioText.trim() && item.answerEn.trim()),
  );
}

export function dealHearItItems(
  poolId: string,
  count = HEAR_IT_DEAL_COUNT,
  random: () => number = Math.random,
): HearItItem[] {
  const pool = hearItPoolById(poolId);
  if (!pool) return [];
  const shuffled = [...pool.items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
