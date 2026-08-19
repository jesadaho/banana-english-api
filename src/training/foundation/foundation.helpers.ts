import {
  computeThreeTierChoiceProgress,
  createBoardChoiceScorer,
  type ChoiceStepTier,
  type ForcedGuidedBoard,
} from '../../lessons/lessons.data';
import {
  buildOpeningFromBoard,
  type ChoiceLessonDef,
  type ChoiceLessonHistoryTurn,
} from '../scripts/choice-lesson.script';
import type { ScriptTurnResult } from '../scripts/types';

export const FOUNDATION_LESSON_IDS = [
  'introductions',
  'yes_no_maybe',
  'polite_expressions',
  'meet_people',
  'talk_about_groups',
  'ee_about_me_family',
  'numbers',
  'telling_time',
  'everyday_numbers',
  'money_prices',
  'likes_dislikes',
  'wants_needs',
  'can_cant',
  'asking_for_help',
  'asking_questions',
] as const;

export type FoundationLessonId = (typeof FOUNDATION_LESSON_IDS)[number];

export function personalize(text: string, name: string): string {
  const n = name.trim() || 'Ben';
  return text.replace(/\{name\}/g, n);
}

export function extractIntroducedName(
  history: ChoiceLessonHistoryTurn[],
  fallback = 'Ben',
): string {
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const text = (turn.textEn ?? '').trim();
    if (!text) continue;

    const myName = text.match(/^my name is (.+?)\.?$/i);
    if (myName?.[1]) return myName[1].trim();

    const im = text.match(/^i['']?m (.+?)\.?$/i);
    if (im?.[1] && !/^(ready|from|a |an |the )/i.test(im[1])) {
      return im[1].trim();
    }

    const iAm = text.match(/^i am (.+?)\.?$/i);
    if (iAm?.[1] && !/^(ready|from|a |an |the )/i.test(iAm[1])) {
      return iAm[1].trim();
    }
  }
  return fallback;
}

export function normalizeFoundationSpeech(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function personalizeBoard(
  board: ForcedGuidedBoard,
  name: string,
): ForcedGuidedBoard {
  return {
    ...board,
    textEn: personalize(board.textEn, name),
    expectedSpeech: personalize(board.expectedSpeech, name),
    options: board.options.map((o) => ({
      ...o,
      speak: personalize(o.speak, name),
    })),
  };
}

export function createFoundationLessonDef(params: {
  lessonId: string;
  maxStep: number;
  boards?: Record<number, ForcedGuidedBoard>;
  boardForStep?: (
    step: number,
    history: ChoiceLessonHistoryTurn[],
  ) => ForcedGuidedBoard | null;
  openingText: string;
  completionText: string | ((learnerFirstName: string) => string);
  matchesLoose: (step: number, text: string) => boolean;
  pinWithoutGuidedSteps?: number[];
  buildOpening?: (learnerFirstName: string) => ScriptTurnResult;
}): ChoiceLessonDef {
  const resolveBoard = (
    step: number,
    history: ChoiceLessonHistoryTurn[],
    nameOverride?: string,
  ): ForcedGuidedBoard | null => {
    if (params.boardForStep) {
      const board = params.boardForStep(step, history);
      if (!board) return null;
      const name = nameOverride ?? extractIntroducedName(history);
      return personalizeBoard(board, name);
    }
    const raw = params.boards?.[step] ?? null;
    if (!raw) return null;
    const name = nameOverride ?? extractIntroducedName(history);
    return personalizeBoard(raw, name);
  };

  const scoreStep = (
    step: number,
    text: string,
    history: ChoiceLessonHistoryTurn[] = [],
  ): ChoiceStepTier =>
    createBoardChoiceScorer(
      normalizeFoundationSpeech,
      (s) => resolveBoard(s, history),
      params.matchesLoose,
    )(step, text);

  const completionText =
    typeof params.completionText === 'function'
      ? params.completionText
      : () => params.completionText as string;

  return {
    lessonId: params.lessonId,
    maxStep: params.maxStep,
    progressFn: (history) =>
      computeThreeTierChoiceProgress(history, params.maxStep, (step, text) =>
        scoreStep(step, text, history),
      ),
    scoreStep: (step, text, history) => scoreStep(step, text, history),
    boardForStep: (step, history) => resolveBoard(step, history),
    pinWithoutGuidedSteps: params.pinWithoutGuidedSteps,
    completionText,
    buildOpening:
      params.buildOpening ??
      ((learnerFirstName: string): ScriptTurnResult => {
        const name = learnerFirstName.trim() || 'Ben';
        const opening = personalize(params.openingText, name);
        const board = resolveBoard(1, [], name);
        return buildOpeningFromBoard(opening, board);
      }),
  };
}
