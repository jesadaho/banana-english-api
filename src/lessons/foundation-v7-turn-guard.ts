import { TAP_TO_CONTINUE_SENTINEL, TAP_TO_CONTINUE_TURN_TEXT } from '../common/api.types';
import { FOUNDATION_V7_LESSON_IDS } from './foundation-v7-lessons.data';
import { canonicalFoundationV7LessonId } from './foundation-v7-lesson-id-aliases';

export function isFoundationV7LessonId(lessonId: string): boolean {
  return FOUNDATION_V7_LESSON_IDS.includes(canonicalFoundationV7LessonId(lessonId));
}

export function userTurnWasContinue(text: string | null | undefined): boolean {
  const value = (text ?? '').trim();
  return (
    value === TAP_TO_CONTINUE_SENTINEL ||
    value === TAP_TO_CONTINUE_TURN_TEXT
  );
}

function tutorLineKey(text: string): string {
  return text.trim().slice(0, 80).toLowerCase().replace(/\s+/g, ' ');
}

function looksLikeRepeatAsk(textEn: string): boolean {
  return /พูดตาม|repeat after|your turn|ตาคุณแล้ว/i.test(textEn);
}

function extractRepeatTarget(textEn: string, targetPhrases: string[]): string | null {
  const quoted = textEn.match(
    /ลองพูดตาม(?:ว่า)?\s*[“"']?([A-Za-z][^"”'\n]{0,60}?)(?:[."”']|$)/,
  );
  const extracted = quoted?.[1]?.trim().replace(/[.?!]+$/, '');
  if (extracted) {
    const known = targetPhrases.find(
      (phrase) => phrase.toLowerCase() === extracted.toLowerCase(),
    );
    if (known) return known;
    return extracted;
  }
  const hits = targetPhrases.filter((phrase) =>
    textEn.toLowerCase().includes(phrase.toLowerCase()),
  );
  hits.sort((a, b) => b.length - a.length);
  return hits[0] ?? null;
}

export function coerceFoundationV7SpeechTurn(opts: {
  isLessonComplete: boolean;
  previousUserWasContinue: boolean;
  previousAiText?: string | null;
  textEn: string;
  expectsUserSpeech: boolean;
  expectedSpeech: string | null;
  hasBoard: boolean;
  targetPhrases: string[];
}): { expectsUserSpeech: boolean; expectedSpeech: string | null } {
  if (opts.isLessonComplete) {
    return { expectsUserSpeech: false, expectedSpeech: null };
  }

  let expectsUserSpeech = opts.expectsUserSpeech;
  let expectedSpeech = opts.expectedSpeech?.trim() || null;

  if (opts.hasBoard) expectsUserSpeech = true;
  if (expectedSpeech) expectsUserSpeech = true;
  if (looksLikeRepeatAsk(opts.textEn)) expectsUserSpeech = true;

  const repeatedContinue =
    !expectsUserSpeech &&
    opts.previousUserWasContinue &&
    Boolean(opts.previousAiText) &&
    tutorLineKey(opts.previousAiText!) === tutorLineKey(opts.textEn);

  if (repeatedContinue) expectsUserSpeech = true;

  if (expectsUserSpeech && !expectedSpeech) {
    expectedSpeech =
      extractRepeatTarget(opts.textEn, opts.targetPhrases) ??
      opts.targetPhrases[0] ??
      null;
  }

  return { expectsUserSpeech, expectedSpeech };
}
