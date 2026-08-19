import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';
import {
  FOUNDATION_CHOICE_LESSONS,
  getFoundationChoiceLesson,
} from './scripts/foundation.registry';

type Turn = { speaker: string; textEn?: string };

/** Step-1 pool answer per foundation lesson (happy path). */
const STEP1_POOL_ANSWERS: Record<string, string> = {
  introductions: 'My name is Nana.',
  yes_no_maybe: 'Yes, I do.',
  polite_expressions: 'Thank you very much.',
  meet_people: 'I am Nana.',
  talk_about_groups: 'He is my father.',
  ee_about_me_family: "I'm ready",
  numbers: 'three',
  telling_time: "It's six o'clock.",
  everyday_numbers: 'forty',
  money_prices: 'How much is it?',
  likes_dislikes: 'I like coffee.',
  wants_needs: 'I want water.',
  can_cant: 'I can swim.',
  asking_for_help: "I don't understand.",
  asking_questions: 'Where is the bathroom?',
};

function assertInPoolStep1(lessonId: string): void {
  const def = getFoundationChoiceLesson(lessonId);
  assert.ok(def, `missing def ${lessonId}`);
  const opening = def!.buildOpening('Nana');
  const poolAnswer = STEP1_POOL_ANSWERS[lessonId];
  assert.ok(poolAnswer, `missing step-1 answer for ${lessonId}`);

  const reply = buildChoiceLessonAfterUser(def!, {
    turns: [
      { speaker: 'ai', textEn: opening.textEn },
      { speaker: 'user', textEn: poolAnswer },
    ],
    learnerFirstName: 'Nana',
  });

  assert.equal(
    reply?.deferToAi,
    undefined,
    `${lessonId} step-1 in-pool should be scripted`,
  );
  assert.ok(reply?.textEn?.trim(), `${lessonId} should have scripted textEn`);
}

function doubleWrong(
  openingAi: string,
  wrong1: string,
  softTeach: string,
  wrong2: string,
): Turn[] {
  return [
    { speaker: 'ai', textEn: openingAi },
    { speaker: 'user', textEn: wrong1 },
    { speaker: 'ai', textEn: softTeach },
    { speaker: 'user', textEn: wrong2 },
  ];
}

describe('Foundation PoolGate v2 — in-pool step 1', () => {
  for (const def of FOUNDATION_CHOICE_LESSONS) {
    it(`${def.lessonId} — in-pool step 1 advances scripted`, () => {
      assertInPoolStep1(def.lessonId);
    });
  }
});

describe('Foundation soft-advance copy', () => {
  it('yes_no_maybe — step 1 Yes, I do.', () => {
    const def = getFoundationChoiceLesson('yes_no_maybe');
    assert.ok(def);
    const opening = def!.buildOpening('Nana');
    const history = doubleWrong(
      opening.textEn,
      'Good morning.',
      'ลองพูดตามว่า Yes, I do.',
      'Hello.',
    );
    const reply = buildChoiceLessonAfterUser(def!, {
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined, 'yes_no_maybe should soft-advance scripted');
    assert.match(reply?.textEn ?? '', /คำตอบนี้เราพูดว่า/, 'missing model line');
    assert.match(reply?.textEn ?? '', /"Yes, I do\."/, 'model phrase');
    assert.match(reply?.textEn ?? '', /ไปต่อกันเลย —/, 'missing advance lead-in');
    assert.match(reply?.textEn ?? '', /Maybe/, 'advance cue');
    assert.doesNotMatch(
      reply?.textEn ?? '',
      /ไม่เป็นไรครับ ไปต่อกัน!/,
      'should not use old prefix',
    );
  });
});
