import { describeItPoolById } from '../describe-it/describe-it.data';
import { emojiSpeakPoolById } from '../emoji-speak/emoji-speak.data';
import {
  FOUNDATION_V7_CAPABILITIES,
  LEARN_COURSES,
} from '../learn-path/foundation-v7-path.data';
import { toFoundationV7ClientChapters } from '../learn-path/foundation-v7-path.view';
import { buildFoundationV7Steps } from '../lessons/foundation-v7-lessons.data';
import { newWordsPoolById } from '../new-words/new-words.data';
import { sayItPoolForTopic } from '../say-it/say-it.data';
import { tapWords } from './tap-choices';

/**
 * Words each path node teaches, in path order — the source of Tap Mode
 * distractors ("words from nearby earlier chapters").
 */
type VocabNode = {
  courseIndex: number;
  chapterIndex: number;
  /** Order inside the chapter. */
  index: number;
  keys: string[];
  words: string[];
};

/** How a client asks: a lesson, a Say It topic, or a pool. */
export type TapContext = { lessonId?: string; topicId?: string; poolId?: string };

/** Chapters before the learner's one that may lend distractors. */
export const TAP_EARLIER_CHAPTERS = 2;

/**
 * Opening chapters (1–3): no distractors unless the answer is very short,
 * so the speaking word bank lists every word you need (and only those).
 * Chapter index is 0-based → early = chapterIndex < 3.
 */
export const TAP_EARLY_CHAPTERS = 3;

/** Answers with this many words or fewer still get distractors in early chapters. */
export const TAP_EARLY_SHORT_WORDS = 2;

let nodes: VocabNode[] | null = null;
let byKey: Map<string, VocabNode> | null = null;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function lessonSentences(lessonId: string): string[] {
  return safe(
    () =>
      buildFoundationV7Steps(lessonId).flatMap((step) => [
        ...(step.expectedSpeech ? [step.expectedSpeech] : []),
        ...(step.presentation?.options.map((o) => o.speak) ?? []),
      ]),
    [],
  );
}

function nodeSentences(type: string, ref: TapContext): string[] {
  switch (type) {
    case 'lesson':
      return ref.lessonId ? lessonSentences(ref.lessonId) : [];
    case 'say_it':
      return ref.topicId ? sayItPoolForTopic(ref.topicId).map((p) => p.answerEn) : [];
    case 'new_words':
      return ref.poolId ? (newWordsPoolById(ref.poolId)?.items ?? []).map((i) => i.answer) : [];
    case 'emoji_speak':
      return ref.poolId ? (emojiSpeakPoolById(ref.poolId)?.items ?? []).map((i) => i.answer) : [];
    case 'describe_it':
      return ref.poolId ? (describeItPoolById(ref.poolId)?.items ?? []).map((i) => i.answerEn) : [];
    default:
      return [];
  }
}

function build() {
  nodes = [];
  byKey = new Map();
  LEARN_COURSES.forEach((course, courseIndex) => {
    toFoundationV7ClientChapters(FOUNDATION_V7_CAPABILITIES, course).forEach((chapter, chapterIndex) => {
      chapter.items.forEach((item, index) => {
        const ref = item as TapContext & { nodeType?: string };
        const type = ref.nodeType ?? item.type;
        const words = [
          ...new Set(
            nodeSentences(type, ref)
              .flatMap((s) => tapWords(s))
              .map((w) => (/^I('|$)/.test(w) ? w : w.toLowerCase())),
          ),
        ];
        const keys = [
          ref.lessonId && `lesson:${ref.lessonId}`,
          ref.topicId && `topic:${ref.topicId}`,
          ref.poolId && `pool:${ref.poolId}`,
        ].filter((k): k is string => !!k);
        const node: VocabNode = { courseIndex, chapterIndex, index, keys, words };
        nodes!.push(node);
        for (const key of keys) if (!byKey!.has(key)) byKey!.set(key, node);
      });
    });
  });
}

function findNode(ctx: TapContext): VocabNode | undefined {
  if (!byKey) build();
  return (
    (ctx.lessonId && byKey!.get(`lesson:${ctx.lessonId}`)) ||
    (ctx.topicId && byKey!.get(`topic:${ctx.topicId}`)) ||
    (ctx.poolId && byKey!.get(`pool:${ctx.poolId}`)) ||
    undefined
  );
}

/**
 * Whether this item should mix in distractor chips.
 * Early chapters: only when the answer is very short (1–2 words).
 */
export function tapAllowDistractors(
  ctx: TapContext,
  answerWordCount: number,
): boolean {
  if (!byKey) build();
  const node = findNode(ctx);
  // Unknown content (hub topics etc.): keep distractors.
  if (!node) return true;
  if (node.chapterIndex < TAP_EARLY_CHAPTERS) {
    return answerWordCount <= TAP_EARLY_SHORT_WORDS;
  }
  return true;
}

/**
 * Distractor candidates for content at [ctx], best first:
 * 1. earlier nodes in the same chapter (nearest first),
 * 2. the 1–2 chapters before (nearest first),
 * 3. the node's own words (other items of the same set).
 * Never later nodes / chapters the learner has not reached.
 */
/** Fewer candidates than this → top up with the course's first chapters. */
const MIN_CANDIDATES = 6;

export function tapDistractorWords(ctx: TapContext): string[] {
  const node = findNode(ctx);
  if (!nodes) build();
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (words: string[]) => {
    for (const w of words) {
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
  };
  // Very first lessons (and content outside the path) have little or nothing
  // before them: the course's opening chapters are the safest words.
  const opening = (courseIndex: number) => {
    for (const n of nodes!) {
      if (n.courseIndex === courseIndex && n.chapterIndex <= 1) push(n.words);
    }
  };
  if (!node) {
    opening(ctx.lessonId?.startsWith('a2_') || ctx.topicId?.startsWith('a2_') ? 1 : 0);
    return out;
  }
  const sameCourse = nodes!.filter((n) => n.courseIndex === node.courseIndex);
  const earlierSameChapter = sameCourse
    .filter((n) => n.chapterIndex === node.chapterIndex && n.index < node.index)
    .sort((a, b) => b.index - a.index);
  for (const n of earlierSameChapter) push(n.words);
  for (let back = 1; back <= TAP_EARLIER_CHAPTERS; back++) {
    const chapter = sameCourse
      .filter((n) => n.chapterIndex === node.chapterIndex - back)
      .sort((a, b) => b.index - a.index);
    for (const n of chapter) push(n.words);
  }
  push(node.words);
  if (out.length < MIN_CANDIDATES) opening(node.courseIndex);
  return out;
}
