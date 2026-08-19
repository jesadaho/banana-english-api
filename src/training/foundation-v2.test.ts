import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';
import {
  FOUNDATION_POOLGATE_FIXTURES,
  FOUNDATION_PROBE_LEARNER,
} from './foundation/foundation-poolgate.fixtures';
import {
  assertAdvancedFromProbe,
  assertOutOfPool,
  boardAtProbe,
  buildHistoryAtProbe,
  buildSoftAdvanceHistory,
  getDef,
  nextBoardAfterProbeExact,
  pinGeminiAtProbe,
  withProbeUser,
} from './foundation/foundation-poolgate.harness';

describe('Foundation PoolGate — 5-lane matrix (all lessons)', () => {
  for (const fixture of FOUNDATION_POOLGATE_FIXTURES) {
    const { lessonId } = fixture;

    describe(lessonId, () => {
      it('lane 1 — happy in-pool advances scripted', () => {
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

      it('lane 2 — happy out-pool (Gemini correct) advances without repeat', () => {
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

      it('lane 3 — unhappy close advances without blocking', () => {
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

      it('lane 4 — unhappy incorrect pins current step + พูดตาม', () => {
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

      it('lane 5 — 2nd wrong soft-advances scripted (no Gemini)', () => {
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
