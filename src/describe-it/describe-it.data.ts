import { publicHeroUrl } from '../articles/article-hero';
import poolsJson from './describe-it-pools.json';
import a2PoolsJson from './adventure-a2-pools.json';

export type DescribeItCard = {
  id: string;
  promptTh: string;
  answerEn: string;
  answerTh: string;
  acceptedAnswers: string[];
  imagePath: string;
  hintEn?: string;
  /** Optional English question to TTS before the learner speaks (Look & Answer). */
  questionEn?: string;
  /** Two-level hints (highlight the info, then a sentence starter). */
  hints?: string[];
  /** Optional spoken-hint chips; tapping one plays it and never submits. */
  helperChoices?: string[];
  /** Skill bucket used to balance a capped deal (e.g. date / details / match). */
  skill?: string;
};

export type DescribeItDealtCard = DescribeItCard & {
  imageUrl: string;
};

export type DescribeItPool = {
  id: string;
  titleEn: string;
  titleTh: string;
  tagEn: string;
  emoji: string;
  estimatedMinutes: number;
  /** Cards per play when the pool holds more; dealt round-robin across skills. */
  dealCount?: number;
  items: DescribeItCard[];
};

type Catalog = Record<string, DescribeItPool>;

export const DESCRIBE_IT_POOLS: Catalog = {
  ...(poolsJson as Catalog),
  ...(a2PoolsJson as Catalog),
};
/**
 * Kill switch until the App Store build that ships Describe It is live.
 * When false, Foundation path treats all describe_it nodes as Coming Soon and
 * the public pool list is empty (Games hub has nothing to open).
 */
export const DESCRIBE_IT_ENABLED = true;
/** Minimum authored cards for a playable Foundation Describe It pack. */
export const DESCRIBE_IT_DEAL_COUNT = 5;
export const DESCRIBE_IT_BANANA_COST = 1;
export const DEFAULT_DESCRIBE_IT_BUCKET =
  'banana-english-ecf11.firebasestorage.app';

export function describeItStorageBucket(): string {
  return process.env.FIREBASE_STORAGE_BUCKET?.trim() || DEFAULT_DESCRIBE_IT_BUCKET;
}

export function describeItPoolById(poolId: string): DescribeItPool | undefined {
  return DESCRIBE_IT_POOLS[poolId];
}

export function isFoundationDescribeItPool(poolId: string): boolean {
  return Boolean(describeItPoolById(poolId));
}

export function isValidDescribeItPack(pool: DescribeItPool | undefined): boolean {
  return Boolean(pool && pool.items.length >= DESCRIBE_IT_DEAL_COUNT);
}

export function describeItImageUrl(imagePath: string, versionMs = 0): string {
  return publicHeroUrl(describeItStorageBucket(), imagePath, versionMs);
}

export function listDescribeItPools(): Array<{
  id: string;
  titleEn: string;
  titleTh: string;
  tagEn: string;
  emoji: string;
  estimatedMinutes: number;
  poolSize: number;
  locked: boolean;
  isNew: boolean;
  accentColor: number;
}> {
  if (!DESCRIBE_IT_ENABLED) return [];
  return Object.values(DESCRIBE_IT_POOLS)
    .filter((pool) => isValidDescribeItPack(pool) && !pool.id.startsWith('a2_'))
    .map((pool) => ({
      id: pool.id,
      titleEn: pool.titleEn,
      titleTh: pool.titleTh,
      tagEn: pool.tagEn,
      emoji: pool.emoji,
      estimatedMinutes: pool.estimatedMinutes,
      poolSize: pool.items.length,
      locked: false,
      isNew: true,
      accentColor: 0xfff06292,
    }));
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function balancedSkillDeal(
  items: DescribeItCard[],
  count: number,
  random: () => number,
): DescribeItCard[] {
  const buckets = new Map<string, DescribeItCard[]>();
  for (const item of items) {
    const key = item.skill ?? '';
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  const queues = shuffled([...buckets.values()], random).map((b) => shuffled(b, random));
  const picked: DescribeItCard[] = [];
  while (picked.length < count && queues.some((q) => q.length)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && picked.length < count) picked.push(next);
    }
  }
  return picked;
}

export function dealDescribeItCards(
  poolId: string,
  random: () => number = Math.random,
): DescribeItDealtCard[] {
  const pool = describeItPoolById(poolId);
  if (!pool || pool.items.length === 0) return [];
  const count = pool.dealCount ?? pool.items.length;
  const items =
    count < pool.items.length ? balancedSkillDeal(pool.items, count, random) : pool.items;
  return items.map((item) => ({
    ...item,
    imageUrl: describeItImageUrl(item.imagePath),
  }));
}

