import type { ScriptTurnResult } from '../scripts/types';
import {
  type ChoiceLessonDef,
} from '../scripts/choice-lesson.script';
import {
  badDayBoardForStep,
  badDayCelebrate,
  badDayLessonProgress,
  badDayOpeningText,
  birthdayBoardForStep,
  birthdayCelebrate,
  birthdayLessonProgress,
  birthdayOpeningText,
  buildOpeningFromBoard,
  favoriteBoardForStep,
  favoriteCelebrate,
  favoriteLessonProgress,
  favoriteOpeningText,
  firstTimeBoardForStep,
  firstTimeCelebrate,
  firstTimeLessonProgress,
  firstTimeOpeningText,
  funnyBoardForStep,
  funnyCelebrate,
  funnyLessonProgress,
  funnyOpeningText,
  lastNightBoardForStep,
  lastNightLessonProgress,
  lastNightOpeningText,
  lastWeekendBoardForStep,
  lastWeekendCelebrate,
  lastWeekendLessonProgress,
  lastWeekendOpeningText,
  roleplayAfterTeaching,
  schoolBoardForStep,
  schoolCelebrate,
  schoolLessonProgress,
  schoolOpeningText,
  scoreBadDayStep,
  scoreBirthdayStep,
  scoreFavoriteStep,
  scoreFirstTimeStep,
  scoreFunnyStep,
  scoreLastNightStep,
  scoreLastWeekendStep,
  scoreSchoolStep,
  scoreVacationStep,
  scoreYesterdayStep,
  vacationBoardForStep,
  vacationCelebrate,
  vacationLessonProgress,
  vacationOpeningText,
  yesterdayBoardForStep,
  yesterdayCelebrate,
  yesterdayLessonProgress,
  yesterdayOpeningText,
} from './stories.lessons';

function afterRoleplay(lessonId: string): ScriptTurnResult | null {
  return roleplayAfterTeaching(lessonId);
}

function patternDef(params: {
  lessonId: string;
  boardForStep: (step: number) => ReturnType<typeof yesterdayBoardForStep>;
  scoreStep: (step: number, text: string) => ReturnType<typeof scoreYesterdayStep>;
  progressFn: (history: Array<{ speaker: string; textEn?: string }>) => number;
  openingText: (learnerFirstName: string) => string;
  celebrate: (learnerFirstName: string) => string;
}): ChoiceLessonDef {
  return {
    lessonId: params.lessonId,
    maxStep: 5,
    progressFn: params.progressFn,
    scoreStep: (step, text) => params.scoreStep(step, text),
    boardForStep: (step) => params.boardForStep(step),
    completionText: params.celebrate,
    clampNearIncorrectToCorrect: true,
    buildOpening(learnerFirstName: string): ScriptTurnResult {
      return buildOpeningFromBoard(
        params.openingText(learnerFirstName),
        params.boardForStep(1),
      );
    },
  };
}

export const STORIES_YESTERDAY: ChoiceLessonDef = {
  lessonId: 'ee_stories_yesterday',
  maxStep: 5,
  progressFn: yesterdayLessonProgress,
  scoreStep: (step, text) => scoreYesterdayStep(step, text),
  boardForStep: (step) => yesterdayBoardForStep(step),
  completionText: yesterdayCelebrate,
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      yesterdayOpeningText(learnerFirstName),
      yesterdayBoardForStep(1),
    );
  },
};

export const STORIES_LAST_WEEKEND: ChoiceLessonDef = patternDef({
  lessonId: 'ee_stories_last_weekend',
  boardForStep: lastWeekendBoardForStep,
  scoreStep: scoreLastWeekendStep,
  progressFn: lastWeekendLessonProgress,
  openingText: lastWeekendOpeningText,
  celebrate: lastWeekendCelebrate,
});

export const STORIES_VACATION: ChoiceLessonDef = patternDef({
  lessonId: 'ee_stories_vacation',
  boardForStep: vacationBoardForStep,
  scoreStep: scoreVacationStep,
  progressFn: vacationLessonProgress,
  openingText: vacationOpeningText,
  celebrate: vacationCelebrate,
});

export const STORIES_BIRTHDAY: ChoiceLessonDef = patternDef({
  lessonId: 'ee_stories_birthday',
  boardForStep: birthdayBoardForStep,
  scoreStep: scoreBirthdayStep,
  progressFn: birthdayLessonProgress,
  openingText: birthdayOpeningText,
  celebrate: birthdayCelebrate,
});

export const STORIES_SCHOOL: ChoiceLessonDef = patternDef({
  lessonId: 'ee_stories_school',
  boardForStep: schoolBoardForStep,
  scoreStep: scoreSchoolStep,
  progressFn: schoolLessonProgress,
  openingText: schoolOpeningText,
  celebrate: schoolCelebrate,
});

export const STORIES_FUNNY: ChoiceLessonDef = patternDef({
  lessonId: 'ee_stories_funny',
  boardForStep: funnyBoardForStep,
  scoreStep: scoreFunnyStep,
  progressFn: funnyLessonProgress,
  openingText: funnyOpeningText,
  celebrate: funnyCelebrate,
});

export const STORIES_BAD_DAY: ChoiceLessonDef = patternDef({
  lessonId: 'ee_stories_bad_day',
  boardForStep: badDayBoardForStep,
  scoreStep: scoreBadDayStep,
  progressFn: badDayLessonProgress,
  openingText: badDayOpeningText,
  celebrate: badDayCelebrate,
});

export const STORIES_FIRST_TIME: ChoiceLessonDef = patternDef({
  lessonId: 'ee_stories_first_time',
  boardForStep: firstTimeBoardForStep,
  scoreStep: scoreFirstTimeStep,
  progressFn: firstTimeLessonProgress,
  openingText: firstTimeOpeningText,
  celebrate: firstTimeCelebrate,
});

export const STORIES_FAVORITE: ChoiceLessonDef = patternDef({
  lessonId: 'ee_stories_favorite',
  boardForStep: favoriteBoardForStep,
  scoreStep: scoreFavoriteStep,
  progressFn: favoriteLessonProgress,
  openingText: favoriteOpeningText,
  celebrate: favoriteCelebrate,
});

export const STORIES_LAST_NIGHT: ChoiceLessonDef = {
  lessonId: 'ee_stories_last_night',
  maxStep: 6,
  progressFn: lastNightLessonProgress,
  scoreStep: (step, text) => scoreLastNightStep(step, text),
  boardForStep: (step) => lastNightBoardForStep(step),
  afterTeachingComplete: () => afterRoleplay('ee_stories_last_night'),
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      lastNightOpeningText(learnerFirstName),
      lastNightBoardForStep(1),
    );
  },
};

export const STORIES_CHOICE_LESSONS: ChoiceLessonDef[] = [
  STORIES_YESTERDAY,
  STORIES_LAST_WEEKEND,
  STORIES_VACATION,
  STORIES_BIRTHDAY,
  STORIES_SCHOOL,
  STORIES_FUNNY,
  STORIES_BAD_DAY,
  STORIES_FIRST_TIME,
  STORIES_FAVORITE,
  STORIES_LAST_NIGHT,
];

const BY_ID = new Map(
  STORIES_CHOICE_LESSONS.map((d) => [d.lessonId, d]),
);

export function getStoriesChoiceLesson(
  lessonId: string,
): ChoiceLessonDef | undefined {
  return BY_ID.get(lessonId);
}

export function isStoriesChoiceLesson(lessonId: string): boolean {
  return BY_ID.has(lessonId);
}
