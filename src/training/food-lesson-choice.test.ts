import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFoodLessonChoice,
  foodBoardForStep,
} from '../lessons/lessons.data';
import {
  buildChoiceLessonAfterUser,
  ensureIncorrectAssessCopy,
  pinChoiceLessonAiReply,
} from './scripts/choice-lesson.script';
import { ABOUT_ME_FOOD } from './scripts/about-me.registry';

type Turn = { speaker: string; textEn?: string };

describe('food lesson choice mapping', () => {
  it('maps I like burger to free-form choice', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'What food do you like?' },
      { speaker: 'user', textEn: 'I like burger.' },
    ];
    const choice = extractFoodLessonChoice(history);
    assert.equal(choice.spoken, 'burger');
    assert.equal(choice.display, 'Burger');
    assert.equal(choice.boardId, null);
  });

  it('maps I like noodles to free-form choice', () => {
    const history: Turn[] = [{ speaker: 'user', textEn: 'I like noodles' }];
    const choice = extractFoodLessonChoice(history);
    assert.equal(choice.spoken, 'noodles');
    assert.equal(choice.boardId, null);
  });

  it('keeps pizza/sushi/somtam board branches', () => {
    assert.deepEqual(extractFoodLessonChoice([{ speaker: 'user', textEn: 'I like sushi.' }]), {
      spoken: 'sushi',
      display: 'Sushi',
      boardId: 'sushi',
    });
  });

  it('builds describe board for learner food', () => {
    const history: Turn[] = [{ speaker: 'user', textEn: 'I like burger.' }];
    const board = foodBoardForStep(2, history);
    assert.match(board?.textEn ?? '', /Burger/i);
    assert.match(board?.textEn ?? '', /What is burger like/i);
    assert.equal(board?.expectedSpeech, 'Burger is delicious.');
    assert.ok(board?.options.some((o) => o.speak === 'Burger is delicious.'));
  });

  it('builds drink board with learner food', () => {
    const history: Turn[] = [{ speaker: 'user', textEn: 'I like noodles.' }];
    const board = foodBoardForStep(3, history);
    assert.match(board?.textEn ?? '', /noodles/i);
    assert.equal(board?.expectedSpeech, 'I drink iced tea with noodles.');
  });

  it('AI correct advance pins burger describe board', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'What food do you like?' },
      { speaker: 'user', textEn: 'I like burger.' },
    ];
    const pinned = pinChoiceLessonAiReply(ABOUT_ME_FOOD, history, {
      textEn: 'ได้เลยครับ!',
      textTh: 'Nice!',
      isLessonComplete: false,
      expectsUserSpeech: true,
      assessmentTier: 'correct',
    });
    assert.match(pinned.textEn ?? '', /Burger/i);
    assert.match(pinned.expectedSpeech ?? '', /Burger is delicious/i);
  });
});

describe('food v2 exact match on free-form I like', () => {
  it('I like burger exact-matches dynamic expectedSpeech and advances scripted', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'What food do you like?' },
      { speaker: 'user', textEn: 'I like burger.' },
    ];
    const reply = buildChoiceLessonAfterUser(ABOUT_ME_FOOD, {
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined);
    assert.match(reply?.textEn ?? '', /Burger/i);
    assert.match(reply?.expectedSpeech ?? '', /Burger is delicious/i);
  });
});

describe('food incorrect assess copy', () => {
  it('keeps guided-board Gemini copy without forced repeat append', () => {
    const board = foodBoardForStep(1, []);
    const geminiCopy =
      'ยังไม่ใช่เรื่องของกินนะครับ เพื่อนลองพูดว่า "I like pizza" หรือบอกเมนูโปรดของคุณมาได้เลยครับ';
    const patched = ensureIncorrectAssessCopy(
      {
        textEn: geminiCopy,
        textTh: '',
        isLessonComplete: false,
        expectsUserSpeech: true,
        assessmentTier: 'incorrect',
      },
      board,
    );
    assert.equal(patched.textEn, geminiCopy);
  });
});

describe('food soft-advance message', () => {
  it('2nd wrong models I like pizza and asks What is pizza like?', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'What food do you like?' },
      { speaker: 'user', textEn: 'I work at an office.' },
      { speaker: 'ai', textEn: 'ลองพูดตามว่า I like pizza.' },
      { speaker: 'user', textEn: 'Good morning.' },
    ];
    const reply = buildChoiceLessonAfterUser(ABOUT_ME_FOOD, {
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined);
    assert.match(reply?.textEn ?? '', /ตรงนี้ใช้โครง "I like\.\.\."/);
    assert.match(reply?.textEn ?? '', /ไปต่อกันเลย — Pizza! ของโปรดเลยครับ/);
    assert.doesNotMatch(reply?.textEn ?? '', /ไม่เป็นไรครับ ไปต่อกัน! Pizza!/);
    assert.match(reply?.expectedSpeech ?? '', /Pizza is delicious/i);
  });
});
