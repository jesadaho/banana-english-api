import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChoiceLessonAfterUser,
  choiceLessonEffectiveProgress,
  isRepeatOnlyBoard,
  type ChoiceLessonHistoryTurn,
} from './scripts/choice-lesson.script';
import { resolveLessonProgressTurn } from '../lessons/lessons.data';
import {
  FOUNDATION_POOLGATE_FIXTURES,
  FOUNDATION_PROBE_LEARNER,
} from './foundation/foundation-poolgate.fixtures';
import {
  assertAdvancedFromProbe,
  assertFullHappyPathStepChain,
  assertOutOfPool,
  boardAtProbe,
  buildExactHistoryThroughProgress,
  buildHistoryAtProbe,
  buildSoftAdvanceHistory,
  getDef,
  INTRODUCTIONS_TIM_PROD_CHAT,
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolCloseMiss,
  introductionsOutOfPoolWrong,
  foundationOutOfPoolWrong,
  mockGeminiReply,
  nextBoardAfterProbeExact,
  pinChoiceLessonAiReply,
  pinGeminiAtProbe,
  replayChoiceLessonChat,
  runFoundationAllOutOfPoolGeminiAssess,
  runFoundationAllOutOfPoolGeminiCorrect,
  runFoundationAllOutOfPoolWrongThenSoftAdvance,
  runFoundationFullHappyPath,
  runWrongTwiceThenFinishFromStep,
  withProbeUser,
} from './foundation/foundation-poolgate.harness';

describe('Foundation PoolGate — 5-lane matrix (all lessons)', () => {
  for (const fixture of FOUNDATION_POOLGATE_FIXTURES) {
    const { lessonId } = fixture;

    describe(lessonId, () => {
      it('scenario 1 — happy in-pool advances scripted', () => {
        const def = getDef(fixture);
        const reply = buildChoiceLessonAfterUser(def, {
          turns: withProbeUser(fixture, fixture.exactAtProbe),
          learnerFirstName: FOUNDATION_PROBE_LEARNER,
        });
        assert.ok(reply, `${lessonId}: missing in-pool reply`);
        assert.notEqual(reply!.deferToAi, true, `${lessonId}: should not defer`);
        assert.equal(reply!.assessmentTier, 'correct');
        assertAdvancedFromProbe(fixture, reply!);
      });

      it('scenario 2 — happy out-pool (Gemini correct) advances without repeat', () => {
        const def = getDef(fixture);
        const base = buildHistoryAtProbe(fixture);
        assertOutOfPool(def, fixture, base);

        const route = buildChoiceLessonAfterUser(def, {
          turns: withProbeUser(fixture, fixture.outOfPoolAtProbe),
          learnerFirstName: FOUNDATION_PROBE_LEARNER,
        });
        assert.equal(route?.deferToAi, true, `${lessonId}: should defer to Gemini`);
        assert.equal(route?.aiMode, 'assess');

        const pinned = pinGeminiAtProbe(
          def,
          fixture,
          fixture.outOfPoolAtProbe,
          'correct',
          'ถูกต้องแล้วครับ! เก่งมากครับ',
        );
        assertAdvancedFromProbe(fixture, pinned);
        assert.equal(pinned.assessmentTier, 'correct');
      });

      it('scenario 3 — unhappy close advances without blocking', () => {
        const def = getDef(fixture);
        const base = buildHistoryAtProbe(fixture);
        assertOutOfPool(def, fixture, base);

        const pinned = pinGeminiAtProbe(
          def,
          fixture,
          fixture.outOfPoolAtProbe,
          'close',
          'เกือบเป๊ะครับ! ไปต่อกันเลย',
        );
        assertAdvancedFromProbe(fixture, pinned);
        assert.equal(pinned.assessmentTier, 'close');
      });

      it('scenario 4 — unhappy incorrect pins current step + teach copy', () => {
        const def = getDef(fixture);
        const current = boardAtProbe(fixture);
        assert.ok(current?.expectedSpeech, `${lessonId}: probe board missing`);

        const route = buildChoiceLessonAfterUser(def, {
          turns: withProbeUser(fixture, fixture.wrongAtProbe),
          learnerFirstName: FOUNDATION_PROBE_LEARNER,
        });
        assert.equal(route?.deferToAi, true);

        const pinned = pinGeminiAtProbe(
          def,
          fixture,
          fixture.wrongAtProbe,
          'incorrect',
          'ยังไม่ใช่นะครับ ลองพูดว่า',
        );
        assert.equal(pinned.expectedSpeech, current!.expectedSpeech);
        if (current!.incorrectHintTh?.trim()) {
          assert.doesNotMatch(pinned.textEn ?? '', /ลองพูดตามนะครับ/u);
        } else if (isRepeatOnlyBoard(current)) {
          assert.match(pinned.textEn ?? '', /พูดตาม/u);
        } else {
          assert.ok((pinned.textEn ?? '').trim().length > 0);
        }
        assert.equal(pinned.assessmentTier, 'incorrect');
      });

      it('scenario 5 — 2nd wrong soft-advances scripted (no Gemini)', () => {
        const def = getDef(fixture);
        const next = nextBoardAfterProbeExact(fixture);
        const turns = buildSoftAdvanceHistory(fixture);
        const reply = buildChoiceLessonAfterUser(def, {
          turns,
          learnerFirstName: FOUNDATION_PROBE_LEARNER,
        });
        assert.ok(reply, `${lessonId}: missing soft-advance reply`);
        assert.notEqual(reply!.deferToAi, true, `${lessonId}: soft-advance is scripted`);
        assert.match(reply!.textEn ?? '', /ตรงนี้พูดว่า/);
        assert.match(reply!.textEn ?? '', /ไปต่อกันเลย —/);
        assert.equal(reply!.expectedSpeech, next!.expectedSpeech);
        assert.equal(reply!.assessmentTier, 'incorrect');
      });
    });
  }
});

