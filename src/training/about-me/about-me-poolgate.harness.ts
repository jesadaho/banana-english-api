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

/** Off-topic wrong answer for About Me out-of-pool scenarios. */
export function aboutMeOutOfPoolWrong(_exact: string, _step?: number): string {
  return introductionsOutOfPoolWrong(_exact, _step);
}

/** Second wrong while repeating — triggers scripted soft-advance. */
export function aboutMeOutOfPoolWrongAgain(
  exact: string,
  step?: number,
): string {
  return introductionsOutOfPoolWrongAgain(exact, step);
}

const ABOUT_ME_CLOSE_BY_LESSON: Partial<
  Record<string, Record<number, string>>
> = {
  ee_about_me_daily_routine: {
    1: 'I am ready',
    2: 'get up',
    3: "I wake up at seven o'clock.",
    4: "I go to sleep at eleven o'clock.",
    5: 'I wake up at seven AM.',
    6: 'I drink coffee everyday.',
    7: 'I wake up at 7 AM each day.',
  },
  ee_about_me_food: {
    1: 'I really like pizza.',
    2: 'Pizza delicious.',
    3: 'I drink ice tea with pizza.',
    4: 'Pizza is very delicious.',
    5: 'I drink iced tea with my pizza.',
    6: 'Som tam is spicy.',
  },
  ee_about_me_home: {
    1: 'I live in apartment.',
    2: 'I live with family.',
    3: 'I like relax in the living room.',
    4: 'I live in an apartments.',
    5: 'I live with my parents.',
    6: 'I like to relaxing in the living room.',
  },
  ee_about_me_work_school: {
    1: 'I am work.',
    2: 'I work at office.',
    3: 'My work is very busy.',
    4: 'My work is busy but I enjoy.',
  },
  ee_about_me_hobbies: {
    1: 'I watch movie.',
    2: 'I often watch movie.',
    3: 'On weekend, I usually watch movies.',
    4: 'Usual.',
    5: 'Sometime.',
  },
  ee_about_me_pets: {
    1: 'I have dog.',
    2: 'My dog is friendly.',
    3: 'Your dog is friendly.',
    4: 'I have a dog. My dog friendly.',
  },
  ee_about_me_people: {
    1: 'My brother',
    2: 'My brother is engineer.',
    3: 'He very funny.',
    4: 'He is funny.',
    5: 'She very nice.',
  },
  ee_about_me_weather: {
    1: 'hot',
    2: 'The weather is very cold.',
    3: 'I like sunny.',
    4: 'I like rainy.',
  },
  ee_about_me_friends: {
    1: 'We play game together.',
    2: 'We eat out.',
    3: 'They play games.',
    4: 'We hang out.',
    5: 'They eat out.',
  },
  ee_about_me_favorites: {
    1: 'I prefer pizza',
    2: "I think it delicious.",
    3: 'They like pizza',
    4: 'We eat together',
  },
};

/** Close-miss for About Me scenario 3 (out-of-pool → Gemini close). */
export function aboutMeOutOfPoolCloseMiss(
  exact: string,
  step: number,
  lessonId: string,
): string {
  const authored = ABOUT_ME_CLOSE_BY_LESSON[lessonId]?.[step];
  if (authored) return authored;
  return foundationOutOfPoolCloseMiss(exact, step, lessonId);
}
