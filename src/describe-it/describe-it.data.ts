import { publicHeroUrl } from '../articles/article-hero';
import poolsJson from './describe-it-pools.json';

export type DescribeItCard = {
  id: string;
  promptTh: string;
  answerEn: string;
  answerTh: string;
  acceptedAnswers: string[];
  imagePath: string;
  hintEn?: string;
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
  items: DescribeItCard[];
};

type Catalog = Record<string, DescribeItPool>;

export const DESCRIBE_IT_POOLS = poolsJson as Catalog;
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
  return Object.values(DESCRIBE_IT_POOLS)
    .filter((pool) => isValidDescribeItPack(pool))
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

export function dealDescribeItCards(poolId: string): DescribeItDealtCard[] {
  const pool = describeItPoolById(poolId);
  if (!pool || pool.items.length === 0) return [];
  return pool.items.map((item) => ({
    ...item,
    imageUrl: describeItImageUrl(item.imagePath),
  }));
}