describe('Foundation — full happy path (all steps → complete)', () => {
  for (const fixture of FOUNDATION_POOLGATE_FIXTURES) {
    const { lessonId } = fixture;

    it(`${lessonId} — in-pool exact through step ${getDef(fixture).maxStep} completes lesson`, () => {
      const def = getDef(fixture);
      const result = runFoundationFullHappyPath(def);
      assert.equal(result.steps.length, def.maxStep);
      assert.equal(result.steps.at(-1)?.progressAfter, def.maxStep);
      assertFullHappyPathStepChain(def, result);
    });
  }

  it('introductions — hits every teaching milestone including I\'m from', () => {
    const def = getDef(
      FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === 'introductions')!,
    );
    const { steps } = runFoundationFullHappyPath(def);

    assert.match(steps[0].aiTextEn, /I'm Nana/);
    assert.match(steps[1].aiTextEn, /Nice to meet you/);
    assert.match(steps[2].aiTextEn, /Nice to meet you too/);
    assert.match(steps[3].aiTextEn, /I'm from Thailand/);
    assert.match(steps[4].aiTextEn, /I live in Bangkok/);
    assert.match(steps[5].aiTextEn, /I work as a teacher/);
    assert.match(steps[6].aiTextEn, /แนะนำตัว/);
    assert.match(steps[7].userText, /I'm from Thailand/);
    assert.equal(steps[7].isLessonComplete, true);
  });

  it('numbers — completion summarizes the full 0–20 range', () => {
    const def = getDef(
      FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === 'numbers')!,
    );
    const result = runFoundationFullHappyPath(def);

    assert.match(
      result.completionText,
      /ฝึกอ่านและใช้ตัวเลขหลายกลุ่มตั้งแต่ 0–20 แล้ว/,
    );
    assert.doesNotMatch(result.completionText, /3, 7, 8, 16 และ 20/);
  });

  it('everyday numbers — completion summarizes tens and two-digit composition', () => {
    const def = getDef(
      FOUNDATION_POOLGATE_FIXTURES.find(
        (f) => f.lessonId === 'everyday_numbers',
      )!,
    );
    const result = runFoundationFullHappyPath(def);

    assert.match(
      result.completionText,
      /อ่านเลขหลักสิบ และประกอบเลขสองหลักตั้งแต่ 20–100 ได้แล้ว/,
    );
  });
});

describe('Foundation — soft-advance recovery (wrong ×2 then finish)', () => {
  for (const fixture of FOUNDATION_POOLGATE_FIXTURES) {
    const { lessonId } = fixture;

    it(`${lessonId} — 2 wrongs at probe step then exact through completion`, () => {
      const def = getDef(fixture);
      const probeStep = def.progressFn(buildHistoryAtProbe(fixture)) + 1;
      const result = runWrongTwiceThenFinishFromStep(
        def,
        probeStep,
        fixture.wrongAtProbe,
      );
      assert.equal(result.steps.at(-1)?.progressAfter, def.maxStep);
      assert.equal(result.steps.at(-1)?.isLessonComplete, true);
    });
  }
});

describe('Foundation — introductions cross-step regression', () => {
  const introductions = FOUNDATION_POOLGATE_FIXTURES.find(
    (f) => f.lessonId === 'introductions',
  )!;

  it('step 3 — saying step-4 answer defers then soft-advances with Nice to meet you copy', () => {
    const def = getDef(introductions);
    const turns = buildExactHistoryThroughProgress(def, 2);
    const step3Board = def.boardForStep(3, turns);
    assert.equal(step3Board?.expectedSpeech, 'Nice to meet you.');

    turns.push({ speaker: 'user', textEn: 'Nice to meet you too.' });
    const first = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName: FOUNDATION_PROBE_LEARNER,
    });
    assert.equal(first?.deferToAi, true, 'cross-step 1st try defers to Gemini');

    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply(
        'incorrect',
        'ลองพูดตามนะครับ "Nice to meet you"',
      ),
      undefined,
      FOUNDATION_PROBE_LEARNER,
    );
    assert.equal(pinned.expectedSpeech, 'Nice to meet you.');
    turns.push({ speaker: 'ai', textEn: pinned.textEn ?? '' });
    turns.push({ speaker: 'user', textEn: 'Nice to meet you too.' });

    const soft = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName: FOUNDATION_PROBE_LEARNER,
    });
    assert.ok(soft);
    assert.notEqual(soft!.deferToAi, true);
    assert.match(soft!.textEn ?? '', /Nice to meet you/);
    assert.match(soft!.textEn ?? '', /ไปต่อกันเลย — ถ้าครูพูดว่า Nice to meet you/);
    assert.equal(soft!.expectedSpeech, 'Nice to meet you too.');
  });

  it('step 3 cross-step — soft-advance then exact answers finish lesson', () => {
    const def = getDef(introductions);
    const result = runWrongTwiceThenFinishFromStep(
      def,
      3,
      'Nice to meet you too.',
    );
    assert.equal(result.steps.at(-1)?.progressAfter, def.maxStep);
    assert.match(result.completionText, /เรียนครบแล้วครับ/);
    assert.equal(
      result.steps.some((s) => s.userText.includes('Nice to meet you too.')),
      true,
    );
  });
});

