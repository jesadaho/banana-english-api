import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChoiceLessonAfterUser,
  type ChoiceLessonHistoryTurn,
} from './scripts/choice-lesson.script';
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
  mockGeminiReply,
  nextBoardAfterProbeExact,
  pinChoiceLessonAiReply,
  pinGeminiAtProbe,
  replayChoiceLessonChat,
  runFoundationAllOutOfPoolGeminiAssess,
  runFoundationAllOutOfPoolGeminiCorrect,
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

      it('scenario 4 — unhappy incorrect pins current step + พูดตาม', () => {
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
        assert.match(pinned.textEn ?? '', /พูดตาม/);
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
        assert.match(reply!.textEn ?? '', /คำตอบนี้เราพูดว่า/);
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
    assert.match(soft!.textEn ?? '', /ไปต่อกันเลย — Nice to meet you too/);
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
    assert.match(result.completionText, /สุดยอด/);
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
  });

  it('scenario 3 — close with Gemini re-teach advances without repeat ask', () => {
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

    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply(
        'close',
        'เกือบถูกแล้วครับ! ลองพูดว่า "My name is Nana" อีกครั้งนะครับ',
      ),
      undefined,
      learnerFirstName,
    );
    assert.equal(pinned.assessmentTier, 'close');
    assert.doesNotMatch(
      pinned.textEn ?? '',
      /ลองพูดว่า "My name is Nana" อีกครั้ง/,
    );
    assert.match(pinned.textEn ?? '', /Nice to meet you|I'm|My name is/i);
  });

  it('scenario 3 — out-pool close every step completes lesson', () => {
    const def = getDef(introductions);
    const result = runFoundationAllOutOfPoolGeminiAssess(
      def,
      introductionsOutOfPoolNearMiss,
      'close',
    );
    assert.equal(result.steps.length, def.maxStep);
    assert.equal(result.steps.at(-1)?.isLessonComplete, true);
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
      /คำตอบนี้เราพูดว่า.*My name is Tim/i,
    );
  });
});
