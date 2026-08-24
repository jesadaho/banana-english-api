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
    const board = FOUNDATION_BOARDS.greetings[3];
    const hint = resolveIncorrectHintTh(board);
    assert.match(hint ?? '', /ยังไม่ตรงครับ/);
    assert.match(hint ?? '', /Hi/);
  });

  it('recall steps reveal a sound cue only after an incorrect answer', () => {
    const board = FOUNDATION_BOARDS.numbers[2];
    assert.equal(board.stem, '');
    const hint = resolveIncorrectHintTh(board);
    assert.match(hint ?? '', /เสียง \/s\//);
    assert.doesNotMatch(hint ?? '', /seven/i);
  });

  it('introductions keeps explicit hints over auto', () => {
    const board = FOUNDATION_BOARDS.introductions[6];
    assert.match(resolveIncorrectHintTh(board) ?? '', /I live in\.\.\./);
  });

  it('recognition recovery uses the current target, not the first distractor', () => {
    const cases = [
      ['polite_expressions', 4, /Thank you/i],
      ['polite_expressions', 5, /I['’]m sorry|Sorry/i],
      ['talk_about_groups', 4, /She['’]s/i],
      ['telling_time', 4, /nine p\.m/i],
      ['money_prices', 4, /ten dollars/i],
      ['likes_dislikes', 4, /don['’]t like tea/i],
      ['can_cant', 3, /I can cook/i],
    ] as const;

    for (const [lessonId, step, target] of cases) {
      const hint = resolveIncorrectHintTh(FOUNDATION_BOARDS[lessonId][step]);
      assert.match(hint ?? '', target, `${lessonId} step ${step}`);
    }
  });

  it('repeat steps expose only their current target choice', () => {
    const cases = [
      ['polite_expressions', 3],
      ['meet_people', 2],
      ['talk_about_groups', 3],
      ['ee_about_me_family', 4],
      ['likes_dislikes', 3],
      ['wants_needs', 1],
      ['wants_needs', 3],
      ['asking_for_help', 1],
    ] as const;

    for (const [lessonId, step] of cases) {
      const board = FOUNDATION_BOARDS[lessonId][step];
      assert.ok(board.options.length <= 1, `${lessonId} step ${step}`);
      if (board.options.length === 1) {
        assert.equal(board.options[0]?.speak, board.expectedSpeech, `${lessonId} step ${step}`);
      }
    }
  });

  it('everyday_numbers keeps Arabic digits out of Thai TTS copy', () => {
    for (const board of Object.values(FOUNDATION_BOARDS.everyday_numbers)) {
      assert.match(board.ttsText ?? '', /\S/);
      assert.doesNotMatch(board.ttsText ?? '', /\d/);
      assert.doesNotMatch(board.incorrectHintTh ?? '', /\d/);
    }
  });

  it('numbers recovery hints guide without revealing the answer', () => {
    const appleHint = resolveIncorrectHintTh(FOUNDATION_BOARDS.numbers[1]) ?? '';
    assert.equal(appleHint, 'ลองนับแอปเปิลอีกครั้งครับ');
    assert.doesNotMatch(appleHint, /4|four/i);

    const twentyHint = resolveIncorrectHintTh(FOUNDATION_BOARDS.numbers[4]) ?? '';
    assert.equal(twentyHint, 'คำนี้ลงท้ายด้วยเสียง -ty ครับ');
    assert.doesNotMatch(twentyHint, /20|twenty/i);
  });

  it('numbers separates Thai number context from English target pronunciation', () => {
    for (const board of Object.values(FOUNDATION_BOARDS.numbers)) {
      assert.match(board.ttsText ?? '', /\S/);
      assert.doesNotMatch(board.ttsText ?? '', /\d/);
      assert.doesNotMatch(board.incorrectHintTh ?? '', /\d/);
    }
    assert.match(FOUNDATION_BOARDS.numbers[1].textEn, /0–20/u);
    assert.match(FOUNDATION_BOARDS.numbers[1].ttsText ?? '', /เลขศูนย์อ่านว่า zero/u);
  });

  it('adds the pronunciation instruction only to the two number lessons', () => {
    for (const lessonId of FOUNDATION_LESSON_IDS) {
      const fixture = FOUNDATION_POOLGATE_FIXTURES.find(
        (candidate) => candidate.lessonId === lessonId,
      )!;
      const board = getDef(fixture).boardForStep(1, [], 'Nana');
      if (lessonId === 'numbers' || lessonId === 'everyday_numbers') {
        assert.match(board?.ttsInstruction ?? '', /Thai number words stay Thai/);
        assert.match(board?.ttsInstruction ?? '', /Latin-script English number words stay English/);
        assert.match(board?.ttsInstruction ?? '', /Pronounce every Latin-script English word in English/);
      } else {
        assert.equal(board?.ttsInstruction, undefined, lessonId);
      }
    }
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
