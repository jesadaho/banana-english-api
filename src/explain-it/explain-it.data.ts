export type ExplainItItem = {
  id: string;
  targetEn: string;
  emoji: string;
  exampleDescriptionEn: string;
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
};

export const EXPLAIN_IT_DEAL_COUNT = 7;
export const EXPLAIN_IT_BANANA_COST = 1;
export const EXPLAIN_IT_PASS_SCORE = 60;

export const EXPLAIN_IT_TOPICS: ExplainItTopic[] = [
  {
    id: 'demo',
    titleEn: 'Demo',
    titleTh: 'Demo',
    subtitleEn: 'Explain everyday objects',
    subtitleTh: 'อธิบายสิ่งของในชีวิตประจำวัน',
    emoji: '🎲',
    accentColor: 0x26a69a,
    estimatedMinutes: 4,
    poolSize: 20,
    locked: false,
    isNew: true,
    tagEn: 'DEMO',
  },
];

const DEMO_POOL: ExplainItItem[] = [
  {
    id: 'tv',
    targetEn: 'TV',
    emoji: '📺',
    exampleDescriptionEn: 'You use it to watch shows and movies.',
  },
  {
    id: 'phone',
    targetEn: 'Phone',
    emoji: '📱',
    exampleDescriptionEn: 'You use it to call people and send messages.',
  },
  {
    id: 'computer',
    targetEn: 'Computer',
    emoji: '💻',
    exampleDescriptionEn: 'You use it to work, browse the internet, or play games.',
  },
  {
    id: 'camera',
    targetEn: 'Camera',
    emoji: '📷',
    exampleDescriptionEn: 'You use it to take pictures.',
  },
  {
    id: 'book',
    targetEn: 'Book',
    emoji: '📖',
    exampleDescriptionEn: 'You read it to learn something or enjoy a story.',
  },
  {
    id: 'chair',
    targetEn: 'Chair',
    emoji: '🪑',
    exampleDescriptionEn: 'You sit on it.',
  },
  {
    id: 'bed',
    targetEn: 'Bed',
    emoji: '🛏️',
    exampleDescriptionEn: 'You sleep on it at night.',
  },
  {
    id: 'key',
    targetEn: 'Key',
    emoji: '🔑',
    exampleDescriptionEn: 'You use it to open a door or lock.',
  },
  {
    id: 'clock',
    targetEn: 'Clock',
    emoji: '⏰',
    exampleDescriptionEn: 'It shows you the time.',
  },
  {
    id: 'umbrella',
    targetEn: 'Umbrella',
    emoji: '☂️',
    exampleDescriptionEn: 'You use it when it rains.',
  },
  {
    id: 'bicycle',
    targetEn: 'Bicycle',
    emoji: '🚲',
    exampleDescriptionEn: 'It has two wheels and you ride it.',
  },
  {
    id: 'spoon',
    targetEn: 'Spoon',
    emoji: '🥄',
    exampleDescriptionEn: 'You use it to eat soup.',
  },
  {
    id: 'toothbrush',
    targetEn: 'Toothbrush',
    emoji: '🪥',
    exampleDescriptionEn: 'You use it to clean your teeth.',
  },
  {
    id: 'refrigerator',
    targetEn: 'Refrigerator',
    emoji: '🧊',
    exampleDescriptionEn: 'It keeps your food cold.',
  },
  {
    id: 'backpack',
    targetEn: 'Backpack',
    emoji: '🎒',
    exampleDescriptionEn: 'You carry things in it on your back.',
  },
  {
    id: 'shoes',
    targetEn: 'Shoes',
    emoji: '👟',
    exampleDescriptionEn: 'You wear them on your feet when you go outside.',
  },
  {
    id: 'sunglasses',
    targetEn: 'Sunglasses',
    emoji: '🕶️',
    exampleDescriptionEn: 'You wear them to protect your eyes from the sun.',
  },
  {
    id: 'mirror',
    targetEn: 'Mirror',
    emoji: '🪞',
    exampleDescriptionEn: 'You look at it to see yourself.',
  },
  {
    id: 'pillow',
    targetEn: 'Pillow',
    emoji: '🛏️',
    exampleDescriptionEn: 'You put your head on it when you sleep.',
  },
  {
    id: 'banana',
    targetEn: 'Banana',
    emoji: '🍌',
    exampleDescriptionEn: 'It is a long yellow fruit that monkeys like to eat.',
  },
];

const pools: Record<string, ExplainItItem[]> = {
  demo: DEMO_POOL,
};

export function explainItTopicById(topicId: string): ExplainItTopic | undefined {
  return EXPLAIN_IT_TOPICS.find((t) => t.id === topicId);
}

export function explainItPoolForTopic(topicId: string): ExplainItItem[] {
  return pools[topicId] ?? [];
}

export function dealExplainItItems(
  topicId: string,
  count = EXPLAIN_IT_DEAL_COUNT,
): ExplainItItem[] {
  const pool = [...explainItPoolForTopic(topicId)];
  if (pool.length === 0) return [];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const n = Math.min(count, pool.length);
  return pool.slice(0, n);
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
