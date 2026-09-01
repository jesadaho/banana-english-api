import poolsJson from './say-it-pools.generated.json';

export type SayItPhrase = {
  id: string;
  promptTh: string;
  answerEn: string;
  acceptedAnswers: string[];
};

export type SayItTopic = {
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

export const SAY_IT_DEAL_COUNT = 7;
export const SAY_IT_BANANA_COST = 1;

export const SAY_IT_TOPICS: SayItTopic[] = [
  {
    id: 'time_expressions',
    titleEn: 'Time Expressions',
    titleTh: 'Time Expressions',
    subtitleEn: 'Talk about time',
    subtitleTh: 'คำพูดเกี่ยวกับเวลา',
    emoji: '⏰',
    accentColor: 0xffffc107,
    estimatedMinutes: 3,
    poolSize: 20,
    locked: false,
    isNew: false,
    tagEn: 'TIME',
  },
  {
    id: 'where',
    titleEn: 'Where',
    titleTh: 'Where',
    subtitleEn: 'Ask and talk about places',
    subtitleTh: 'ถามและพูดเรื่องสถานที่',
    emoji: '📍',
    accentColor: 0xff42a5f5,
    estimatedMinutes: 3,
    poolSize: 20,
    locked: false,
    isNew: true,
    tagEn: 'WHERE',
  },
  {
    id: 'every_any',
    titleEn: 'Every & Any',
    titleTh: 'Every & Any',
    subtitleEn: 'Everyone, anything, anywhere…',
    subtitleTh: 'ทุกคน ทุกอย่าง ทุกที่…',
    emoji: '🌎',
    accentColor: 0xff26a69a,
    estimatedMinutes: 3,
    poolSize: 20,
    locked: false,
    isNew: true,
    tagEn: 'EVERY & ANY',
  },
  {
    id: 'reactions_expressions',
    titleEn: 'Reactions & Expressions',
    titleTh: 'Reactions & Expressions',
    subtitleEn: 'Real reactions in English',
    subtitleTh: 'ปฏิกิริยาและสำนวนพูดจริงๆ',
    emoji: '😱',
    accentColor: 0xffff7043,
    estimatedMinutes: 3,
    poolSize: 20,
    locked: false,
    isNew: true,
    tagEn: 'REACTIONS',
  },
  {
    id: 'thats',
    titleEn: "That's",
    titleTh: "That's",
    subtitleEn: 'Common “that’s…” phrases',
    subtitleTh: 'สำนวน That’s… ที่ใช้บ่อย',
    emoji: '✅',
    accentColor: 0xff5c6bc0,
    estimatedMinutes: 3,
    poolSize: 20,
    locked: false,
    isNew: true,
    tagEn: "THAT'S",
  },
];

const pools = poolsJson as Record<string, SayItPhrase[]>;

export function sayItTopicById(topicId: string): SayItTopic | undefined {
  return SAY_IT_TOPICS.find((t) => t.id === topicId);
}

export function sayItPoolForTopic(topicId: string): SayItPhrase[] {
  return pools[topicId] ?? [];
}

/** Fisher–Yates shuffle; returns up to [count] phrases from the topic pool. */
export function dealSayItPhrases(topicId: string, count = SAY_IT_DEAL_COUNT): SayItPhrase[] {
  const pool = [...sayItPoolForTopic(topicId)];
  if (pool.length === 0) return [];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const n = Math.min(count, pool.length);
  return pool.slice(0, n);
}
