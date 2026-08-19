import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import type { ChoiceStepTier } from '../../lessons/lessons.data';
import type { ScriptTurnResult } from './types';

export type ChoiceLessonHistoryTurn = { speaker: string; textEn?: string };

type GuidedBoard = {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label?: string; speak: string }>;
  withPraise?: boolean;
};

/** PoolGate — exact pool match → scripted; miss → Gemini assess (correct/close/incorrect). */
export type ChoiceLessonDef = {
  lessonId: string;
  maxStep: number;
  progressFn: (history: ChoiceLessonHistoryTurn[]) => number;
  scoreStep: (
    step: number,
    userText: string,
    history: ChoiceLessonHistoryTurn[],
  ) => ChoiceStepTier;
  boardForStep: (
    step: number,
    history: ChoiceLessonHistoryTurn[],
  ) => GuidedBoard | null;
  buildOpening: (learnerFirstName: string) => ScriptTurnResult;
  buildScriptedReplyFromProgress?: (
    history: ChoiceLessonHistoryTurn[],
    progressOverride?: number,
    learnerFirstName?: string,
  ) => ScriptTurnResult | null;
  completionText?: (learnerFirstName: string) => string;
  /** When set, replaces celebrate after maxStep (e.g. Favorites → roleplay bridge). */
  afterTeachingComplete?: (
    history: ChoiceLessonHistoryTurn[],
    learnerFirstName: string,
  ) => ScriptTurnResult | null;
  pinWithoutGuidedSteps?: number[];
  progressFromSessionBeat?: (sessionProgressTurn: number | undefined) => number;
};

export function choiceLessonEffectiveProgress(
  def: ChoiceLessonDef,
  history: ChoiceLessonHistoryTurn[],
  sessionProgressTurn?: number,
): number {
  const replay = def.progressFn(history);
  const fromSession = def.progressFromSessionBeat?.(sessionProgressTurn) ?? 0;
  return Math.max(replay, fromSession);
}

export function choiceLessonCurrentStep(
  def: ChoiceLessonDef,
  history: ChoiceLessonHistoryTurn[],
  sessionProgressTurn?: number,
): number {
  return Math.min(
    choiceLessonEffectiveProgress(def, history, sessionProgressTurn) + 1,
    def.maxStep,
  );
}

function lastUserText(turns: ChoiceLessonHistoryTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].speaker === 'user') {
      return (turns[i].textEn ?? '').trim();
    }
  }
  return '';
}

