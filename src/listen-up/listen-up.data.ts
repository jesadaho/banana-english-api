import poolsJson from './listen-up-pools.json';

/** Audio-first item: learner hears `audioText` (device TTS) and speaks the key info. */
export type ListenUpItem = {
  id: string;
  audioText: string;
  /** Who is talking (e.g. `May`, `Teacher Bee`); absent for announcements. */
  speaker?: string;
  questionTh: string;
  answerEn: string;
  acceptedAnswers: string[];
  hints: string[];
};

export type ListenUpPool = {
  id: string;
  titleEn: string;
  titleTh: string;
  items: ListenUpItem[];
};

/** Temporarily off: Listen Up nodes show as coming soon on every path. */
export const LISTEN_UP_ENABLED = false;
export const LISTEN_UP_MIN_ITEMS = 3;
export const LISTEN_UP_DEAL_COUNT = 5;

const catalog = poolsJson as Record<string, ListenUpPool>;

export const LISTEN_UP_POOLS = catalog;

export function listenUpPoolById(poolId: string): ListenUpPool | undefined {
  return LISTEN_UP_POOLS[poolId];
}

export function isValidListenUpPack(pool: ListenUpPool | undefined): boolean {
  return Boolean(
    pool &&
      pool.items.length >= LISTEN_UP_MIN_ITEMS &&
      pool.items.every((item) => item.audioText.trim() && item.answerEn.trim()),
  );
}

export function dealListenUpItems(
  poolId: string,
  count = LISTEN_UP_DEAL_COUNT,
  random: () => number = Math.random,
): ListenUpItem[] {
  const pool = listenUpPoolById(poolId);
  if (!pool) return [];
  const shuffled = [...pool.items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
