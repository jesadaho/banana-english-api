import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLesson,
  resolveLessonProgressTurn,
} from '../lessons/lessons.data';

const COFFEE = 'ee_around_town_coffee';
const AROUND_TOWN_IDS = [
  'ee_around_town_shopping',
  'ee_around_town_restaurant',
  'ee_around_town_coffee',
  'ee_around_town_convenience',
  'ee_around_town_transport',
  'ee_around_town_smart_shopper',
  'ee_around_town_hotel',
  'ee_around_town_airport',
  'ee_around_town_pharmacy',
  'ee_around_town_survival',
  'ee_around_town_review',
] as const;

describe('Around Town teaching progress bar', () => {
  it('every lesson has progressMax below the session maxTurns ceiling', () => {
    for (const id of AROUND_TOWN_IDS) {
      const lesson = getLesson(id);
      assert.ok(lesson, id);
      assert.ok(
        lesson!.progressMax != null && lesson!.progressMax > 0,
        `${id} missing progressMax`,
      );
      assert.ok(
        lesson!.progressMax! < lesson!.maxTurns,
        `${id} progressMax ${lesson!.progressMax} >= maxTurns ${lesson!.maxTurns}`,
      );
    }
  });

  it('coffee opening starts at 1/6, not 1/24', () => {
    const max = getLesson(COFFEE)!.progressMax!;
    assert.equal(max, 6);
    const beat = resolveLessonProgressTurn(COFFEE, 0, max, {
      textEn: 'กาแฟ ในภาษาอังกฤษเรียกว่าอะไรนะครับ?',
      expectsUserSpeech: true,
      expectedSpeech: 'coffee',
      isTaskComplete: false,
    });
    assert.equal(beat, 1);
  });

  it('coffee correct advance increments; retry does not', () => {
    const max = 6;
    const next = resolveLessonProgressTurn(COFFEE, 1, max, {
      textEn: 'เยี่ยมเลยครับ! "ชา" ล่ะครับ?',
      expectsUserSpeech: true,
      expectedSpeech: 'tea',
      isTaskComplete: false,
      assessmentTier: 'correct',
    });
    assert.equal(next, 2);

    const retry = resolveLessonProgressTurn(COFFEE, 1, max, {
      textEn: 'ยังไม่ตรงครับ ลองพูดตามนะครับ coffee',
      expectsUserSpeech: true,
      expectedSpeech: 'coffee',
      isTaskComplete: false,
      assessmentTier: 'incorrect',
    });
    assert.equal(retry, 1);
  });

  it('coffee Start Roleplay intro is 5/6, not still 4/24', () => {
    const beat = resolveLessonProgressTurn(COFFEE, 4, 6, {
      textEn:
        'เยี่ยมเลยครับ! 👏\n\nต่อไปครูพี่บีจะเป็นบาริสต้านะครับ ☕\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      expectsUserSpeech: false,
      isTaskComplete: false,
      roleplayIntro: { npcName: 'Barista' },
    });
    assert.equal(beat, 5);
  });

  it('coffee barista ask does not keep filling the teaching bar', () => {
    const beat = resolveLessonProgressTurn(COFFEE, 5, 6, {
      textEn: 'What can I get for you?',
      expectsUserSpeech: true,
      expectedSpeech: 'Can I get a coffee?',
      isTaskComplete: false,
      roleplayNpc: { name: 'Barista' },
      assessmentTier: 'correct',
    });
    assert.equal(beat, 5);
  });

  it('coffee celebrate fills the bar', () => {
    const beat = resolveLessonProgressTurn(COFFEE, 5, 6, {
      textEn: 'เยี่ยมเลยครับ Nana!',
      expectsUserSpeech: false,
      isTaskComplete: true,
    });
    assert.equal(beat, 6);
  });
});
