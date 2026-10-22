import poolsJson from './in-on-at-pools.json';

export type InOnAtAnswer = 'in' | 'on' | 'at';
export type InOnAtTopicId = 'time' | 'place' | 'mix';

export type InOnAtItem = {
  id: string;
  /** `time` | `place` — the source pool. */
  topic: 'time' | 'place';
  /** Card prompt, e.g. `___ July.` (time) or `The book is ___ the table.` (place). */
  prompt: string;
  /** The word that follows the preposition, e.g. `July`, `the table`. */
  word: string;
  answer: InOnAtAnswer;
  /** 1 easy · 2 medium · 3 hard. */
  level: number;
  /** Tricky item (Friday night, on the bus, at night…). */
  trap: boolean;
  category: string;
  /** One-line Thai reason shown after answering. */
  reasonTh: string;
  /** Full example sentence (same as prompt for place items). */
  sentence: string;
};

export type InOnAtTopic = {
  id: InOnAtTopicId;
  titleEn: string;
  titleTh: string;
  examplesEn: string;
  /** Topics that must be played first (client shows the card locked). */
  requires: InOnAtTopicId[];
  isNew: boolean;
  poolSize: number;
};

export const IN_ON_AT_BANANA_COST = 1;
export const IN_ON_AT_DEAL_COUNT = 12;
const MIN_TRAPS = 2;
const ANSWERS: InOnAtAnswer[] = ['in', 'on', 'at'];

export const IN_ON_AT_ITEMS: InOnAtItem[] = (
  poolsJson as { items: InOnAtItem[] }
).items;

export function inOnAtPoolFor(topicId: string): InOnAtItem[] {
  if (topicId === 'mix') return IN_ON_AT_ITEMS;
  return IN_ON_AT_ITEMS.filter((item) => item.topic === topicId);
}

export const IN_ON_AT_TOPICS: InOnAtTopic[] = [
  {
    id: 'time',
    titleEn: 'Time',
    titleTh: 'เวลา',
    examplesEn: 'in July · on Monday · at 7 a.m.',
    requires: [],
    isNew: false,
    poolSize: inOnAtPoolFor('time').length,
  },
  {
    id: 'place',
    titleEn: 'Place',
    titleTh: 'สถานที่',
    examplesEn: 'in Bangkok · on the table · at home',
    requires: [],
    isNew: true,
    poolSize: inOnAtPoolFor('place').length,
  },
  {
    id: 'mix',
    titleEn: 'Mix',
    titleTh: 'รวม',
    examplesEn: 'เวลา + สถานที่ ปนกัน',
    requires: ['time', 'place'],
    isNew: false,
    poolSize: IN_ON_AT_ITEMS.length,
  },
];

export function inOnAtTopicById(id: string): InOnAtTopic | undefined {
  return IN_ON_AT_TOPICS.find((t) => t.id === id);
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * One round: an equal number of in / on / at (4 each for 12), at least
 * [MIN_TRAPS] trap items, then shuffled. Mix splits each answer between the
 * time and place pools.
 */
export function dealInOnAt(
  topicId: string,
  count = IN_ON_AT_DEAL_COUNT,
  random: () => number = Math.random,
): InOnAtItem[] {
  const pool = inOnAtPoolFor(topicId);
  if (pool.length === 0) return [];
  const perAnswer = Math.max(1, Math.floor(count / ANSWERS.length));

  const picked: InOnAtItem[] = [];
  for (const answer of ANSWERS) {
    const sources =
      topicId === 'mix'
        ? (['time', 'place'] as const).map((t) =>
            shuffle(
              pool.filter((i) => i.answer === answer && i.topic === t),
              random,
            ),
          )
        : [shuffle(pool.filter((i) => i.answer === answer), random)];
    let k = 0;
    while (picked.filter((p) => p.answer === answer).length < perAnswer) {
      const source = sources[k % sources.length];
      const next = source.shift();
      if (next) picked.push(next);
      if (sources.every((s) => s.length === 0)) break;
      k++;
    }
  }

  // Guarantee a few tricky items: swap non-trap picks for unused traps of
  // the same answer so the in/on/at balance stays intact.
  let traps = picked.filter((p) => p.trap).length;
  if (traps < MIN_TRAPS) {
    const used = new Set(picked.map((p) => p.id));
    const spare = shuffle(
      pool.filter((i) => i.trap && !used.has(i.id)),
      random,
    );
    for (const trap of spare) {
      if (traps >= MIN_TRAPS) break;
      const idx = picked.findIndex((p) => !p.trap && p.answer === trap.answer);
      if (idx < 0) continue;
      picked[idx] = trap;
      traps++;
    }
  }

  return shuffle(picked, random);
}
