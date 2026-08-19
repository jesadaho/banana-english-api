import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import { dailyRoutineProgress } from '../../lessons/lessons.data';
import {
  buildChoiceLessonAfterUser,
  choiceLessonEffectiveProgress,
  pinChoiceLessonAiReply,
  resolveChoiceAssessmentTier,
} from './choice-lesson.script';
import { ABOUT_ME_DAILY_ROUTINE } from './about-me.registry';
import type { ScriptTurnResult } from './types';

export type DailyRoutineHistoryTurn = { speaker: string; textEn?: string };

const DR = ABOUT_ME_DAILY_ROUTINE;
const MAX_STEP = 7;

/** Core Flow bar beat (1-based) → cleared speak steps when session is ahead of replay. */
export function dailyRoutineProgressFromSessionBeat(
  sessionProgressTurn: number | undefined,
): number {
  if (sessionProgressTurn == null || sessionProgressTurn <= 0) return 0;
  return Math.min(sessionProgressTurn - 1, MAX_STEP);
}

/** Replay progress, lifted when the session bar advanced (e.g. after AI validate). */
export function dailyRoutineEffectiveProgress(
  history: DailyRoutineHistoryTurn[],
  sessionProgressTurn?: number,
): number {
  return choiceLessonEffectiveProgress(DR, history, sessionProgressTurn);
}

export function dailyRoutineCurrentStep(
  history: DailyRoutineHistoryTurn[],
  sessionProgressTurn?: number,
): number {
  return Math.min(
    dailyRoutineEffectiveProgress(history, sessionProgressTurn) + 1,
    MAX_STEP,
  );
}

export const resolveDailyRoutineAssessmentTier = resolveChoiceAssessmentTier;

export function pinDailyRoutineAiReply(
  turns: DailyRoutineHistoryTurn[],
  aiReply: TrainingTurnReply,
  sessionProgressTurn?: number,
): TrainingTurnReply {
  return pinChoiceLessonAiReply(DR, turns, aiReply, sessionProgressTurn);
}

export function buildDailyRoutineOpening(
  learnerFirstName: string,
): ScriptTurnResult {
  return DR.buildOpening(learnerFirstName);
}

export function buildDailyRoutineAfterUser(input: {
  turns: DailyRoutineHistoryTurn[];
  learnerFirstName: string;
  sessionProgressTurn?: number;
}): ScriptTurnResult | null {
  return buildChoiceLessonAfterUser(DR, input);
}

export const DAILY_ROUTINE_SCRIPT = {
  lessonId: DR.lessonId,
  buildOpening: buildDailyRoutineOpening,
  buildAfterUser: buildDailyRoutineAfterUser,
};

/** @deprecated Use dailyRoutineProgress via ABOUT_ME_DAILY_ROUTINE */
export { dailyRoutineProgress };
