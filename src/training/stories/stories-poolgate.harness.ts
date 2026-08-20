import {
  foundationOutOfPoolCloseMiss,
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolWrongAgain,
} from '../foundation/foundation-poolgate.harness';

export {
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolWrongAgain,
};

/** Off-topic wrong answer for Stories out-of-pool scenarios. */
export function storiesOutOfPoolWrong(
  _exact: string,
  _step?: number,
): string {
  return 'Good morning.';
}

/** Second wrong while repeating — triggers scripted soft-advance. */
export function storiesOutOfPoolWrongAgain(
  _exact: string,
  _step?: number,
): string {
  return 'Hello there.';
}

const STORIES_CLOSE_BY_LESSON: Partial<
  Record<string, Record<number, string>>
> = {
  ee_stories_yesterday: {
    1: 'I eat breakfast this morning.',
    2: 'I eat breakfast yesterday.',
    3: 'I go to work yesterday.',
    4: 'What you do yesterday?',
    5: 'Did you eat breakfast yesterday',
  },
  ee_stories_last_weekend: {
    1: 'I go to the beach.',
    2: 'I go shopping.',
    3: 'I have fun.',
    4: 'What you do last weekend?',
    5: 'Did you have fun',
  },
  ee_stories_vacation: {
    1: 'I go to Japan.',
    2: 'I go to Korea.',
    3: 'I stay at a hotel.',
    4: 'Where you go on vacation?',
    5: 'Did you take many photos',
  },
  ee_stories_birthday: {
    1: 'I have a birthday party.',
    2: 'I get a gift.',
    3: 'We eat cake together.',
    4: 'How your birthday?',
    5: 'Did you get a gift',
  },
  ee_stories_school: {
    1: 'I study English.',
    2: 'I play football.',
    3: "I don't like homework.",
    4: 'What you do at school?',
    5: 'Did you like homework',
  },
  ee_stories_funny: {
    1: 'First I forgot my bag.',
    2: 'Then I lost my phone.',
    3: 'Everyone laugh.',
    4: 'What happen first?',
    5: 'What happen next?',
  },
  ee_stories_bad_day: {
    1: 'I was late because traffic.',
    2: 'It rain, so I took the bus.',
    3: 'I was tired because rain.',
    4: 'What happen?',
    5: 'Did you have umbrella?',
  },
  ee_stories_first_time: {
    1: 'It was my first time',
    2: 'It was my first time on airplane.',
    3: 'I was excite.',
    4: 'Was it your first time',
    5: 'Did you enjoy it',
  },
  ee_stories_favorite: {
    1: 'My favorite memory was family trip.',
    2: 'My favorite memory was holiday.',
    3: 'We were happy because together.',
    4: 'What your favorite memory?',
    5: 'Why it special?',
  },
  ee_stories_last_night: {
    1: 'I was watch TV.',
    2: 'He was cook.',
    3: 'She was read.',
    4: 'They were play games.',
    5: 'I was watching TV when friend called.',
    6: 'I was cooking when lights went out.',
  },
};

function ellipsisOrArticleMiss(exact: string): string {
  const trimmed = exact.trim();
  if (!trimmed) return 'Good morning.';

  if (/^i'm\b/i.test(trimmed)) {
    return trimmed.replace(/^i'm\b/i, 'I am');
  }
  if (/^i am\b/i.test(trimmed)) {
    return trimmed.replace(/^i am\b/i, "I'm");
  }

  const noArticle = trimmed.replace(/\b(a|an|the)\b\s+/i, '');
  if (noArticle !== trimmed) return noArticle;

  return `${trimmed.replace(/[.!?]+$/, '')}....`;
}

/** Close-miss for Stories scenario 3 (out-of-pool → Gemini close). */
export function storiesOutOfPoolCloseMiss(
  exact: string,
  step: number,
  lessonId: string,
): string {
  const authored = STORIES_CLOSE_BY_LESSON[lessonId]?.[step];
  if (authored) return authored;
  if (exact?.trim()) return ellipsisOrArticleMiss(exact);
  return foundationOutOfPoolCloseMiss(exact, step, lessonId);
}
