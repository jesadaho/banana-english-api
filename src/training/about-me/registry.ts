import { aroundTownRoleplayIntroSpeech } from '../../lessons/lessons.data';
import {
  buildDailyRoutineScriptedReplyFromProgress,
  dailyRoutineBoardForStep,
  dailyRoutineProgress,
  favoritesBoardForStep,
  favoritesLessonProgress,
  favoritesOpeningText,
  foodBoardForStep,
  foodFavoriteOpeningText,
  foodLessonProgress,
  friendsBoardForStep,
  friendsLessonProgress,
  friendsOpeningText,
  hobbiesBoardForStep,
  hobbiesLessonProgress,
  hobbiesOpeningText,
  homeBoardForStep,
  homeLessonProgress,
  homeOpeningText,
  peopleBoardForStepFromHistory,
  peopleLessonProgress,
  peopleOpeningText,
  petsBoardForStepFromHistory,
  petsLessonProgress,
  petsOpeningText,
  scoreDailyRoutineStep,
  scoreFavoritesStep,
  scoreFoodStepForHistory,
  scoreFriendsStep,
  scoreHobbiesStepForHistory,
  scoreHomeStep,
  scorePeopleStepForHistory,
  scorePetsStepForHistory,
  scoreWeatherStep,
  scoreWorkSchoolStepForHistory,
  weatherBoardForStep,
  weatherLessonProgress,
  weatherOpeningText,
  workSchoolBoardForStep,
  workSchoolLessonProgress,
  workSchoolOpeningText,
} from './about-me.lessons';
import type { ScriptTurnResult } from '../scripts/types';
import {
  buildOpeningFromBoard,
  type ChoiceLessonDef,
  type ChoiceLessonHistoryTurn,
} from '../scripts/choice-lesson.script';

const DR_MAX_STEP = 7;

function dailyRoutineProgressFromSessionBeat(
  sessionProgressTurn: number | undefined,
): number {
  if (sessionProgressTurn == null || sessionProgressTurn <= 0) return 0;
  return Math.min(sessionProgressTurn - 1, DR_MAX_STEP);
}

function wrapDailyRoutineScripted(
  history: ChoiceLessonHistoryTurn[],
  progressOverride?: number,
): ScriptTurnResult | null {
  const scripted = buildDailyRoutineScriptedReplyFromProgress(
    history,
    progressOverride,
  );
  if (!scripted) return null;
  return {
    textEn: scripted.textEn,
    textTh: scripted.textTh ?? '',
    isLessonComplete: scripted.isTaskComplete,
    expectsUserSpeech: scripted.expectsUserSpeech,
    expectedSpeech: scripted.expectedSpeech ?? undefined,
    guidedSpeaking: scripted.guidedSpeaking ?? undefined,
  };
}

export const ABOUT_ME_DAILY_ROUTINE: ChoiceLessonDef = {
  lessonId: 'ee_about_me_daily_routine',
  maxStep: DR_MAX_STEP,
  progressFn: dailyRoutineProgress,
  scoreStep: (step, text) => scoreDailyRoutineStep(step, text),
  boardForStep: dailyRoutineBoardForStep,
  buildScriptedReplyFromProgress: wrapDailyRoutineScripted,
  progressFromSessionBeat: dailyRoutineProgressFromSessionBeat,
  pinWithoutGuidedSteps: [1, 3, 5, 7],
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    const name = learnerFirstName.trim();
    return {
      textEn: `สวัสดีครับ${name ? ` ${name}` : ''}! วันนี้เราจะฝึกเล่ากิจวัตรประจำวันครับ 🌅 “ฉันตื่นตอนเจ็ดโมง” พูดว่า “I wake up at seven o'clock.” ลองพูดตามครับ`,
      textTh: `Hi${name ? ` ${name}` : ''}! Today we'll talk about daily routines. Repeat: “I wake up at seven o'clock.”`,
      isLessonComplete: false,
      expectsUserSpeech: true,
      expectedSpeech: "I wake up at seven o'clock.",
    };
  },
};