function boardToGuidedSpeaking(board: GuidedBoard) {
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

export function boardToScriptTurn(
  board: GuidedBoard,
  opts?: { skipGuided?: boolean },
): ScriptTurnResult {
  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  const isSingleHint = options.length === 1;
  return {
    textEn: board.textEn,
    textTh: '',
    isLessonComplete: false,
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    guidedSpeaking:
      opts?.skipGuided || (board.stem.trim() === '' && isSingleHint)
        ? undefined
        : {
            stem: board.stem,
            emoji: first.emoji,
            speak: first.speak,
            ...(first.label ? { label: first.label } : {}),
            options,
          },
  };
}

export function buildOpeningFromBoard(
  openingText: string,
  board: GuidedBoard | null,
  opts?: { skipGuided?: boolean },
): ScriptTurnResult {
  if (!board) {
    return {
      textEn: openingText,
      textTh: '',
      isLessonComplete: false,
      expectsUserSpeech: true,
    };
  }
  return boardToScriptTurn({ ...board, textEn: openingText || board.textEn }, opts);
}

export function buildGenericScriptedReplyFromProgress(
  def: ChoiceLessonDef,
  history: ChoiceLessonHistoryTurn[],
  progressOverride?: number,
  learnerFirstName = '',
): ScriptTurnResult | null {
  if (def.buildScriptedReplyFromProgress) {
    return def.buildScriptedReplyFromProgress(
      history,
      progressOverride,
      learnerFirstName,
    );
  }

  const progress = progressOverride ?? def.progressFn(history);
  if (progress >= def.maxStep) {
    if (def.afterTeachingComplete) {
      return def.afterTeachingComplete(history, learnerFirstName);
    }
    const text =
      def.completionText?.(learnerFirstName) ?? 'สุดยอดครับ! 🎉 เก่งมากครับ! 🍌';
    return {
      textEn: text,
      textTh: '',
      isLessonComplete: true,
      expectsUserSpeech: false,
    };
  }

  const nextStep = progress + 1;
  const board = def.boardForStep(nextStep, history);
  if (!board) return null;
  return boardToScriptTurn(board);
}

function scriptedFromProgress(
  def: ChoiceLessonDef,
  turns: ChoiceLessonHistoryTurn[],
  progressOverride?: number,
  learnerFirstName = '',
): ScriptTurnResult | null {
  const scripted = buildGenericScriptedReplyFromProgress(
    def,
    turns,
    progressOverride,
    learnerFirstName,
  );
  if (!scripted) return null;
  return scripted;
}

function pinCurrentBoard(
  def: ChoiceLessonDef,
  turns: ChoiceLessonHistoryTurn[],
  step: number,
  aiReply: TrainingTurnReply,
): TrainingTurnReply {
  const board = def.boardForStep(step, turns);
  const skipGuided = def.pinWithoutGuidedSteps?.includes(step);
  if (!board || skipGuided) {
    return {
      ...aiReply,
      expectedSpeech:
        aiReply.expectedSpeech?.trim() || board?.expectedSpeech || undefined,
      guidedSpeaking: undefined,
    };
  }
  return {
    ...aiReply,
    expectedSpeech: board.expectedSpeech,
    guidedSpeaking: boardToGuidedSpeaking(board),
  };
}

export function resolveChoiceAssessmentTier(
  aiReply: TrainingTurnReply,
): 'correct' | 'close' | 'incorrect' {
  const tier = aiReply.assessmentTier;
  if (tier === 'correct' || tier === 'close' || tier === 'incorrect') {
    return tier;
  }
  return 'incorrect';
}

export function pinChoiceLessonAiReply(
  def: ChoiceLessonDef,
  turns: ChoiceLessonHistoryTurn[],
  aiReply: TrainingTurnReply,
  sessionProgressTurn?: number,
  learnerFirstName = '',
): TrainingTurnReply {
  const tier = resolveChoiceAssessmentTier(aiReply);

  if (tier === 'correct' || tier === 'close') {
    const nextProgress =
      choiceLessonEffectiveProgress(def, turns, sessionProgressTurn) + 1;
    const next = scriptedFromProgress(
      def,
      turns,
      nextProgress,
      learnerFirstName,
    );
    if (!next) return aiReply;
    return {
      textEn: `${aiReply.textEn.trim()} ${next.textEn}`.trim(),
      textTh: aiReply.textTh?.trim() || next.textTh || '',
      isLessonComplete: next.isLessonComplete ?? false,
      expectsUserSpeech: next.expectsUserSpeech ?? true,
      expectedSpeech: next.expectedSpeech,
      guidedSpeaking: next.guidedSpeaking,
      roleplayIntro: next.roleplayIntro,
      roleplayNpc: next.roleplayNpc,
    };
  }

  const priorTurns = turns.slice(0, -1);
  const answeredStep =
    choiceLessonEffectiveProgress(def, priorTurns, sessionProgressTurn) + 1;
  return pinCurrentBoard(def, turns, answeredStep, aiReply);
}

/**
 * PoolGate routing:
 * - exact (in pool) → scripted advance
 * - 2nd wrong (replay progress advanced) → scripted soft-advance
 * - else → defer to Gemini assess
 */
export function buildChoiceLessonAfterUser(
  def: ChoiceLessonDef,
  input: {
    turns: ChoiceLessonHistoryTurn[];
    learnerFirstName: string;
    sessionProgressTurn?: number;
  },
): ScriptTurnResult | null {
  const { turns, sessionProgressTurn, learnerFirstName } = input;
  const priorTurns = turns.slice(0, -1);
  const answeredStep =
    choiceLessonEffectiveProgress(def, priorTurns, sessionProgressTurn) + 1;
  const userText = lastUserText(turns);
  const inPool = def.scoreStep(answeredStep, userText, turns) === 'exact';

  if (inPool) {
    return scriptedFromProgress(def, turns, undefined, learnerFirstName);
  }

  const replayBefore = def.progressFn(priorTurns);
  const replayAfter = def.progressFn(turns);
  if (replayAfter > replayBefore) {
    const next = scriptedFromProgress(def, turns, undefined, learnerFirstName);
    if (!next) return null;
    return {
      ...next,
      textEn: `ไม่เป็นไรครับ ไปต่อกัน! ${next.textEn}`,
      textTh: next.textTh
        ? `No worries — let's move on! ${next.textTh}`
        : "No worries — let's move on!",
    };
  }

  return {
    deferToAi: true,
    aiMode: 'assess',
    textEn: '',
    textTh: '',
    isLessonComplete: false,
  };
}
