import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDATION_BOARDS } from './foundation/foundation-boards';
import { FOUNDATION_LESSON_IDS, personalizeBoard } from './foundation/foundation.helpers';
import {
  buildHistoryAtProbe,
  getDef,
} from './foundation/foundation-poolgate.harness';
import { FOUNDATION_POOLGATE_FIXTURES } from './foundation/foundation-poolgate.fixtures';
import {
  isFoundationRepeatOnlyBoard,
  resolveIncorrectHintTh,
} from './foundation/foundation-incorrect-hints';

describe('Foundation incorrect hints — Introductions standard', () => {
  it('repeat-only steps have no auto hint', () => {
    const board = FOUNDATION_BOARDS.introductions[3];
    assert.equal(isFoundationRepeatOnlyBoard(board), true);
    assert.equal(resolveIncorrectHintTh(board), undefined);
  });

  it('guided multi-option steps get ยังไม่ตรง hint', () => {
    const board = FOUNDATION_BOARDS.meet_people[2];
    const hint = resolveIncorrectHintTh(board);
    assert.match(hint ?? '', /ยังไม่ตรงครับ/);
    assert.match(hint ?? '', /I am a student|I am a worker/);
  });

  it('stem-guided steps get pattern hint', () => {
    const board = FOUNDATION_BOARDS.numbers[3];
    const hint = resolveIncorrectHintTh(board);
    assert.match(hint ?? '', /seven/);
  });

  it('introductions keeps explicit hints over auto', () => {
    const board = FOUNDATION_BOARDS.introductions[6];
    assert.match(resolveIncorrectHintTh(board) ?? '', /I live in\.\.\./);
  });

  it('every foundation probe board follows repeat-only vs guided hint rule', () => {
    for (const fixture of FOUNDATION_POOLGATE_FIXTURES) {
      const def = getDef(fixture);
      const history = buildHistoryAtProbe(fixture);
      const step = def.progressFn(history) + 1;
      const raw = FOUNDATION_BOARDS[fixture.lessonId][step];
      assert.ok(raw, `${fixture.lessonId}: probe board step ${step}`);
      const personalized = personalizeBoard(raw, 'Nana');
      if (isFoundationRepeatOnlyBoard(raw)) {
        assert.equal(
          personalized.incorrectHintTh,
          undefined,
          `${fixture.lessonId}: repeat-only probe`,
        );
      } else {
        assert.match(
          personalized.incorrectHintTh ?? '',
          /ยังไม่ตรงครับ/,
          `${fixture.lessonId}: guided probe`,
        );
      }
    }
  });

  it('all foundation lesson ids have boards', () => {
    for (const lessonId of FOUNDATION_LESSON_IDS) {
      assert.ok(FOUNDATION_BOARDS[lessonId]);
      const def = getDef(
        FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === lessonId)!,
      );
      for (let step = 1; step <= def.maxStep; step++) {
        assert.ok(
          FOUNDATION_BOARDS[lessonId][step],
          `${lessonId} step ${step}`,
        );
      }
    }
  });
});
