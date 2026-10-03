import poolsJson from './story-bites-pools.json';

export type StoryBitesQuestion = {
  id: string;
  questionEn: string;
  answerEn: string;
  acceptedAnswers: string[];
  hints: string[];
};

/**
 * One short story clip plus three spoken questions. Until real video ships the
 * clip is the `script` read by device TTS over a still image.
 */
export type StoryBitesPool = {
  id: string;
  clipId: string;
  titleEn: string;
  titleTh: string;
  speaker: string;
  script: string;
  imagePath?: string;
  questions: StoryBitesQuestion[];
};

export const STORY_BITES_QUESTION_COUNT = 3;

const catalog = poolsJson as Record<string, StoryBitesPool>;

export const STORY_BITES_POOLS = catalog;

export function storyBitesPoolById(poolId: string): StoryBitesPool | undefined {
  return STORY_BITES_POOLS[poolId];
}

export function isValidStoryBitesPack(pool: StoryBitesPool | undefined): boolean {
  return Boolean(
    pool &&
      pool.script.trim() &&
      pool.questions.length === STORY_BITES_QUESTION_COUNT &&
      pool.questions.every((q) => q.answerEn.trim()),
  );
}
