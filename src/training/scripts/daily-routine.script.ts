import {
  buildDailyRoutineScriptedReplyFromProgress,
  buildSoftTeachRevealLine,
  dailyRoutineBoardForStep,
  dailyRoutineProgress,
  scoreDailyRoutineStep,
} from '../../lessons/lessons.data';
import { resolveChoiceStepContext } from '../engine/choice-step.resolver';
import { resolveTurnLane } from '../engine/turn-lanes';
import type { ScriptTurnResult } from './types';

const MAX_STEP = 7;

type HistoryTurn = { speaker: string; textEn?: string };

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

function scriptedFromProgress(turns: HistoryTurn[]): ScriptTurnResult | null {
  const scripted = buildDailyRoutineScriptedReplyFromProgress(turns);
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

function buildSoftTeachReply(
  turns: HistoryTurn[],
  step: number,
): ScriptTurnResult {
  const board = dailyRoutineBoardForStep(step, turns);
  const expectedSpeech =
    board?.expectedSpeech ?? (step === 1 ? "I'm ready" : '');
  const textEn = buildSoftTeachRevealLine(
    expectedSpeech,
    'thai',
    board?.softTeachHintTh,
  );
  const reply: ScriptTurnResult = {
    textEn,
    textTh: '',
    isLessonComplete: false,
    expectsUserSpeech: true,
    expectedSpeech,
  };
  if (board && step !== 1 && step !== 7) {
    reply.guidedSpeaking = boardToGuidedSpeaking(board);
  }
  return reply;
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

export function buildDailyRoutineAfterUser(input: {
  turns: HistoryTurn[];
  learnerFirstName: string;
}): ScriptTurnResult | null {
  const { turns } = input;
  const ctx = resolveChoiceStepContext(
    turns,
    MAX_STEP,
    scoreDailyRoutineStep,
    dailyRoutineProgress,
  );

  if (ctx.tier === 'exact') {
    return scriptedFromProgress(turns);
  }

  const progressBefore = dailyRoutineProgress(turns.slice(0, -1));
  const progressAfter = dailyRoutineProgress(turns);
  if (progressAfter > progressBefore) {
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

  const lane = resolveTurnLane({
    tier: ctx.tier,
    attempt: ctx.attempt,
    nearMeansSemantic: false,
  });

  if (lane === 'scriptedSoftTeach') {
    return buildSoftTeachReply(turns, ctx.step);
  }

  return scriptedFromProgress(turns);
}

export const DAILY_ROUTINE_SCRIPT = {
  lessonId: 'ee_about_me_daily_routine',
  buildOpening: buildDailyRoutineOpening,
  buildAfterUser: buildDailyRoutineAfterUser,
};