export const ABOUT_ME_FOOD: ChoiceLessonDef = {
  lessonId: 'ee_about_me_food',
  maxStep: 6,
  progressFn: foodLessonProgress,
  scoreStep: (step, text, history) =>
    scoreFoodStepForHistory(history, step, text),
  boardForStep: foodBoardForStep,
  completionText: (name) =>
    `สุดยอดครับ ${name.trim() || 'เพื่อน'}! 🎉 วันนี้คุณบอกได้ทั้งของโปรด รสชาติ และเครื่องดื่มที่ดื่มคู่กันแล้วครับ — เก่งมากครับ! 🍌✨`,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      foodFavoriteOpeningText(learnerFirstName),
      foodBoardForStep(1, []),
    );
  },
};

export const ABOUT_ME_HOME: ChoiceLessonDef = {
  lessonId: 'ee_about_me_home',
  maxStep: 4,
  progressFn: homeLessonProgress,
  scoreStep: (step, text) => scoreHomeStep(step, text),
  boardForStep: (step) => homeBoardForStep(step),
  completionText: () =>
    'สุดยอดครับ! 🎉 วันนี้คุณสามารถพูดเรื่องบ้านของตัวเองได้แล้ว ทั้งที่พัก คนที่อาศัยอยู่ด้วย และมุมโปรดในบ้าน เก่งมากครับ! 🍌',
  buildOpening(): ScriptTurnResult {
    return buildOpeningFromBoard(homeOpeningText(), homeBoardForStep(1));
  },
};

export const ABOUT_ME_WORK_SCHOOL: ChoiceLessonDef = {
  lessonId: 'ee_about_me_work_school',
  maxStep: 4,
  progressFn: workSchoolLessonProgress,
  scoreStep: (step, text, history) =>
    scoreWorkSchoolStepForHistory(history, step, text),
  boardForStep: workSchoolBoardForStep,
  completionText: (name) =>
    `สุดยอดครับ ${name.trim() || 'เพื่อน'}! 🎉 วันนี้คุณบอกได้ทั้งทำงานหรือเรียน ที่ทำอยู่ และความรู้สึก — แถมเชื่อมประโยคด้วย but ได้แล้วครับ! 🍌`,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      workSchoolOpeningText(learnerFirstName),
      workSchoolBoardForStep(1, []),
    );
  },
};

export const ABOUT_ME_HOBBIES: ChoiceLessonDef = {
  lessonId: 'ee_about_me_hobbies',
  maxStep: 4,
  progressFn: hobbiesLessonProgress,
  scoreStep: (step, text, history) =>
    scoreHobbiesStepForHistory(history, step, text),
  boardForStep: hobbiesBoardForStep,
  completionText: (name) =>
    `สุดยอดครับ ${name.trim() || 'เพื่อน'}! 🎉 วันนี้คุณบอกงานอดิเรก ความถี่ และสิ่งที่มักทำวันเสาร์–อาทิตย์ได้แล้ว — เก่งมากครับ! 🍌`,
  buildOpening(): ScriptTurnResult {
    return buildOpeningFromBoard(hobbiesOpeningText(), hobbiesBoardForStep(1, []));
  },
};

export const ABOUT_ME_PETS: ChoiceLessonDef = {
  lessonId: 'ee_about_me_pets',
  maxStep: 4,
  progressFn: petsLessonProgress,
  scoreStep: (step, text, history) =>
    scorePetsStepForHistory(history, step, text),
  boardForStep: petsBoardForStepFromHistory,
  completionText: (name) =>
    `สุดยอดครับ ${name.trim() || 'เพื่อน'}! 🎉 วันนี้คุณบอกสัตว์เลี้ยง บรรยายด้วย My ชมด้วย Your และพูดสองประโยคติดกันได้แล้ว — เก่งมากครับ! 🍌`,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      petsOpeningText(learnerFirstName),
      petsBoardForStepFromHistory(1, []),
    );
  },
};

