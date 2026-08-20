import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import { stripLeadingPraiseOpener } from '../../lessons/choice-board';
import type { ChoiceStepTier } from '../../lessons/lessons.data';
import type { ScriptTurnResult } from './types';

export type ChoiceLessonHistoryTurn = {
  speaker: string;
  textEn?: string;
  expectedSpeech?: string | null;
  guidedSpeaking?: {
    options?: Array<{ speak?: string }>;
  } | null;
};

export type ChoiceLessonBoard = {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label?: string; speak: string }>;
  withPraise?: boolean;
  /** English cue for soft-advance when textEn has no trailing question. */
  advanceQuestionEn?: string;
  /** Thai guide for incorrect-tier feedback (PoolGate assess). */
  incorrectHintTh?: string;
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
    learnerFirstName?: string,
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
  /** When set, defer+`near` never stays Gemini `incorrect` (Foundation STT tolerance). */
  clampNearIncorrectToCorrect?: boolean;
};

function normalizeChoiceExpectedSpeech(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function optionSpeaksSignature(
  options?: Array<{ speak?: string }> | null,
): string {
  return (options ?? [])
    .map((o) => normalizeChoiceExpectedSpeech(o.speak ?? ''))
    .filter(Boolean)
    .join('|');
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
  const lastSig = optionSpeaksSignature(lastAi?.guidedSpeaking?.options);
  const matches: number[] = [];
  for (let step = 1; step <= def.maxStep; step++) {
    const board = def.boardForStep(step, history);
    const boardExpected = normalizeChoiceExpectedSpeech(board?.expectedSpeech);
    if (boardExpected && boardExpected === normalized) {
      matches.push(step);
    }
  }
  if (matches.length === 0) return 0;

  if (lastSig) {
    const byOptions = matches.find((step) => {
      const board = def.boardForStep(step, history);
      return optionSpeaksSignature(board?.options) === lastSig;
    });
    if (byOptions) return byOptions - 1;
  }

  // Repeat-only replies omit guidedSpeaking — do not confuse with a later
  // multi-choice board that reuses the same expectedSpeech (e.g. Yes, I do.).
  const repeatOnly = matches.find((step) => {
    const board = def.boardForStep(step, history);
    return isRepeatOnlyBoard(board);
  });
  if (!lastSig && repeatOnly) return repeatOnly - 1;

  return matches[0] - 1;
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

/** Single-option repeat board — append ลองพูดตาม on incorrect. */
export function isRepeatOnlyBoard(board: GuidedBoard | null): boolean {
  if (!board) return false;
  return board.stem.trim() === '' && board.options.length === 1;
}

function shouldAppendRepeatCue(board: GuidedBoard | null): boolean {
  if (!board) return true;
  if (board.incorrectHintTh?.trim()) return false;
  return isRepeatOnlyBoard(board);
}

function formatFinalSoftAdvanceCelebration(completionText: string): string {
  const trimmed = completionText.trim();
  if (!trimmed) return '🎉 จบบทแล้วครับ! 🍌';

  const match = trimmed.match(
    /^สุดยอดครับ\s+(.+?)!\s*🎉\s*(.+?)(?:\s*—\s*เก่งมากครับ!)?\s*🍌?\s*$/u,
  );
  if (match) {
    const [, name, body] = match;
    const normalizedBody = body
      .trim()
      .replace(/ได้แล้ว\s*$/u, 'แล้ว')
      .replace(/ได้\s*$/u, 'แล้ว');
    return `🎉 จบบทแล้วครับ ${name}! ${normalizedBody}ครับ 🍌`;
  }

  return trimmed
    .replace(/^สุดยอดครับ/u, '🎉 จบบทแล้วครับ')
    .replace(/\s*—\s*เก่งมากครับ!\s*🍌?\s*$/u, ' 🍌');
}

/** Close out pool — recast canonical line, then next teaching (no double praise). */
export function buildCloseAdvanceTextEn(
  failedBoard: GuidedBoard | null,
  nextBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const model = failedBoard?.expectedSpeech?.trim() ?? '';
  const emoji = failedBoard?.options?.[0]?.emoji ?? '';
  const modelBare = model.replace(/[.!?]+$/g, '');
  const recast = modelBare
    ? `เกือบถูกแล้วครับ! พูดว่า ${modelBare}.${emoji ? ` ${emoji}` : ''}`
    : 'เกือบถูกแล้วครับ!';

  const nextRaw =
    nextBoard?.textEn?.trim() || nextScripted.textEn?.trim() || '';
  if (nextScripted.isLessonComplete) {
    return nextRaw ? `${recast}\n${nextRaw}` : recast;
  }
  const nextBody = stripLeadingPraiseOpener(nextRaw).trim();
  if (!nextBody) return recast;

  const teaching = prefixCloseAdvanceTeachingLine(nextBody);
  return `${recast}\n${teaching}`;
}

function prefixCloseAdvanceTeachingLine(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (/^ต่อไป/u.test(trimmed)) return trimmed;
  if (/^(ถ้า|เวลา|มาฝึก|ขั้นตอน)/u.test(trimmed)) {
    return `ต่อไป${trimmed}`;
  }
  return trimmed;
}

export function buildCloseAdvanceTextTh(
  failedBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const model = failedBoard?.expectedSpeech?.trim() ?? '';
  const nextTh = nextScripted.textTh?.trim() ?? '';
  if (model && nextTh) {
    return `Almost! We say "${model}". ${nextTh}`;
  }
  if (model) return `Almost! We say "${model}".`;
  return nextTh;
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
  const modelLine = model
    ? `ตรงนี้พูดว่า "${model}" ครับ${emoji ? ` ${emoji}` : ''}`
    : '';

  if (nextScripted.isLessonComplete) {
    const finalModel = model
      ? `ตรงนี้พูดได้ว่า "${model}" ครับ${emoji ? ` ${emoji}` : ''}`
      : '';
    const celebration = formatFinalSoftAdvanceCelebration(
      nextScripted.textEn?.trim() ?? '',
    );
    return finalModel ? `${finalModel}\n\n${celebration}` : celebration;
  }

  if (modelLine && nextQuestion) {
    return `${modelLine}\nไปต่อกันเลย — ${nextQuestion}`;
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
  if (nextScripted.isLessonComplete) {
    const celebration = formatFinalSoftAdvanceCelebration(
      nextScripted.textEn?.trim() ?? '',
    );
    return model
      ? `You can say "${model}". ${celebration}`
      : celebration;
  }
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
  return {
    textEn: board.textEn,
    textTh: '',
    isLessonComplete: false,
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    guidedSpeaking:
      opts?.skipGuided || !hasOptions
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
  const board = def.boardForStep(nextStep, history, learnerFirstName);
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
  learnerFirstName = '',
): TrainingTurnReply {
  const board = def.boardForStep(step, turns, learnerFirstName);
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

/** PoolGate defer: engine `near` = valid alternate; `close` = structural near-miss. */
export function reconcileDeferredAssessmentTier(
  scoreTier: ChoiceStepTier,
  aiReply: TrainingTurnReply,
): TrainingTurnReply {
  if (scoreTier === 'close') {
    return {
      ...aiReply,
      assessmentTier: 'close',
      textEn: closeAdvancePraise('', true),
      textTh: '',
    };
  }
  if (
    scoreTier === 'near' &&
    resolveChoiceAssessmentTier(aiReply) === 'incorrect'
  ) {
    return {
      ...aiReply,
      assessmentTier: 'correct',
      textEn: correctAdvancePraise(''),
      textTh: '',
    };
  }
  return aiReply;
}

const DEFERRED_RETEACH =
  /ลองพูดว่า.*อีกครั้ง|พูดตาม|ลองพูดตาม/i;

function stripDeferredReteach(textEn: string): string {
  return textEn
    .replace(/\s*ลองพูดตาม[^.!?\n]*(?:["'][^"']*["'])?[^.!?\n]*[.!?]?/gi, '')
    .replace(/\s*ลองพูดว่า[^.!?\n]*(?:อีกครั้ง)[^.!?\n]*[.!?]?/gi, '')
    .replace(/\s*พูดตาม[^.!?\n]*[.!?]?/gi, '')
    .trim();
}

/** Deferred assess + correct tier — praise only, never Gemini re-teach copy. */
export function correctAdvancePraise(textEn: string): string {
  const text = textEn.trim();
  if (!text || DEFERRED_RETEACH.test(text)) {
    const cleaned = stripDeferredReteach(text);
    if (cleaned && !DEFERRED_RETEACH.test(cleaned)) {
      return concisePraise(cleaned);
    }
    return 'ถูกต้องครับ!';
  }
  return concisePraise(text);
}

const CONCISE_PRAISES = ['ถูกต้องครับ!', 'ดีมากครับ!', 'เยี่ยมครับ!'] as const;

/** Keep AI assessment feedback to one short sentence before the next lesson beat. */
function concisePraise(text: string): string {
  const normalized = text.trim();
  if (!normalized) return CONCISE_PRAISES[0];
  let hash = 0;
  for (const char of normalized) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CONCISE_PRAISES[hash % CONCISE_PRAISES.length];
}

/** Deferred assess + close tier — tiny fix OK, never ask พูดตาม on current answer. */
export function closeAdvancePraise(textEn: string, forceClose = false): string {
  if (forceClose) return 'เกือบถูกแล้วครับ';
  const text = textEn.trim();
  if (!text) return 'เกือบถูกแล้วครับ';
  if (!DEFERRED_RETEACH.test(text)) return text;
  const cleaned = stripDeferredReteach(text);
  if (cleaned && !DEFERRED_RETEACH.test(cleaned)) return cleaned;
  return 'เกือบถูกแล้วครับ';
}

/** @deprecated Use correctAdvancePraise */
export const foundationNearCorrectPraise = correctAdvancePraise;

/** PoolGate incorrect — repeat-only boards get ลองพูดตาม + model; guided/open keep hint only. */
export function ensureIncorrectAssessCopy(
  aiReply: TrainingTurnReply,
  board: GuidedBoard | null,
): TrainingTurnReply {
  const hintTh = board?.incorrectHintTh?.trim();
  if (hintTh) {
    return { ...aiReply, textEn: hintTh };
  }

  const textEn = aiReply.textEn?.trim() || '';
  if (/พูดตาม|ลองพูดตาม/i.test(textEn)) {
    return { ...aiReply, textEn };
  }

  if (!shouldAppendRepeatCue(board)) {
    return { ...aiReply, textEn: textEn || aiReply.textEn };
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
  const priorTurns = turns.slice(0, -1);
  const answeredStep =
    choiceLessonEffectiveProgress(def, priorTurns, sessionProgressTurn) + 1;
  const userText = lastUserText(turns);
  const scoreTier = def.scoreStep(answeredStep, userText, priorTurns);
  if (def.clampNearIncorrectToCorrect) {
    aiReply = reconcileDeferredAssessmentTier(scoreTier, aiReply);
  }

  const tier = resolveChoiceAssessmentTier(aiReply);

  if (tier === 'correct' || tier === 'close') {
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
    if (tier === 'close') {
      const failedBoard = def.boardForStep(answeredStep, priorTurns, learnerFirstName);
      const nextBoardStep = def.buildScriptedReplyFromProgress
        ? answeredStep
        : answeredStep + 1;
      const nextBoard = def.boardForStep(nextBoardStep, turns, learnerFirstName);
      return {
        textEn: buildCloseAdvanceTextEn(failedBoard, nextBoard, next),
        textTh:
          buildCloseAdvanceTextTh(failedBoard, next) ||
          aiReply.textTh?.trim() ||
          next.textTh ||
          '',
        isLessonComplete: next.isLessonComplete ?? false,
        expectsUserSpeech: next.expectsUserSpeech ?? true,
        expectedSpeech: next.expectedSpeech,
        guidedSpeaking: next.guidedSpeaking,
        roleplayIntro: next.roleplayIntro,
        roleplayNpc: next.roleplayNpc,
        assessmentTier: tier,
      };
    }
    const praise = correctAdvancePraise(aiReply.textEn?.trim() ?? '');
    return {
      textEn: `${praise} ${next.textEn}`.trim(),
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

  const board = def.boardForStep(answeredStep, turns, learnerFirstName);
  const withTeach = ensureIncorrectAssessCopy(aiReply, board);
  return {
    ...pinCurrentBoard(def, turns, answeredStep, withTeach, learnerFirstName),
    assessmentTier: 'incorrect' as const,
  };
}

function isInPoolExactMatch(
  def: ChoiceLessonDef,
  answeredStep: number,
  userText: string,
  priorTurns: ChoiceLessonHistoryTurn[],
): boolean {
  return def.scoreStep(answeredStep, userText, priorTurns) === 'exact';
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
  const inPool = isInPoolExactMatch(
    def,
    answeredStep,
    userText,
    priorTurns,
  );

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
  const effectiveBefore = choiceLessonEffectiveProgress(
    def,
    priorTurns,
    sessionProgressTurn,
  );
  if (replayAfter > replayBefore && replayAfter === effectiveBefore + 1) {
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
    const failedBoard = def.boardForStep(answeredStep, priorTurns, learnerFirstName);
    const nextBoard = def.boardForStep(replayAfter + 1, turns, learnerFirstName);
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
