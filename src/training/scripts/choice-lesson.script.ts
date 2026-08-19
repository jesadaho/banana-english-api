import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import type { ChoiceStepTier } from '../../lessons/lessons.data';
import type { ScriptTurnResult } from './types';

export type ChoiceLessonHistoryTurn = {
  speaker: string;
  textEn?: string;
  expectedSpeech?: string | null;
};

export type ChoiceLessonBoard = {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label?: string; speak: string }>;
  withPraise?: boolean;
  /** English cue for soft-advance when textEn has no trailing question. */
  advanceQuestionEn?: string;
};

type GuidedBoard = ChoiceLessonBoard;

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
  ) => ChoiceLessonBoard | null;
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

function normalizeChoiceExpectedSpeech(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

/** When Gemini advances ahead of replay (e.g. recognition accept), last AI expectedSpeech pins the beat. */
function progressFromLastAiExpectedSpeech(
  def: ChoiceLessonDef,
  history: ChoiceLessonHistoryTurn[],
): number {
  const lastAi = [...history].reverse().find((t) => t.speaker === 'ai');
  const expected = lastAi?.expectedSpeech?.trim();
  if (!expected) return 0;

  const normalized = normalizeChoiceExpectedSpeech(expected);
  for (let step = 1; step <= def.maxStep; step++) {
    const board = def.boardForStep(step, history);
    const boardExpected = normalizeChoiceExpectedSpeech(board?.expectedSpeech);
    if (boardExpected && boardExpected === normalized) {
      return step - 1;
    }
  }
  return 0;
}

export function choiceLessonEffectiveProgress(
  def: ChoiceLessonDef,
  history: ChoiceLessonHistoryTurn[],
  sessionProgressTurn?: number,
): number {
  const replay = def.progressFn(history);
  const fromSession = def.progressFromSessionBeat?.(sessionProgressTurn) ?? 0;
  const fromLastAi = progressFromLastAiExpectedSpeech(def, history);
  return Math.max(replay, fromSession, fromLastAi);
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

function extractEnglishQuestion(textEn: string): string {
  const matches = [...textEn.matchAll(/([A-Za-z][^?]*\?)/g)];
  if (matches.length > 0) {
    return matches[matches.length - 1][1].trim();
  }
  return '';
}

function resolveSoftAdvanceQuestion(
  nextBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const explicit = nextBoard?.advanceQuestionEn?.trim();
  if (explicit) return explicit;

  const nextFull =
    nextBoard?.textEn?.trim() || nextScripted.textEn?.trim() || '';
  const fromText = extractEnglishQuestion(nextFull);
  if (fromText) return fromText;

  const nextExpected =
    nextBoard?.expectedSpeech?.trim() || nextScripted.expectedSpeech?.trim();
  if (nextExpected) return nextExpected;

  return nextFull;
}

/** 2nd wrong — model canonical answer, then next step question (no full praise block). */
export function buildSoftAdvanceTextEn(
  failedBoard: GuidedBoard | null,
  nextBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const model = failedBoard?.expectedSpeech?.trim() ?? '';
  const emoji = failedBoard?.options?.[0]?.emoji ?? '';
  const nextQuestion = resolveSoftAdvanceQuestion(nextBoard, nextScripted);

  if (model && nextQuestion) {
    return `คำตอบนี้เราพูดว่า "${model}" ได้ครับ${emoji ? ` ${emoji}` : ''}\nไปต่อกันเลย — ${nextQuestion}`;
  }
  return `ไม่เป็นไรครับ ไปต่อกัน! ${nextScripted.textEn}`;
}

function buildSoftAdvanceTextTh(
  failedBoard: GuidedBoard | null,
  nextBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const model = failedBoard?.expectedSpeech?.trim() ?? '';
  const nextQuestion = resolveSoftAdvanceQuestion(nextBoard, nextScripted);
  if (model && nextQuestion) {
    return `We can say "${model}". Let's move on — ${nextQuestion}`;
  }
  return nextScripted.textTh
    ? `No worries — let's move on! ${nextScripted.textTh}`
    : "No worries — let's move on!";
}

function boardToGuidedSpeaking(board: GuidedBoard) {
  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  if (!first) return undefined;
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
  const hasOptions = options.length > 0;
  const isSingleHint = options.length === 1;
  return {
    textEn: board.textEn,
    textTh: '',
    isLessonComplete: false,
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    guidedSpeaking:
      opts?.skipGuided || !hasOptions || (board.stem.trim() === '' && isSingleHint)
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

  const nextStep =
    progressOverride != null ? progressOverride : def.progressFn(history) + 1;

  if (def.progressFn(history) >= def.maxStep || nextStep > def.maxStep) {
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

  // Next board step (1-based): pin passes explicit step; replay uses cleared + 1.
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

/** PoolGate incorrect — always include พูดตาม even if Gemini only says ลองพูดว่า. */
export function ensureIncorrectAssessCopy(
  aiReply: TrainingTurnReply,
  board: GuidedBoard | null,
): TrainingTurnReply {
  const textEn = aiReply.textEn?.trim() ?? '';
  if (/พูดตาม|ลองพูดตาม/i.test(textEn)) {
    return aiReply;
  }

  const model = board?.expectedSpeech?.trim();
  const modelBare = model?.replace(/[.!?]+$/g, '') ?? '';
  const alreadyQuotesModel =
    Boolean(model) &&
    (textEn.includes(`"${model}"`) ||
      (modelBare !== model && textEn.includes(`"${modelBare}"`)));

  let patched: string;
  if (model && !alreadyQuotesModel) {
    patched = textEn
      ? `${textEn} ลองพูดตามนะครับ "${model}"`
      : `ลองพูดตามนะครับ "${model}"`;
  } else {
    patched = textEn ? `${textEn} ลองพูดตามนะครับ` : 'ลองพูดตามนะครับ';
  }

  return { ...aiReply, textEn: patched };
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
    const priorTurns = turns.slice(0, -1);
    const answeredStep =
      choiceLessonEffectiveProgress(def, priorTurns, sessionProgressTurn) + 1;
    // Generic lessons: progressOverride is the 1-based board step to show.
    // Daily Routine custom builder: progressOverride is cleared speak steps (= answeredStep).
    const nextStep = def.buildScriptedReplyFromProgress
      ? answeredStep
      : answeredStep + 1;
    const next = scriptedFromProgress(
      def,
      turns,
      nextStep,
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
      assessmentTier: tier,
    };
  }

  const priorTurns = turns.slice(0, -1);
  const answeredStep =
    choiceLessonEffectiveProgress(def, priorTurns, sessionProgressTurn) + 1;
  const board = def.boardForStep(answeredStep, turns);
  const withTeach = ensureIncorrectAssessCopy(aiReply, board);
  return {
    ...pinCurrentBoard(def, turns, answeredStep, withTeach),
    assessmentTier: 'incorrect' as const,
  };
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
  const effectiveProgress = choiceLessonEffectiveProgress(
    def,
    priorTurns,
    sessionProgressTurn,
  );
  const answeredStep = effectiveProgress + 1;
  const userText = lastUserText(turns);
  const inPool = def.scoreStep(answeredStep, userText, turns) === 'exact';

  if (inPool) {
    const nextProgress = def.buildScriptedReplyFromProgress
      ? answeredStep
      : answeredStep + 1;
    const next = scriptedFromProgress(
      def,
      turns,
      nextProgress,
      learnerFirstName,
    );
    return next ? { ...next, assessmentTier: 'correct' as const } : null;
  }

  const replayBefore = def.progressFn(priorTurns);
  const replayAfter = def.progressFn(turns);
  if (replayAfter > replayBefore) {
    const nextProgress = def.buildScriptedReplyFromProgress
      ? replayAfter
      : replayAfter + 1;
    const next = scriptedFromProgress(
      def,
      turns,
      nextProgress,
      learnerFirstName,
    );
    if (!next) return null;
    const failedBoard = def.boardForStep(answeredStep, priorTurns);
    const nextBoard = def.boardForStep(replayAfter + 1, turns);
    return {
      ...next,
      textEn: buildSoftAdvanceTextEn(failedBoard, nextBoard, next),
      textTh: buildSoftAdvanceTextTh(failedBoard, nextBoard, next),
      assessmentTier: 'incorrect' as const,
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