describe('Foundation — introductions all-step scenarios', () => {
  const introductions = FOUNDATION_POOLGATE_FIXTURES.find(
    (f) => f.lessonId === 'introductions',
  )!;

  it('scenario 2 — near-miss advances when Gemini incorrectly rejects', () => {
    const def = getDef(introductions);
    const learnerFirstName = 'Nana';
    const opening = def.buildOpening(learnerFirstName);
    const turns: ChoiceLessonHistoryTurn[] = [
      {
        speaker: 'ai',
        textEn: opening.textEn ?? '',
        expectedSpeech: opening.expectedSpeech,
      },
      {
        speaker: 'user',
        textEn: introductionsOutOfPoolNearMiss('My name is Nana.', 1),
      },
    ];

    const route = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName,
    });
    assert.equal(route?.deferToAi, true);

    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply(
        'incorrect',
        'เกือบแล้วครับ Nana! ลองพูดว่า "My name is Nana" อีกครั้งนะครับ',
      ),
      undefined,
      learnerFirstName,
    );
    assert.equal(pinned.assessmentTier, 'correct');
    assert.doesNotMatch(pinned.textEn ?? '', /ลองพูดว่า.*อีกครั้ง|พูดตาม/);
    assert.match(pinned.textEn ?? '', /Nice to meet you|I'm|My name is/i);
  });

  it('scenario 2 — out-pool correct every step completes lesson', () => {
    const def = getDef(introductions);
    const result = runFoundationAllOutOfPoolGeminiCorrect(
      def,
      introductionsOutOfPoolNearMiss,
    );
    assert.equal(result.steps.length, def.maxStep);
    assert.equal(result.steps.at(-1)?.isLessonComplete, true);
    for (const record of result.steps) {
      const praiseWords = record.aiTextEn.match(
        /ยอดเยี่ยม|ถูกต้อง|เก่งมาก|ดีมาก|เยี่ยมครับ/g,
      );
      assert.ok(
        (praiseWords?.length ?? 0) <= 1,
        `step ${record.step}: feedback must contain at most one praise sentence`,
      );
    }
  });

  it('keeps each prompt, target, hint, and choices on one unique state', () => {
    const def = getDef(introductions);
    const targets: string[] = [];

    for (let step = 1; step <= def.maxStep; step++) {
      const board = def.boardForStep(step, [], 'Nana');
      assert.ok(board, `step ${step}: board is required`);
      targets.push(board!.expectedSpeech);

      if (board!.options.length > 0) {
        assert.ok(
          board!.options.some(
            (option) => option.speak === board!.expectedSpeech,
          ),
          `step ${step}: choices must contain the current target`,
        );
      }
      if (board!.incorrectHintTh) {
        assert.match(board!.incorrectHintTh, /ยังไม่ตรงครับ/);
      }
    }

    assert.equal(
      new Set(targets).size,
      targets.length,
      'every introductions step must have an unambiguous target signature',
    );
  });

  it('scenario 3 — step 1 close advances to step 2 for I Nana close miss', () => {
    const def = getDef(introductions);
    const learnerFirstName = 'Nana';
    const opening = def.buildOpening(learnerFirstName);
    const turns: ChoiceLessonHistoryTurn[] = [
      {
        speaker: 'ai',
        textEn: opening.textEn ?? '',
        expectedSpeech: opening.expectedSpeech,
      },
      {
        speaker: 'user',
        textEn: introductionsOutOfPoolCloseMiss('My name is Nana.', 1),
      },
    ];

    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('incorrect', 'bad'),
      1,
      learnerFirstName,
    );
    turns.push({
      speaker: 'ai',
      textEn: pinned.textEn ?? '',
      expectedSpeech: pinned.expectedSpeech,
    });

    const userStep2 = introductionsOutOfPoolCloseMiss("I'm Nana.", 2);
    turns.push({ speaker: 'user', textEn: userStep2 });
    const answeredStep =
      choiceLessonEffectiveProgress(def, turns.slice(0, -1), 2) + 1;
    assert.equal(answeredStep, 2, 'progress should be on step 2 after close');
    assert.equal(def.scoreStep(2, userStep2, turns.slice(0, -1)), 'close');

    const route = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName,
      sessionProgressTurn: 2,
    });
    assert.equal(route?.deferToAi, true);
    const step2Pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('incorrect', 'bad'),
      2,
      learnerFirstName,
    );
    assert.equal(step2Pinned.assessmentTier, 'close');
  });

  it('scenario 3 — close with Gemini re-teach advances without repeat ask', () => {
    const def = getDef(introductions);
    const learnerFirstName = 'Nana';
    const opening = def.buildOpening(learnerFirstName);
    const userText = introductionsOutOfPoolCloseMiss('My name is Nana.', 1);
    const turns: ChoiceLessonHistoryTurn[] = [
      {
        speaker: 'ai',
        textEn: opening.textEn ?? '',
        expectedSpeech: opening.expectedSpeech,
      },
      { speaker: 'user', textEn: userText },
    ];

    assert.equal(def.scoreStep(1, userText, turns.slice(0, -1)), 'close');

    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply(
        'incorrect',
        'เกือบถูกแล้วครับ! ลองพูดว่า "My name is Nana" อีกครั้งนะครับ',
      ),
      undefined,
      learnerFirstName,
    );
    assert.equal(pinned.assessmentTier, 'close');
    assert.match(pinned.textEn ?? '', /^เกือบถูกแล้วครับ! พูดว่า My name is Nana\./);
    assert.doesNotMatch(pinned.textEn ?? '', /เกือบถูกแล้วครับ.*เก่งมาก/);
    assert.doesNotMatch(
      pinned.textEn ?? '',
      /ลองพูดว่า "My name is Nana" อีกครั้ง/,
    );
    assert.match(pinned.textEn ?? '', /Nice to meet you|I'm|My name is/i);
  });

  it('scenario 3 — close recasts I live in before work step', () => {
    const def = getDef(introductions);
    const learnerFirstName = 'Nana';
    const opening = def.buildOpening(learnerFirstName);
    const userText = introductionsOutOfPoolCloseMiss('I live in Bangkok.', 6);
    const turns: ChoiceLessonHistoryTurn[] = [
      {
        speaker: 'ai',
        textEn: opening.textEn ?? '',
        expectedSpeech: opening.expectedSpeech,
      },
      { speaker: 'user', textEn: userText },
    ];

    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('close', 'เกือบถูกแล้วครับ ดีมากครับ!'),
      6,
      learnerFirstName,
    );
    assert.equal(pinned.assessmentTier, 'close');
    assert.match(
      pinned.textEn ?? '',
      /เกือบถูกแล้วครับ! พูดว่า I live in Bangkok\. 🏙️/,
    );
    assert.match(pinned.textEn ?? '', /ต่อไปถ้าจะบอกงาน.*I work as a teacher/i);
    assert.doesNotMatch(pinned.textEn ?? '', /เกือบถูกแล้วครับ.*ดีมากครับ/);
  });

  it('scenario 3 — out-pool close every step completes lesson', () => {
    const def = getDef(introductions);
    const result = runFoundationAllOutOfPoolGeminiAssess(
      def,
      introductionsOutOfPoolCloseMiss,
      'close',
    );
    assert.equal(result.steps.length, def.maxStep);
    assert.equal(result.steps.at(-1)?.isLessonComplete, true);
    for (const record of result.steps) {
      assert.equal(
        def.scoreStep(record.step, record.userText, []),
        'close',
        `step ${record.step}: "${record.userText}" should score close`,
      );
    }
  });

  it('step 2 incorrect uses board incorrectHintTh', () => {
    const def = getDef(introductions);
    const turns = buildExactHistoryThroughProgress(def, 1, 'Nana');
    turns.push({ speaker: 'user', textEn: 'Good morning.' });
    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('incorrect', 'ignored gemini copy'),
      2,
      'Nana',
    );
    assert.match(pinned.textEn ?? '', /My name is/);
    assert.match(pinned.textEn ?? '', /I'm/);
    assert.doesNotMatch(pinned.textEn ?? '', /ลองพูดตามนะครับ/);
  });

  it('scenario 4 — incorrect stays on step until in-pool recovery', () => {
    const def = getDef(introductions);
    const learnerFirstName = 'Nana';
    const opening = def.buildOpening(learnerFirstName);
    const wrong = introductionsOutOfPoolWrong('My name is Nana.', 1);
    const turns: ChoiceLessonHistoryTurn[] = [
      {
        speaker: 'ai',
        textEn: opening.textEn ?? '',
        expectedSpeech: opening.expectedSpeech,
      },
      { speaker: 'user', textEn: wrong },
    ];

    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('incorrect', 'ยังไม่ใช่นะครับ ลองพูดว่า'),
      1,
      learnerFirstName,
    );
    assert.equal(pinned.assessmentTier, 'incorrect');
    assert.match(pinned.textEn ?? '', /พูดตาม/);
    assert.equal(pinned.expectedSpeech, 'My name is Nana.');

    const afterWrong = [
      ...turns,
      {
        speaker: 'ai',
        textEn: pinned.textEn ?? '',
        expectedSpeech: pinned.expectedSpeech,
      },
    ];
    assert.equal(
      choiceLessonEffectiveProgress(def, afterWrong, 1),
      0,
      'incorrect must not advance progress before recovery',
    );

    const recoveryTurns: ChoiceLessonHistoryTurn[] = [
      ...afterWrong,
      { speaker: 'user', textEn: 'My name is Nana.' },
    ];
    const recovery = buildChoiceLessonAfterUser(def, {
      turns: recoveryTurns,
      learnerFirstName,
      sessionProgressTurn: 1,
    });
    assert.notEqual(recovery?.deferToAi, true);
    assert.equal(recovery?.assessmentTier, 'correct');
    assert.ok(
      choiceLessonEffectiveProgress(def, [
        ...recoveryTurns,
        {
          speaker: 'ai',
          textEn: recovery?.textEn ?? '',
          expectedSpeech: recovery?.expectedSpeech,
        },
      ]) >= 1,
    );
  });

  it('scenario 4 — out-pool wrong every step completes lesson', () => {
    const def = getDef(introductions);
    const result = runFoundationAllOutOfPoolGeminiAssess(
      def,
      (exact) => 'Good morning.',
      'incorrect',
    );
    assert.equal(result.steps.length, def.maxStep);
    assert.equal(result.steps.at(-1)?.isLessonComplete, true);
    for (const record of result.steps) {
      assert.equal(record.userText, 'Good morning.');
    }
  });

  it('scenario 5 — out-pool wrong then wrong again soft-advances every step', () => {
    const def = getDef(introductions);
    const result = runFoundationAllOutOfPoolWrongThenSoftAdvance(def);
    assert.equal(result.steps.length, def.maxStep);
    assert.equal(result.steps.at(-1)?.isLessonComplete, true);
    for (const record of result.steps) {
      assert.equal(record.userText, 'Good morning.');
      assert.match(record.aiTextEn, /ตรงนี้พูด(ว่า|ได้ว่า)/);
      if (record.step < def.maxStep) {
        assert.match(record.aiTextEn, /ไปต่อกันเลย —/);
      } else {
        assert.match(record.aiTextEn, /เรียนครบแล้วครับ/);
        assert.doesNotMatch(record.aiTextEn, /🎉|สุดยอด|เก่งมาก/);
        assert.doesNotMatch(record.aiTextEn, /ไปต่อกันเลย —/);
      }
    }
  });
});

