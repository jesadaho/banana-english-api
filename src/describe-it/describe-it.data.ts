import { publicHeroUrl } from '../articles/article-hero';
import poolsJson from './describe-it-pools.json';

export type DescribeItCard = {
  id: string;
  promptTh: string;
  answerEn: string;
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
export const DESCRIBE_IT_DEAL_COUNT = 5;
export const DESCRIBE_IT_BANANA_COST = 0;
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
  return Boolean(pool && pool.items.length === DESCRIBE_IT_DEAL_COUNT);
}

export function describeItImageUrl(imagePath: string, versionMs = 0): string {
  return publicHeroUrl(describeItStorageBucket(), imagePath, versionMs);
}

export function dealDescribeItCards(poolId: string): DescribeItDealtCard[] {
  const pool = describeItPoolById(poolId);
  if (!pool || pool.items.length === 0) return [];
  return pool.items.map((item) => ({
    ...item,
    imageUrl: describeItImageUrl(item.imagePath),
  }));
}
