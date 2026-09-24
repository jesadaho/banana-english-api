import poolsJson from './explain-it-pools.json';

export type ExplainItItem = {
  id: string;
  targetEn: string;
  emoji: string;
  exampleDescriptionEn: string;
  sentenceStructure?: string;
};

export type ExplainItTopic = {
  id: string;
  titleEn: string;
  titleTh: string;
  subtitleEn: string;
  subtitleTh: string;
  emoji: string;
  accentColor: number;
  estimatedMinutes: number;
  poolSize: number;
  locked: boolean;
  isNew: boolean;
  tagEn?: string;
  tier: number;
  unlocked?: boolean;
  bananaCost?: number;
};

type PoolsFile = {
  topics: Array<Omit<ExplainItTopic, 'unlocked' | 'bananaCost'>>;
  pools: Record<string, ExplainItItem[]>;
};

const catalog = poolsJson as PoolsFile;

export const EXPLAIN_IT_DEAL_COUNT = 7;
export const EXPLAIN_IT_CHALLENGE_DEAL_COUNT = 10;
export const EXPLAIN_IT_BANANA_COST = 1;
export const EXPLAIN_IT_PASS_SCORE = 60;
export const EXPLAIN_IT_CHALLENGE_ID = 'challenge';

/** Internal competitive mode — excluded from public topic list. */
export const EXPLAIN_IT_CHALLENGE_TOPIC: ExplainItTopic = {
  id: EXPLAIN_IT_CHALLENGE_ID,
  titleEn: 'Challenge',
  titleTh: 'Challenge',
  subtitleEn: '10 mixed questions',
  subtitleTh: '10 คำถามผสม',
  emoji: '⚡',
  accentColor: 0xff5a2dae,
  estimatedMinutes: 5,
  poolSize: EXPLAIN_IT_CHALLENGE_DEAL_COUNT,
  locked: false,
  isNew: false,
  tagEn: 'CHALLENGE',
  tier: 0,
};

export const EXPLAIN_IT_TOPICS: ExplainItTopic[] = catalog.topics.map((t) => ({
  ...t,
  locked: t.locked ?? false,
  isNew: t.isNew ?? false,
  tier: t.tier ?? 1,
}));

const pools: Record<string, ExplainItItem[]> = { ...catalog.pools };

export function explainItUnlockReference(topicId: string): string {
  return `explain_it_unlock:${topicId}`;
}

export function isExplainItChallenge(topicId: string): boolean {
  return topicId.trim().toLowerCase() === EXPLAIN_IT_CHALLENGE_ID;
}

export function explainItTopicById(topicId: string): ExplainItTopic | undefined {
  const id = topicId.trim().toLowerCase();
  if (id === EXPLAIN_IT_CHALLENGE_ID) return EXPLAIN_IT_CHALLENGE_TOPIC;
  return EXPLAIN_IT_TOPICS.find((t) => t.id === id);
}

export function explainItPoolForTopic(topicId: string): ExplainItItem[] {
  return pools[topicId] ?? [];
}

export function topicsForTier(tier: number): ExplainItTopic[] {
  return EXPLAIN_IT_TOPICS.filter((t) => t.tier === tier);
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function dealExplainItItems(
  topicId: string,
  count = EXPLAIN_IT_DEAL_COUNT,
): ExplainItItem[] {
  if (isExplainItChallenge(topicId)) {
    return dealExplainItChallenge();
  }

  const pool = [...explainItPoolForTopic(topicId)];
  if (pool.length === 0) return [];

  shuffleInPlace(pool);
  const n = Math.min(count, pool.length);
  return pool.slice(0, n);
}

/** Challenge mix: 4 Tier1 + 3 Tier2 + 3 Tier3, then shuffle. */
export function dealExplainItChallenge(): ExplainItItem[] {
  const pick = (tier: number, n: number): ExplainItItem[] => {
    const pool: ExplainItItem[] = [];
    for (const topic of topicsForTier(tier)) {
      pool.push(...explainItPoolForTopic(topic.id));
    }
    shuffleInPlace(pool);
    return pool.slice(0, Math.min(n, pool.length));
  };

  const items = [...pick(1, 4), ...pick(2, 3), ...pick(3, 3)];
  shuffleInPlace(items);
  return items;
}

/** Hard rule: learner must not say the target word (or its parts). */
export function saidExplainItTargetWord(
  transcript: string,
  targetEn: string,
): boolean {
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  const target = targetEn
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (target.includes(' ') && normalized.includes(target)) {
    return true;
  }

  const words = target.split(' ').filter((w) => w.length > 0);
  for (const word of words) {
    const pattern = new RegExp(`\\b${word}s?\\b`, 'i');
    if (pattern.test(normalized)) return true;
  }
  return false;
}
