import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import { stripLeadingPraiseOpener } from '../../lessons/choice-board';
import type { ChoiceStepTier } from '../../lessons/lessons.data';
import type { ScriptTurnResult } from './types';

export type ChoiceLessonHistoryTurn = {
  speaker: string;
  textEn?: string;
  expectedSpeech?: string | null;
  assessmentTier?: 'correct' | 'close' | 'incorrect';
  wasSoftAdvance?: boolean;
  guidedSpeaking?: {
    options?: Array<{ speak?: string }>;
  } | null;
};

export type ChoiceLessonBoard = {
  textEn: string;
  ttsText?: string;
  ttsInstruction?: string;
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
  completionTtsText?: (learnerFirstName: string) => string;
  ttsInstruction?: string;
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

function localizedNextInstruction(
  nextBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const localized =
    nextBoard?.textEn?.trim() ||
    nextBoard?.advanceQuestionEn?.trim() ||
    nextScripted.textEn?.trim() ||
    '';
  return stripLeadingPraiseOpener(localized).trim();
}

/** Never advance with a blank teacher line — fall back to board cue / stem. */
function ensureAdvanceHasText(
  next: ScriptTurnResult,
  nextBoard: GuidedBoard | null,
): ScriptTurnResult {
  if (next.isLessonComplete || next.textEn?.trim()) return next;
  const fallback =
    nextBoard?.advanceQuestionEn?.trim() ||
    nextBoard?.textEn?.trim() ||
    nextBoard?.stem?.trim() ||
    'มาลองข้อต่อไปกันครับ';
  return { ...next, textEn: fallback };
}

function asTtsBoard(board: GuidedBoard | null): GuidedBoard | null {
  return board ? { ...board, textEn: board.ttsText?.trim() || board.textEn } : null;
}

function asTtsTurn(turn: ScriptTurnResult): ScriptTurnResult {
  return { ...turn, textEn: turn.ttsText?.trim() || turn.textEn };
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

export type LessonCompletionStatus =
  | 'completed_independently'
  | 'completed_with_support'
  | 'needs_review';

function completionStatusFromHistory(
  history: ChoiceLessonHistoryTurn[],
  maxStep: number,
  extraSoftAdvances = 0,
): LessonCompletionStatus {
  const softAdvances =
    history.filter((turn) => turn.speaker === 'ai' && turn.wasSoftAdvance).length +
    extraSoftAdvances;
  if (softAdvances >= Math.ceil(maxStep / 2)) return 'needs_review';
  const receivedSupport = history.some(
    (turn) => turn.speaker === 'ai' && turn.assessmentTier === 'incorrect',
  );
  return softAdvances > 0 || receivedSupport
    ? 'completed_with_support'
    : 'completed_independently';
}

function supportedCompletionText(
  status: LessonCompletionStatus,
  learnerFirstName: string,
): string {
  const name = learnerFirstName.trim() || 'เพื่อน';
  return status === 'needs_review'
    ? `เรียนครบแล้วครับ ${name} ลองทบทวนบทนี้อีกครั้งนะครับ`
    : `เรียนครบแล้วครับ ${name} คุณทำบทเรียนจบโดยได้รับคำแนะนำบางส่วน ลองฝึกอีกครั้งเพื่อให้คล่องขึ้นนะครับ`;
}

/** Prefer stem / โครง hint for phrase boards; keep full reveal for short vocab. */
export function softRevealCue(board: GuidedBoard | null): {
  kind: 'skeleton' | 'full';
  cue: string;
  emoji: string;
} {
  const emoji = boardTargetEmoji(board);
  const model = board?.expectedSpeech?.trim() ?? '';
  const modelBare = model.replace(/[.!?]+$/g, '').trim();
  const stem = board?.stem?.trim() ?? '';
  const hint = board?.incorrectHintTh?.trim() ?? '';

  const stemCue = stem
    .replace(/_{2,}/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
  // Stem that is only "..." is a vocab slot — do not treat as a phrase skeleton.
  const stemIsPlaceholderOnly = !stemCue || /^(\.\.\.|…)+$/.test(stemCue);

  if (!stemIsPlaceholderOnly && /(\.\.\.|…)/.test(stemCue)) {
    return { kind: 'skeleton', cue: stemCue, emoji };
  }

  const fromHint = hint.match(/โครง\s+(.+?)\s*ครับ/u);
  if (fromHint?.[1]?.trim()) {
    return {
      kind: 'skeleton',
      cue: fromHint[1].trim().replace(/_{2,}/g, '...'),
      emoji,
    };
  }

  // Single-token vocab (shirt / coffee / Hot.) — keep full reveal.
  if (modelBare && !/\s/.test(modelBare)) {
    return { kind: 'full', cue: modelBare, emoji };
  }

  return { kind: 'full', cue: model || modelBare, emoji };
}

function formatCloseRecast(board: GuidedBoard | null): string {
  const { kind, cue, emoji } = softRevealCue(board);
  if (!cue) return 'เกือบถูกแล้วครับ!';
  if (kind === 'skeleton') {
    return `เกือบถูกแล้วครับ! ลองใช้โครง ${cue} ครับ${emoji ? ` ${emoji}` : ''}`;
  }
  const bare = cue.replace(/[.!?]+$/g, '');
  return `เกือบถูกแล้วครับ! พูดว่า ${bare}.${emoji ? ` ${emoji}` : ''}`;
}

function formatSoftAdvanceModelLine(board: GuidedBoard | null): string {
  const { kind, cue, emoji } = softRevealCue(board);
  if (!cue) return '';
  if (kind === 'skeleton') {
    return `ตรงนี้ใช้โครง "${cue}" ครับ${emoji ? ` ${emoji}` : ''}`;
  }
  const model = board?.expectedSpeech?.trim() || cue;
  return `ตรงนี้พูดว่า "${model}" ครับ${emoji ? ` ${emoji}` : ''}`;
}

/** Close out pool — skeleton for phrase boards; full line only for short vocab. */
export function buildCloseAdvanceTextEn(
  failedBoard: GuidedBoard | null,
  nextBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const recast = formatCloseRecast(failedBoard);

  const nextRaw =
    nextBoard?.textEn?.trim() ||
    nextBoard?.advanceQuestionEn?.trim() ||
    nextScripted.textEn?.trim() ||
    '';
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

function boardTargetEmoji(board: GuidedBoard | null): string {
  if (!board) return '';
  const target = normalizeChoiceExpectedSpeech(board.expectedSpeech);
  return (
    board.options.find(
      (option) => normalizeChoiceExpectedSpeech(option.speak) === target,
    )?.emoji ?? board.options[0]?.emoji ?? ''
  );
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

/** 2nd wrong — skeleton for phrase boards; full model only for short vocab. */
export function buildSoftAdvanceTextEn(
  failedBoard: GuidedBoard | null,
  nextBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const nextInstruction = localizedNextInstruction(nextBoard, nextScripted);
  const modelLine = formatSoftAdvanceModelLine(failedBoard);
  const { kind, cue, emoji } = softRevealCue(failedBoard);

  if (nextScripted.isLessonComplete) {
    const finalModel = cue
      ? kind === 'skeleton'
        ? `ตรงนี้ใช้โครง "${cue}" ครับ${emoji ? ` ${emoji}` : ''}`
        : `ตรงนี้พูดได้ว่า "${failedBoard?.expectedSpeech?.trim() || cue}" ครับ${emoji ? ` ${emoji}` : ''}`
      : '';
    const completion = nextScripted.textEn?.trim() ?? '';
    return finalModel ? `${finalModel}\n\n${completion}` : completion;
  }

  if (modelLine && nextInstruction) {
    return `${modelLine}\nไปต่อกันเลย — ${nextInstruction}`;
  }
  if (modelLine) {
    const fallback =
      nextBoard?.advanceQuestionEn?.trim() ||
      nextBoard?.stem?.trim() ||
      nextScripted.textEn?.trim() ||
      'มาลองข้อต่อไปกันครับ';
    return `${modelLine}\nไปต่อกันเลย — ${stripLeadingPraiseOpener(fallback).trim()}`;
  }
  return `ไม่เป็นไรครับ ไปต่อกัน! ${
    nextScripted.textEn?.trim() ||
    nextBoard?.advanceQuestionEn?.trim() ||
    nextBoard?.stem?.trim() ||
    'มาลองข้อต่อไปกันครับ'
  }`;
}

function buildSoftAdvanceTextTh(
  failedBoard: GuidedBoard | null,
  nextBoard: GuidedBoard | null,
  nextScripted: ScriptTurnResult,
): string {
  const model = failedBoard?.expectedSpeech?.trim() ?? '';
  const nextQuestion = localizedNextInstruction(nextBoard, nextScripted);
  if (nextScripted.isLessonComplete) {
    return model
      ? `You can say "${model}". ${nextScripted.textEn?.trim() ?? ''}`
      : nextScripted.textEn?.trim() ?? '';
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
    ...(board.ttsText?.trim() ? { ttsText: board.ttsText.trim() } : {}),
    ...(board.ttsInstruction?.trim()
      ? { ttsInstruction: board.ttsInstruction.trim() }
      : {}),
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
    const completionStatus = completionStatusFromHistory(history, def.maxStep);
    const text = completionStatus === 'completed_independently'
      ? def.completionText?.(learnerFirstName) ?? 'สุดยอดครับ! 🎉 เก่งมากครับ! 🍌'
      : supportedCompletionText(completionStatus, learnerFirstName);
    const ttsText = completionStatus === 'completed_independently'
      ? def.completionTtsText?.(learnerFirstName)
      : undefined;
    return {
      textEn: text,
      ...(ttsText?.trim() ? { ttsText: ttsText.trim() } : {}),
      ...(def.ttsInstruction?.trim()
        ? { ttsInstruction: def.ttsInstruction.trim() }
        : {}),
      textTh: '',
      isLessonComplete: true,
      expectsUserSpeech: false,
      completionStatus,
    };
  }

  // Next board step (1-based): pin passes explicit step; replay uses cleared + 1.
  const board = def.boardForStep(nextStep, history, learnerFirstName);
  if (!board) return null;
  return ensureAdvanceHasText(boardToScriptTurn(board), board);
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

  let textEn = aiReply.textEn?.trim() || '';
  // An incorrect answer must never receive celebratory feedback, even when the
  // assessment model returns contradictory copy such as "เก่งมาก... แต่...".
  if (/^(เก่งมาก|ดีมาก|เยี่ยม|ยอดเยี่ยม|สุดยอด|ถูกต้อง)/u.test(textEn)) {
    const model = board?.expectedSpeech?.trim();
    textEn = model
      ? `ตรงนี้เราพูดว่า “${model}” ครับ ลองอีกครั้งนะครับ`
      : 'ยังไม่ตรงครับ ลองอีกครั้งนะครับ';
  }
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
        ttsText: buildCloseAdvanceTextEn(
          failedBoard,
          asTtsBoard(nextBoard),
          asTtsTurn(next),
        ),
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
        ttsInstruction: next.ttsInstruction,
        assessmentTier: tier,
      };
    }
    if (next.isLessonComplete) {
      return {
        ...next,
        assessmentTier: tier,
      };
    }
    const nextBoardForPraise = def.boardForStep(
      nextStep,
      turns,
      learnerFirstName,
    );
    const nextBody = (
      stripLeadingPraiseOpener(next.textEn?.trim() ?? '').trim() ||
      nextBoardForPraise?.advanceQuestionEn?.trim() ||
      nextBoardForPraise?.stem?.trim() ||
      ''
    ).trim();
    const nextTtsBody = (
      stripLeadingPraiseOpener(
        next.ttsText?.trim() || next.textEn?.trim() || '',
      ).trim() ||
      nextBoardForPraise?.advanceQuestionEn?.trim() ||
      nextBody
    ).trim();
    const praise = nextBoardForPraise?.withPraise === false
      ? ''
      : correctAdvancePraise(aiReply.textEn?.trim() ?? '');
    return {
      textEn: `${praise} ${nextBody}`.trim() || 'มาลองข้อต่อไปกันครับ',
      ttsText: `${praise} ${nextTtsBody}`.trim() || 'มาลองข้อต่อไปกันครับ',
      textTh: aiReply.textTh?.trim() || next.textTh || '',
      isLessonComplete: next.isLessonComplete ?? false,
      expectsUserSpeech: next.expectsUserSpeech ?? true,
      expectedSpeech: next.expectedSpeech,
      guidedSpeaking: next.guidedSpeaking,
      roleplayIntro: next.roleplayIntro,
      roleplayNpc: next.roleplayNpc,
      ttsInstruction: next.ttsInstruction,
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
    const completionStatus = next.isLessonComplete
      ? completionStatusFromHistory(turns, def.maxStep, 1)
      : undefined;
    const composedNext = completionStatus
      ? {
          ...next,
          completionStatus,
          textEn: supportedCompletionText(completionStatus, learnerFirstName),
        }
      : next;
    return {
      ...composedNext,
      textEn: buildSoftAdvanceTextEn(failedBoard, nextBoard, composedNext),
      ttsText: buildSoftAdvanceTextEn(
        failedBoard,
        asTtsBoard(nextBoard),
        asTtsTurn(composedNext),
      ),
      textTh: buildSoftAdvanceTextTh(failedBoard, nextBoard, composedNext),
      assessmentTier: 'incorrect' as const,
      wasSoftAdvance: true,
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
