import poolsJson from './say-it-pools.generated.json';

export type SayItPhrase = {
  id: string;
  promptTh: string;
  subtitleTh?: string;
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
    emoji: '👉',
    accentColor: 0xff5c6bc0,
    estimatedMinutes: 3,
    poolSize: 20,
    locked: false,
    isNew: true,
    tagEn: "THAT'S",
  },
  {
    id: 'fnd_v2_first_conversation',
    titleEn: 'First Conversation',
    titleTh: 'เปิดบทสนทนา',
    subtitleEn: 'Greet + introduce yourself',
    subtitleTh: 'ทักทายและแนะนำตัว',
    emoji: '👋',
    accentColor: 0xffffc107,
    estimatedMinutes: 3,
    poolSize: 5,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v2_be_polite',
    titleEn: 'Be Polite',
    titleTh: 'ฝึกคำสุภาพ',
    subtitleEn: 'Polite phrases TH→EN',
    subtitleTh: 'คำสุภาพ ไทย→อังกฤษ',
    emoji: '🙏',
    accentColor: 0xffec407a,
    estimatedMinutes: 3,
    poolSize: 5,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v2_survival',
    titleEn: 'Survival English',
    titleTh: 'ภาษาเอาตัวรอด',
    subtitleEn: 'Ask when you don’t understand',
    subtitleTh: 'ถามเมื่อไม่เข้าใจ',
    emoji: '🛟',
    accentColor: 0xff29b6f6,
    estimatedMinutes: 3,
    poolSize: 14,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v2_daily_time',
    titleEn: 'Time Practice',
    titleTh: 'ฝึกบอกเวลา',
    subtitleEn: 'Practice telling the time',
    subtitleTh: 'ทบทวนการบอกเวลา',
    emoji: '🕐',
    accentColor: 0xffffa726,
    estimatedMinutes: 3,
    poolSize: 14,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v2_people_family',
    titleEn: 'People, Feelings & Family',
    titleTh: 'คน ความรู้สึก และครอบครัว',
    subtitleEn: 'Talk about people, feelings, and family',
    subtitleTh: 'พูดเรื่องคน ความรู้สึก และครอบครัว',
    emoji: '👥',
    accentColor: 0xff66bb6a,
    estimatedMinutes: 3,
    poolSize: 14,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v2_numbers_shopping',
    titleEn: 'Numbers & Shopping',
    titleTh: 'ตัวเลขและการซื้อของ',
    subtitleEn: 'Prices and shopping phrases',
    subtitleTh: 'ราคาและคำซื้อของ',
    emoji: '🛒',
    accentColor: 0xffab47bc,
    estimatedMinutes: 3,
    poolSize: 13,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v2_about_me',
    titleEn: 'About Me',
    titleTh: 'เกี่ยวกับฉัน',
    subtitleEn: 'Likes, wants, and abilities',
    subtitleTh: 'ชอบ ต้องการ และความสามารถ',
    emoji: '💬',
    accentColor: 0xff26a69a,
    estimatedMinutes: 3,
    poolSize: 14,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v2_ask_me',
    titleEn: 'Ask & Close',
    titleTh: 'ถามและกล่าวลา',
    subtitleEn: 'Ask and close a conversation',
    subtitleTh: 'ถามสถานที่ ถามข้อมูล และกล่าวลา',
    emoji: '❓',
    accentColor: 0xff5c6bc0,
    estimatedMinutes: 3,
    poolSize: 14,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
];

/** Path-embedded Say It topics (no banana charge on start). */
export function isFoundationPathSayItTopic(topicId: string): boolean {
  return topicId.startsWith('fnd_v2_');
}

const pools = poolsJson as Record<string, SayItPhrase[]>;

export function sayItTopicById(topicId: string): SayItTopic | undefined {
  return SAY_IT_TOPICS.find((t) => t.id === topicId);
}

export function sayItPoolForTopic(topicId: string): SayItPhrase[] {
  return pools[topicId] ?? [];
}

export function personalizeSayItPhrase(
  phrase: SayItPhrase,
  displayName?: string | null,
): SayItPhrase {
  if (!phrase.promptTh.includes('{name}')) return phrase;

  const name = displayName?.trim() || 'Nana';
  const replaceName = (value: string) => value.replaceAll('{name}', name);
  return {
    ...phrase,
    promptTh: replaceName(phrase.promptTh),
    answerEn: replaceName(phrase.answerEn),
    acceptedAnswers: phrase.acceptedAnswers.map(replaceName),
  };
}

/** Fisher–Yates shuffle; returns up to [count] phrases from the topic pool. */
export function dealSayItPhrases(
  topicId: string,
  count = SAY_IT_DEAL_COUNT,
  displayName?: string | null,
): SayItPhrase[] {
  const pool = [...sayItPoolForTopic(topicId)];
  if (pool.length === 0) return [];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const n = Math.min(count, pool.length);
  return pool.slice(0, n).map((phrase) => personalizeSayItPhrase(phrase, displayName));
}