describe('Foundation — introductions prod chat (Tim / Tami screenshot)', () => {
  it('replays STT transcript without My-name-is-Tim soft-advance on Nice to meet you', () => {
    const def = getDef(
      FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === 'introductions')!,
    );
    const { exchanges } = replayChoiceLessonChat(
      def,
      'Tim',
      INTRODUCTIONS_TIM_PROD_CHAT,
    );

    assert.equal(exchanges.length, INTRODUCTIONS_TIM_PROD_CHAT.length);
    assert.equal(exchanges.at(-1)?.isLessonComplete, true);
    assert.match(exchanges.at(-1)?.aiTextEn ?? '', /สุดยอด/);

    assert.match(exchanges[0].aiTextEn, /แปลว่า.*ฉันชื่อ Tim/);
    assert.match(exchanges[1].aiTextEn, /Nice to meet you/);
    assert.match(exchanges[2].aiTextEn, /Nice to meet you too/);
    assert.equal(exchanges[3].assessmentTier, 'correct');
    assert.match(exchanges[3].aiTextEn, /I'm from Thailand/);
    assert.doesNotMatch(
      exchanges[2].aiTextEn,
      /ตรงนี้พูด(ว่า|ได้ว่า).*My name is Tim/i,
    );
  });
});

describe('Foundation progress — yes_no_maybe out-pool does not rewind', () => {
  const yesNo = FOUNDATION_POOLGATE_FIXTURES.find(
    (f) => f.lessonId === 'yes_no_maybe',
  )!;

  it('opening ลองพูดตาม starts progressTurn at 1', () => {
    const beat = resolveLessonProgressTurn('yes_no_maybe', 0, 8, {
      textEn:
        'สวัสดีครับ Nana! วันนี้เรามาเรียนรู้ตอบคำถาม Yes / No / Maybe กันครับ ✅ ลองพูดตามว่า Yes, I do. นะครับ',
      expectsUserSpeech: true,
      expectedSpeech: 'Yes, I do.',
      isTaskComplete: false,
    });
    assert.equal(beat, 1);
  });

  it('correct advance still increments when next teach says ลองพูดตาม', () => {
    const beat = resolveLessonProgressTurn('yes_no_maybe', 4, 8, {
      textEn:
        'ยอดเยี่ยมมากครับ Nana! เก่งมากครับ! เก่งมากครับ! ถ้ายังไม่แน่ใจ ใช้ Maybe ได้ครับ 🤔 ลองพูดตามว่า Maybe.',
      expectsUserSpeech: true,
      expectedSpeech: 'Maybe.',
      isTaskComplete: false,
      assessmentTier: 'correct',
    });
    assert.equal(beat, 5);
  });

  it('incorrect retry with ลองพูดตาม does not increment', () => {
    const beat = resolveLessonProgressTurn('yes_no_maybe', 1, 8, {
      textEn: 'ยังไม่ใช่ครับ ลองพูดตามนะครับ "Yes, I do."',
      expectsUserSpeech: true,
      expectedSpeech: 'Yes, I do.',
      isTaskComplete: false,
      assessmentTier: 'incorrect',
    });
    assert.equal(beat, 1);
  });

  it('Yeah, I do. is close on repeat and accepted on application', () => {
    const def = getDef(yesNo);
    assert.equal(def.scoreStep(1, 'Yeah, I do.', []), 'close');
    assert.equal(def.scoreStep(2, 'Yeah, I do.', []), 'near');
  });

  it('No, I dont. is close on repeat and accepted on application', () => {
    const def = getDef(yesNo);
    assert.equal(def.scoreStep(3, 'No, I dont.', []), 'close');
    assert.equal(def.scoreStep(4, 'No, I dont.', []), 'near');
  });

  it('soft-advance with a new choice board increments progressTurn', () => {
    const beat = resolveLessonProgressTurn(
      'yes_no_maybe',
      1,
      8,
      {
        textEn:
          'ตรงนี้พูดว่า "Yes, I do." ครับ ✅\nไปต่อกันเลย — Do you like pizza?',
        expectsUserSpeech: true,
        expectedSpeech: 'Yes, I do.',
        isTaskComplete: false,
        assessmentTier: 'incorrect',
        guidedSpeaking: {
          options: [
            { speak: 'Yes, I do.' },
            { speak: 'Yes.' },
          ],
        },
      },
      {
        expectedSpeech: 'Yes, I do.',
        guidedSpeaking: { options: [{ speak: 'Yes, I do.' }] },
      },
    );
    assert.equal(beat, 2);
  });

  it('keeps prompt, target, hint, and choices on the same beat without session state', () => {
    const def = getDef(yesNo);
    const learnerFirstName = 'Nana';
    const opening = def.buildOpening(learnerFirstName);
    const turns: ChoiceLessonHistoryTurn[] = [
      {
        speaker: 'ai',
        textEn: opening.textEn ?? '',
        expectedSpeech: opening.expectedSpeech,
        guidedSpeaking: opening.guidedSpeaking ?? null,
      },
    ];

    const expectedTargets = [
      'Yes, I do.',
      'Yes, I do.',
      "No, I don't.",
      "No, I don't.",
      'Maybe.',
      'Maybe.',
    ];

    for (let step = 1; step <= def.maxStep; step++) {
      const currentBoard = def.boardForStep(step, turns, learnerFirstName)!;
      assert.equal(currentBoard.expectedSpeech, expectedTargets[step - 1]);
      assert.ok(
        currentBoard.options.some(
          (option) => option.speak === currentBoard.expectedSpeech,
        ),
        `step ${step}: choices must contain the current target`,
      );
      assert.match(
        currentBoard.incorrectHintTh ?? '',
        new RegExp(
          currentBoard.expectedSpeech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i',
        ),
        `step ${step}: hint must name the current target`,
      );

      const exact =
        currentBoard.expectedSpeech;
      turns.push({
        speaker: 'user',
        textEn: introductionsOutOfPoolNearMiss(exact, step),
      });
      const pinned = pinChoiceLessonAiReply(
        def,
        turns,
        mockGeminiReply('correct', 'ยอดเยี่ยมมากครับ Nana! เก่งมากครับ'),
        undefined,
        learnerFirstName,
      );

      if (step < def.maxStep) {
        const nextBoard = def.boardForStep(step + 1, turns, learnerFirstName)!;
        assert.equal(pinned.expectedSpeech, nextBoard.expectedSpeech);
        assert.deepEqual(
          pinned.guidedSpeaking?.options,
          nextBoard.options.map((option) => ({
            emoji: option.emoji,
            label: option.label,
            speak: option.speak,
          })),
          `step ${step + 1}: choices must move with the prompt`,
        );
      }

      turns.push({
        speaker: 'ai',
        textEn: pinned.textEn ?? '',
        expectedSpeech: pinned.expectedSpeech,
        guidedSpeaking: pinned.guidedSpeaking ?? null,
      });
    }

    assert.match(turns.at(-1)?.textEn ?? '', /🎉|🍌/);
  });

  it('soft-advance into No and Maybe states gives an explicit repeat instruction', () => {
    const def = getDef(yesNo);
    const result = runFoundationAllOutOfPoolWrongThenSoftAdvance(
      def,
      (exact, step) => foundationOutOfPoolWrong(exact, step, 'yes_no_maybe'),
    );

    const intoNo = result.steps.find((record) => record.step === 2);
    assert.match(
      intoNo?.aiTextEn ?? '',
      /ลองพูดตามว่า.*No, I don't/u,
    );

    const intoMaybe = result.steps.find((record) => record.step === 4);
    assert.match(intoMaybe?.aiTextEn ?? '', /ลองพูดตามว่า.*Maybe/u);
  });
});

describe('Foundation — greetings scenario 5', () => {
  it('wrong then wrong-again soft-advances every step to completion', () => {
    const def = getDef(
      FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === 'greetings')!,
    );
    const result = runFoundationAllOutOfPoolWrongThenSoftAdvance(
      def,
      (exact, step) => foundationOutOfPoolWrong(exact, step, 'greetings'),
    );
    assert.equal(result.steps.length, def.maxStep);
    assert.equal(result.steps.at(-1)?.isLessonComplete, true);
  });
});
