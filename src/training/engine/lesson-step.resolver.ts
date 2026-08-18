import {
  scoreAnswer,
  scoreGreetingVariant,
  type AnswerScore,
} from './answer-scorer';

export type StepContext = {
  /** Core Flow step the learner is currently working on (1–9 for Greetings). */
  step: number;
  /** 1-based attempt on this step (resets after advance). */
  attempt: number;
};

const GREETINGS_PHRASES = [
  'Hello',
  'Hi',
  'Good morning',
  'Good afternoon',
  'Good evening',
];

/** Recognition step 3 — casual friend → Hi */
export const GREETINGS_STEP3_EXPECTED = 'Hi';
/** Recognition step 7 — 7am → Good morning */
export const GREETINGS_STEP7_EXPECTED = 'Good morning';

function expectedPhrasesForGreetingsStep(step: number): string[] {
  switch (step) {
    case 1:
      return ['Hello'];
    case 2:
      return ['Hi'];
    case 3:
      return [GREETINGS_STEP3_EXPECTED];
    case 4:
      return ['Good morning'];
    case 5:
      return ['Good afternoon'];
    case 6:
      return ['Good evening'];
    case 7:
      return [GREETINGS_STEP7_EXPECTED];
    case 8:
      return GREETINGS_PHRASES;
    default:
      return [];
  }
}

function scoreGreetingsStep(
  step: number,
  userText: string,
  originalText: string,
): AnswerScore {
  const phrases = expectedPhrasesForGreetingsStep(step);
  if (phrases.length === 0) {
    return { matched: true, matchedPhrase: null, normalized: '' };
  }

  if (step === 8) {
    return scoreAnswer(userText, phrases, originalText);
  }

  const expected = phrases[0]!;
  if (expected.includes(' ')) {
    return scoreGreetingVariant(userText, expected, originalText);
  }
  return scoreAnswer(userText, [expected], originalText);
}

/**
 * Replay session history to find the active Core Flow step + attempt count.
 * Opening is step 1 (Hello) before the first user turn.
 */
export function resolveGreetingsStep(
  turns: Array<{ speaker: string; textEn?: string }>,
): StepContext {
  let step = 1;
  let attempt = 0;

  for (const turn of turns) {
    if (turn.speaker !== 'user') continue;

    attempt++;
    const score = scoreGreetingsStep(
      step,
      turn.textEn ?? '',
      turn.textEn ?? '',
    );

    if (score.matched) {
      step = Math.min(step + 1, 9);
      attempt = 0;
    } else if (attempt >= 2) {
      step = Math.min(step + 1, 9);
      attempt = 0;
    }
  }

  return { step, attempt };
}

export function greetingsExpectedSpeechForStep(step: number): string | null {
  if (step === 8) return null;
  const phrases = expectedPhrasesForGreetingsStep(step);
  return phrases[0] ?? null;
}

export function scoreGreetingsUserTurn(
  step: number,
  userText: string,
  originalText: string,
): AnswerScore {
  return scoreGreetingsStep(step, userText, originalText);
}
