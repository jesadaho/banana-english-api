import {
  foundationOutOfPoolCloseMiss,
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolWrong,
  introductionsOutOfPoolWrongAgain,
} from '../foundation/foundation-poolgate.harness';

export {
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolWrongAgain,
};

/** Off-topic wrong answer for Around Town out-of-pool scenarios. */
export function aroundTownOutOfPoolWrong(
  _exact: string,
  _step?: number,
): string {
  return 'Good morning.';
}

/** Second wrong while repeating — triggers scripted soft-advance. */
export function aroundTownOutOfPoolWrongAgain(
  _exact: string,
  _step?: number,
): string {
  return 'Hello there.';
}

const AROUND_TOWN_CLOSE_BY_LESSON: Partial<
  Record<string, Record<number, string>>
> = {
  ee_around_town_shopping: {
    1: 'shirts',
    2: 'pant',
    3: "I am looking for a shirt.",
    4: 'How much this?',
  },
  ee_around_town_restaurant: {
    1: 'chickens',
    2: 'rices',
    3: "I would like rice.",
    4: 'What you recommend?',
  },
  ee_around_town_coffee: {
    1: 'coffees',
    2: 'teas',
    3: 'Can I get a tea.',
    4: 'Can I get a cake.',
  },
  ee_around_town_convenience: {
    1: "I'm looking for museum.",
    2: "I am looking for the park.",
    3: 'Where is museum?',
    4: 'Where Big Ben?',
  },
  ee_around_town_transport: {
    1: "I am going to London.",
    2: "I'm going to Paris",
    3: "I am taking the train.",
    4: "I'm taking bus.",
  },
  ee_around_town_smart_shopper: {
    1: 'Which one cheaper?',
    2: 'This one bigger.',
    3: "I will take this one.",
    4: 'The blue one cheaper.',
    5: 'The big one bigger.',
    6: 'Sandwich B better.',
    7: "I'll take blue shirt.",
  },
  ee_around_town_hotel: {
    1: 'I have reservation.',
    2: "I would like to check in.",
    3: 'Here is passport.',
    4: 'What time breakfast?',
    5: 'Where is room?',
  },
  ee_around_town_airport: {
    1: 'passports',
    2: 'flights',
    3: "I would like to check in.",
    4: 'Here is passport.',
  },
  ee_around_town_pharmacy: {
    1: 'headaches',
    2: 'fevers',
    3: 'I have fever.',
    4: 'Can you help?',
  },
  ee_around_town_survival: {
    1: "I can't find bag.",
    2: 'Can you help.',
    3: 'Can you speak slow?',
  },
};

function ellipsisOrArticleMiss(exact: string): string {
  const trimmed = exact.trim();
  if (!trimmed) return 'Good morning.';

  // I'm / I am swap
  if (/^i'm\b/i.test(trimmed)) {
    return trimmed.replace(/^i'm\b/i, 'I am');
  }
  if (/^i am\b/i.test(trimmed)) {
    return trimmed.replace(/^i am\b/i, "I'm");
  }

  // Drop a/an/the once
  const noArticle = trimmed.replace(/\b(a|an|the)\b\s+/i, '');
  if (noArticle !== trimmed) return noArticle;

  // Trailing ellipsis near-miss
  return `${trimmed.replace(/[.!?]+$/, '')}....`;
}

/** Close-miss for Around Town scenario 3 (out-of-pool → Gemini close). */
export function aroundTownOutOfPoolCloseMiss(
  exact: string,
  step: number,
  lessonId: string,
): string {
  const authored = AROUND_TOWN_CLOSE_BY_LESSON[lessonId]?.[step];
  if (authored) return authored;
  if (exact?.trim()) return ellipsisOrArticleMiss(exact);
  return foundationOutOfPoolCloseMiss(exact, step, lessonId);
}