export const ABOUT_ME_PEOPLE: ChoiceLessonDef = {
  lessonId: 'ee_about_me_people',
  maxStep: 5,
  progressFn: peopleLessonProgress,
  scoreStep: (step, text, history) =>
    scorePeopleStepForHistory(history, step, text),
  boardForStep: peopleBoardForStepFromHistory,
  completionText: (name) =>
    `สุดยอดครับ ${name.trim() || 'เพื่อน'}! 🎉 วันนี้คุณแนะนำคนในครอบครัว บอกอาชีพ บรรยายนิสัย และใช้ He/She ได้แล้ว — เก่งมากครับ! 🍌`,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      peopleOpeningText(learnerFirstName),
      peopleBoardForStepFromHistory(1, []),
    );
  },
};

export const ABOUT_ME_WEATHER: ChoiceLessonDef = {
  lessonId: 'ee_about_me_weather',
  maxStep: 4,
  progressFn: weatherLessonProgress,
  scoreStep: (step, text) => scoreWeatherStep(step, text),
  boardForStep: (step) => {
    const board = weatherBoardForStep(step);
    if (step === 1 && board) {
      return { ...board, textEn: weatherOpeningText() };
    }
    return board;
  },
  completionText: (name) =>
    `สุดยอดครับ ${name.trim() || 'เพื่อน'}! 🎉 วันนี้คุณบอกสภาพอากาศและบอกอากาศที่ชอบได้แล้ว — เก่งมากครับ! 🍌`,
  buildOpening(): ScriptTurnResult {
    return buildOpeningFromBoard(
      weatherOpeningText(),
      weatherBoardForStep(1),
    );
  },
};

export const ABOUT_ME_FRIENDS: ChoiceLessonDef = {
  lessonId: 'ee_about_me_friends',
  maxStep: 4,
  progressFn: friendsLessonProgress,
  scoreStep: (step, text) => scoreFriendsStep(step, text),
  boardForStep: (step) => friendsBoardForStep(step),
  completionText: (name) =>
    `สุดยอดครับ ${name.trim() || 'เพื่อน'}! 🎉 วันนี้คุณพูด We/They … together กับเพื่อนได้แล้ว — เก่งมากครับ! 🍌`,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      friendsOpeningText(learnerFirstName),
      friendsBoardForStep(1),
    );
  },
};

export const ABOUT_ME_FAVORITES: ChoiceLessonDef = {
  lessonId: 'ee_about_me_favorites',
  maxStep: 4,
  progressFn: favoritesLessonProgress,
  scoreStep: (step, text) => scoreFavoritesStep(step, text),
  boardForStep: (step) => favoritesBoardForStep(step),
  afterTeachingComplete(): ScriptTurnResult | null {
    const intro = aroundTownRoleplayIntroSpeech('ee_about_me_favorites', 'thai');
    if (!intro) return null;
    return {
      textEn: intro.textEn,
      textTh: '',
      isLessonComplete: false,
      expectsUserSpeech: false,
      roleplayIntro: intro.roleplayIntro,
    };
  },
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      favoritesOpeningText(learnerFirstName),
      favoritesBoardForStep(1),
    );
  },
};

export const ABOUT_ME_CHOICE_LESSONS: ChoiceLessonDef[] = [
  ABOUT_ME_DAILY_ROUTINE,
  ABOUT_ME_FOOD,
  ABOUT_ME_HOME,
  ABOUT_ME_WORK_SCHOOL,
  ABOUT_ME_HOBBIES,
  ABOUT_ME_PETS,
  ABOUT_ME_PEOPLE,
  ABOUT_ME_WEATHER,
  ABOUT_ME_FRIENDS,
  ABOUT_ME_FAVORITES,
];

const BY_ID = new Map(ABOUT_ME_CHOICE_LESSONS.map((d) => [d.lessonId, d]));

export function getAboutMeChoiceLesson(
  lessonId: string,
): ChoiceLessonDef | undefined {
  return BY_ID.get(lessonId);
}

export function isAboutMeChoiceLesson(lessonId: string): boolean {
  return BY_ID.has(lessonId);
}
