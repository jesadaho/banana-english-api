import poolsJson from './say-it-pools.generated.json';
import guidedPoolsJson from './say-it-guided-pools.json';
import v7PoolsJson from './foundation-v7-pools.json';
import { FOUNDATION_V7_NODES } from '../learn-path/foundation-v7-path.data';

export type SayItPhrase = {
  id: string;
  promptTh: string;
  subtitleTh?: string;
  answerEn: string;
  acceptedAnswers: string[];
  mode?: 'guided';
  hintEn?: string;
  choices?: string[];
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
export const FOUNDATION_SAY_IT_DEAL_COUNT = 5;
export const SAY_IT_BANANA_COST = 1;

/** Most Foundation packs deal 5; Question Clues mix keeps all six words. */
export function foundationSayItDealCount(topicId: string): number {
  return topicId === 'fnd_v7_u14n04' ? 6 : FOUNDATION_SAY_IT_DEAL_COUNT;
}

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
    poolSize: 5,
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
    poolSize: 5,
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
    poolSize: 5,
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
    poolSize: 5,
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
    poolSize: 5,
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
    poolSize: 5,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v6_switch_meaning',
    titleEn: 'Switch the Meaning',
    titleTh: 'เปลี่ยนความหมาย',
    subtitleEn: 'Use be, not, and questions',
    subtitleTh: 'ฝึกบอกเล่า ปฏิเสธ และคำถาม',
    emoji: '🔄',
    accentColor: 0xffec407a,
    estimatedMinutes: 2,
    poolSize: 5,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v6_my_your_things',
    titleEn: 'My Things & Your Things',
    titleTh: 'ของฉันและของคุณ',
    subtitleEn: 'Say who owns each thing',
    subtitleTh: 'พูดว่าแต่ละอย่างเป็นของใคร',
    emoji: '🎒',
    accentColor: 0xffab47bc,
    estimatedMinutes: 2,
    poolSize: 5,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v6_number_spelling',
    titleEn: 'Number & Spelling Mix',
    titleTh: 'ตัวเลขและการสะกด',
    subtitleEn: 'Say ages, numbers, and spelling',
    subtitleTh: 'พูดอายุ ตัวเลข และการสะกด',
    emoji: '🔢',
    accentColor: 0xffffa726,
    estimatedMinutes: 2,
    poolSize: 5,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
  {
    id: 'fnd_v6_time_price',
    titleEn: 'Time and Price',
    titleTh: 'เวลาและราคา',
    subtitleEn: 'Say simple times and prices',
    subtitleTh: 'พูดเวลาและราคาง่าย ๆ',
    emoji: '⏰',
    accentColor: 0xff29b6f6,
    estimatedMinutes: 2,
    poolSize: 5,
    locked: false,
    isNew: true,
    tagEn: 'FOUNDATION',
  },
];

/** Path-embedded Say It topics (no banana charge on start). */
export function isFoundationPathSayItTopic(topicId: string): boolean {
  return topicId.startsWith('fnd_v2_') || topicId.startsWith('fnd_v6_') ||
    FOUNDATION_V7_NODES.some(node => node.type === 'say_it' && node.contentRef.topicId === topicId);
}

const pools = {
  ...(v7PoolsJson as Record<string, SayItPhrase[]>),
  ...(poolsJson as Record<string, SayItPhrase[]>),
  ...(guidedPoolsJson as Record<string, SayItPhrase[]>),
};

const guidedTopicTitles: Record<string, string> = {
  fnd_v6_build_be_sentences: 'Build Be Sentences',
  fnd_v6_make_noun_fit: 'Make the Noun Fit',
  fnd_v6_small_blue_bag: 'A Small Blue Bag',
  fnd_v6_owner_thing: 'Owner + Thing',
  fnd_v6_three_lines: 'Three Lines About Me',
  fnd_v6_change_i_to_she: 'Change I to She',
  fnd_v6_now_or_every_day: 'Now or Every Day?',
  fnd_v6_match_question_answer: 'Match Question to Answer',
  fnd_v6_place_correctly: 'Place It Correctly',
};

export function sayItTopicById(topicId: string): SayItTopic | undefined {
  const topic = SAY_IT_TOPICS.find((candidate) => candidate.id === topicId);
  if (topic) return topic;
  const v7 = FOUNDATION_V7_NODES.find(node => node.type === 'say_it' && node.contentRef.topicId === topicId);
  if (v7 && Object.prototype.hasOwnProperty.call(v7PoolsJson, topicId)) {
    return {
      id: topicId, titleEn: v7.titleEn, titleTh: v7.titleTh,
      subtitleEn: 'Practise the words and sentences from Foundation', subtitleTh: v7.learningTarget,
      emoji: '🗣️', accentColor: 0xffffc107, estimatedMinutes: 2,
      poolSize: pools[topicId].length, locked: false, isNew: true,
      tagEn: v7.sayItMode === 'guided' ? 'GUIDED' : 'FOUNDATION',
    };
  }
  const title = guidedTopicTitles[topicId];
  if (!title) return undefined;
  return {
    id: topicId,
    titleEn: title,
    titleTh: title,
    subtitleEn: 'Choose a hint, then say the full sentence',
    subtitleTh: 'เลือกคำใบ้ แล้วพูดประโยคเต็ม',
    emoji: '🧩',
    accentColor: 0xff42a5f5,
    estimatedMinutes: 2,
    poolSize: pools[topicId]?.length ?? 0,
    locked: false,
    isNew: true,
    tagEn: 'GUIDED',
  };
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

  // V7 Guided packs deliberately fade support: three guided turns followed
  // by two independent turns. Preserve that authored order, not random order.
  const orderedGuided = FOUNDATION_V7_NODES.some(node => node.contentRef.topicId === topicId && node.sayItMode === 'guided');
  for (let i = orderedGuided ? 0 : pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const n = Math.min(count, pool.length);
  return pool.slice(0, n).map((phrase) => personalizeSayItPhrase(phrase, displayName));
}
