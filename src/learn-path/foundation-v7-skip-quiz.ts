import { FOUNDATION_V7_CATALOG, FOUNDATION_V7_PATH_ID } from './foundation-v7-path.data';
import { toFoundationV7ClientChapters } from './foundation-v7-path.view';
import {
  personalizeSayItPhrase,
  sayItPoolForTopic,
  type SayItPhrase,
} from '../say-it/say-it.data';

export const SKIP_QUIZ_MIN_DEAL = 5;
export const SKIP_QUIZ_PREFERRED_DEAL = 7;
export const SKIP_QUIZ_MAX_DEAL = 10;
export const SKIP_QUIZ_BANANA_COST = 1;
export const SKIP_QUIZ_PASS_RATIO = 0.75;

export type SkipQuizEligibilityReason =
  | 'no_previous'
  | 'no_say_it'
  | 'below_minimum'
  | null;

export type SkipQuizPoolResolution = {
  eligible: boolean;
  reason: SkipQuizEligibilityReason;
  availableCount: number;
  previousChapterId: string | null;
  previousChapterNumber: number | null;
  topicIds: string[];
  playableNodeIds: string[];
};

function chapterIndex(chapterId: string): number {
  return FOUNDATION_V7_CATALOG.chapters.findIndex((ch) => ch.id === chapterId);
}

/** Merge all Say It pools from the chapter before `targetChapterId`. */
export function resolveSkipQuizPool(targetChapterId: string): SkipQuizPoolResolution {
  const targetIdx = chapterIndex(targetChapterId);
  if (targetIdx <= 0) {
    return {
      eligible: false,
      reason: 'no_previous',
      availableCount: 0,
      previousChapterId: null,
      previousChapterNumber: null,
      topicIds: [],
      playableNodeIds: [],
    };
  }

  const previous = FOUNDATION_V7_CATALOG.chapters[targetIdx - 1];
  const topicIds = previous.items
    .filter((node) => node.type === 'say_it' && node.contentRef.topicId)
    .map((node) => node.contentRef.topicId as string);

  const seen = new Set<string>();
  let availableCount = 0;
  for (const topicId of topicIds) {
    for (const phrase of sayItPoolForTopic(topicId)) {
      if (seen.has(phrase.id)) continue;
      seen.add(phrase.id);
      availableCount += 1;
    }
  }

  const clientChapters = toFoundationV7ClientChapters(['say_it_guided']);
  const previousClient = clientChapters[targetIdx - 1];
  const playableNodeIds = previousClient.items
    .filter((node) => !node.comingSoon)
    .map((node) => node.id);

  if (topicIds.length === 0 || availableCount === 0) {
    return {
      eligible: false,
      reason: 'no_say_it',
      availableCount: 0,
      previousChapterId: previous.id,
      previousChapterNumber: previous.number,
      topicIds,
      playableNodeIds,
    };
  }

  if (availableCount < SKIP_QUIZ_MIN_DEAL) {
    return {
      eligible: false,
      reason: 'below_minimum',
      availableCount,
      previousChapterId: previous.id,
      previousChapterNumber: previous.number,
      topicIds,
      playableNodeIds,
    };
  }

  return {
    eligible: true,
    reason: null,
    availableCount,
    previousChapterId: previous.id,
    previousChapterNumber: previous.number,
    topicIds,
    playableNodeIds,
  };
}

export function skipQuizDealCount(availableCount: number): number {
  if (availableCount < SKIP_QUIZ_MIN_DEAL) return 0;
  const preferred = Math.min(
    SKIP_QUIZ_MAX_DEAL,
    Math.max(SKIP_QUIZ_MIN_DEAL, SKIP_QUIZ_PREFERRED_DEAL),
  );
  return Math.min(preferred, availableCount, SKIP_QUIZ_MAX_DEAL);
}

export function skipQuizEligibilityPayload(targetChapterId: string) {
  const resolved = resolveSkipQuizPool(targetChapterId);
  return {
    eligible: resolved.eligible,
    availableCount: resolved.availableCount,
    questionCount: skipQuizDealCount(resolved.availableCount),
    bananaCost: SKIP_QUIZ_BANANA_COST,
    minDeal: SKIP_QUIZ_MIN_DEAL,
    reason: resolved.reason ?? undefined,
    previousChapterId: resolved.previousChapterId,
  };
}

/** Shuffle merged previous-chapter Say It phrases; deal preferred count (usually 7). */
export function dealSkipQuizPhrases(
  targetChapterId: string,
  displayName?: string | null,
): SayItPhrase[] {
  const resolved = resolveSkipQuizPool(targetChapterId);
  if (!resolved.eligible) return [];

  const seen = new Set<string>();
  const pool: SayItPhrase[] = [];
  for (const topicId of resolved.topicIds) {
    for (const phrase of sayItPoolForTopic(topicId)) {
      if (seen.has(phrase.id)) continue;
      seen.add(phrase.id);
      pool.push(phrase);
    }
  }

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const n = skipQuizDealCount(pool.length);
  // Chapter unlock quizzes are free-speak only — no letter/guided hints.
  return pool.slice(0, n).map((phrase) => {
    const personalized = personalizeSayItPhrase(phrase, displayName);
    return {
      id: personalized.id,
      promptTh: personalized.promptTh,
      ...(personalized.subtitleTh ? { subtitleTh: personalized.subtitleTh } : {}),
      answerEn: personalized.answerEn,
      acceptedAnswers: personalized.acceptedAnswers,
    };
  });
}

export function isSkipQuizPassed(correctCount: number, totalCount: number): boolean {
  if (!Number.isFinite(correctCount) || !Number.isFinite(totalCount) || totalCount <= 0) {
    return false;
  }
  return correctCount / totalCount > SKIP_QUIZ_PASS_RATIO;
}

export { FOUNDATION_V7_PATH_ID };
