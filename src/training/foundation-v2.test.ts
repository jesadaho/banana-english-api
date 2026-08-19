import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';
import {
  FOUNDATION_CHOICE_LESSONS,
  getFoundationChoiceLesson,
} from './scripts/foundation.registry';
import { FOUNDATION_BOARDS } from './foundation/foundation-boards';

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
  assert.equal(reply?.assessmentTier, 'correct', `${lessonId} in-pool tier`);
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
    assert.equal(reply?.assessmentTier, 'incorrect', 'soft-advance tier');
  });
});

describe('Introductions — explain before speak', () => {
  it('teaching boards explain meaning before ลองพูดตาม', () => {
    const boards = FOUNDATION_BOARDS.introductions;
    for (const step of [1, 2, 4, 5, 6, 7, 8] as const) {
      const text = boards[step].textEn;
      const speakIdx = text.indexOf('ลองพูดตาม');
      assert.ok(speakIdx >= 0, `step ${step} missing speak cue`);
      const beforeSpeak = text.slice(0, speakIdx);
      assert.match(
        beforeSpeak,
        /แปลว่า|คือ/,
        `step ${step} should explain before asking to speak`,
      );
    }
  });

  it('step 3 explains My name is vs I\'m then asks recognition', () => {
    const text = FOUNDATION_BOARDS.introductions[3].textEn;
    assert.match(text, /My name is/);
    assert.match(text, /I'm/);
    assert.match(text, /ทางการ|เป็นทางการ/);
    assert.match(text, /\?/);
  });

  it('happy path boards explain or ask before next speak turn', () => {
    const def = getFoundationChoiceLesson('introductions');
    assert.ok(def);

    const answers = [
      'My name is Nana.',
      "I'm Nana.",
      'My name is Nana.',
      'Nice to meet you.',
      'Nice to meet you too.',
      "I'm from Thailand.",
      'I live in Bangkok.',
      'I work as a teacher.',
      "My name is Nana. I'm from Thailand.",
    ];

    const opening = def!.buildOpening('Nana');
    assert.match(opening.textEn, /แปลว่า/);

    const turns: Turn[] = [{ speaker: 'ai', textEn: opening.textEn }];
    for (let i = 0; i < answers.length; i++) {
      turns.push({ speaker: 'user', textEn: answers[i] });
      const reply = buildChoiceLessonAfterUser(def!, {
        turns,
        learnerFirstName: 'Nana',
      });
      assert.ok(reply, `missing reply after step ${i + 1}`);
      assert.notEqual(
        reply!.deferToAi,
        true,
        `step ${i + 1} should stay in-pool scripted`,
      );
      if (reply!.isLessonComplete) {
        assert.match(reply!.textEn, /สุดยอด/);
        break;
      }
      assert.match(
        reply!.textEn,
        /แปลว่า|คือ|\?/,
        `board after step ${i + 1} should explain or ask`,
      );
      turns.push({ speaker: 'ai', textEn: reply!.textEn });
    }
  });
});
