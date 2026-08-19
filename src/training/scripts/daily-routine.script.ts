import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import {
  buildDailyRoutineScriptedReplyFromProgress,
  dailyRoutineBoardForStep,
  dailyRoutineProgress,
  scoreDailyRoutineStep,
} from '../../lessons/lessons.data';
import type { ScriptTurnResult } from './types';

const MAX_STEP = 7;

export type DailyRoutineHistoryTurn = { speaker: string; textEn?: string };

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
  const replay = dailyRoutineProgress(history);
  const fromSession = dailyRoutineProgressFromSessionBeat(sessionProgressTurn);
  return Math.max(replay, fromSession);
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

function lastUserText(turns: DailyRoutineHistoryTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].speaker === 'user') {
      return (turns[i].textEn ?? '').trim();
    }
  }
  return '';
}

function boardToGuidedSpeaking(
  board: NonNullable<ReturnType<typeof dailyRoutineBoardForStep>>,
) {
  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    stem: board.stem,
    emoji: first.emoji,
    speak: first.speak,
    ...(first.label ? { label: first.label } : {}),
    options,
  };
}

function scriptedFromProgress(
  turns: DailyRoutineHistoryTurn[],
  progressOverride?: number,
): ScriptTurnResult | null {
  const scripted = buildDailyRoutineScriptedReplyFromProgress(
    turns,
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

function pinCurrentBoard(
  turns: DailyRoutineHistoryTurn[],
  step: number,
  aiReply: TrainingTurnReply,
): TrainingTurnReply {
  const board = dailyRoutineBoardForStep(step, turns);
  if (!board || step === 1 || step === 7) {
    return {
      ...aiReply,
      expectedSpeech:
        aiReply.expectedSpeech?.trim() ||
        board?.expectedSpeech ||
        (step === 1 ? "I'm ready" : undefined),
      guidedSpeaking: undefined,
    };
  }
  return {
    ...aiReply,
    expectedSpeech: board.expectedSpeech,
    guidedSpeaking: boardToGuidedSpeaking(board),
  };
}

/**
 * Merge AI assess output with server-pinned boards.
 * correct / close → next board; incorrect → current board soft-teach.
 */
export function resolveDailyRoutineAssessmentTier(
  aiReply: TrainingTurnReply,
): 'correct' | 'close' | 'incorrect' {
  const tier = aiReply.assessmentTier;
  if (tier === 'correct' || tier === 'close' || tier === 'incorrect') {
    return tier;
  }
  return 'incorrect';
}

export function pinDailyRoutineAiReply(
  turns: DailyRoutineHistoryTurn[],
  aiReply: TrainingTurnReply,
  sessionProgressTurn?: number,
): TrainingTurnReply {
  const priorTurns = turns.slice(0, -1);
  const answeredStep =
    dailyRoutineEffectiveProgress(priorTurns, sessionProgressTurn) + 1;
  const tier = resolveDailyRoutineAssessmentTier(aiReply);

  if (tier === 'correct' || tier === 'close') {
    const nextProgress =
      dailyRoutineEffectiveProgress(turns, sessionProgressTurn) + 1;
    const next = scriptedFromProgress(turns, nextProgress);
    if (!next) return aiReply;
    return {
      textEn: `${aiReply.textEn.trim()} ${next.textEn}`.trim(),
      textTh: aiReply.textTh?.trim() || next.textTh || '',
      isLessonComplete: next.isLessonComplete ?? false,
      expectsUserSpeech: next.expectsUserSpeech ?? true,
      expectedSpeech: next.expectedSpeech,
      guidedSpeaking: next.guidedSpeaking,
    };
  }

  return pinCurrentBoard(turns, answeredStep, aiReply);
}

export function buildDailyRoutineOpening(
  learnerFirstName: string,
): ScriptTurnResult {
  const name = learnerFirstName.trim();
  return {
    textEn: `สวัสดีครับ${name ? ` ${name}` : ''}! ยินดีต้อนรับสู่บทแรกของ About Me มาฝึกเล่าเรื่องชีวิตประจำวันกันครับ! พร้อมแล้วพูดว่า I'm ready ได้เลยครับ 🚀`,
    textTh: `Hi${name ? ` ${name}` : ''}! Welcome to About Me — let's practice daily routine English. When you're ready, say "I'm ready".`,
    isLessonComplete: false,
    expectsUserSpeech: true,
    expectedSpeech: "I'm ready",
  };
}

/**
 * v2 routing — binary pool check:
 * - exact (in pool) → scripted advance
 * - soft-advance (2nd wrong via replay) → scripted force advance
 * - everything else → defer to AI assess (semantic OK → advance, else soft-teach)
 */
export function buildDailyRoutineAfterUser(input: {
  turns: DailyRoutineHistoryTurn[];
  learnerFirstName: string;
  sessionProgressTurn?: number;
}): ScriptTurnResult | null {
  const { turns, sessionProgressTurn } = input;
  const priorTurns = turns.slice(0, -1);
  const answeredStep =
    dailyRoutineEffectiveProgress(priorTurns, sessionProgressTurn) + 1;
  const userText = lastUserText(turns);
  const inPool = scoreDailyRoutineStep(answeredStep, userText) === 'exact';

  if (inPool) {
    return scriptedFromProgress(turns);
  }

  const replayBefore = dailyRoutineProgress(priorTurns);
  const replayAfter = dailyRoutineProgress(turns);
  if (replayAfter > replayBefore) {
    const next = scriptedFromProgress(turns);
    if (!next) return null;
    return {
      ...next,
      textEn: `ไม่เป็นไรครับ ไปต่อกัน! ${next.textEn}`,
      textTh: next.textTh
        ? `No worries — let's move on! ${next.textTh}`
        : "No worries — let's move on!",
    };
  }

  return { deferToAi: true, aiMode: 'assess' };
}

export const DAILY_ROUTINE_SCRIPT = {
  lessonId: 'ee_about_me_daily_routine',
  buildOpening: buildDailyRoutineOpening,
  buildAfterUser: buildDailyRoutineAfterUser,
};
