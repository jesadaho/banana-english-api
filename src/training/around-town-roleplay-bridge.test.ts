import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TAP_TO_CONTINUE_SENTINEL } from '../common/api.types';
import { roleplayAfterTeaching } from './around-town/around-town.lessons';
import { AROUND_TOWN_COFFEE } from './scripts/around-town.registry';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';

const COFFEE_INTRO = {
  subtitle: 'คุณกำลังคุยกับบาริสต้า',
  npcEmoji: '🧔',
  npcLabel: 'บาริสต้า',
  npcName: 'Barista',
  userLabel: 'คุณ',
};

function coffeeTeachingTurns() {
  return [
    { speaker: 'ai', textEn: 'กาแฟ ในภาษาอังกฤษเรียกว่าอะไรนะครับ?' },
    { speaker: 'user', textEn: 'coffee' },
    { speaker: 'ai', textEn: 'เยี่ยมเลยครับ! "ชา" ล่ะครับ?' },
    { speaker: 'user', textEn: 'tea' },
    {
      speaker: 'ai',
      textEn: 'เยี่ยมเลยครับ! ถ้าจะสั่งกาแฟ ให้พูดว่า Can I get a coffee?',
    },
    { speaker: 'user', textEn: 'Can I get tea.' },
    { speaker: 'ai', textEn: 'เยี่ยมเลยครับ! แล้วลองสั่งเค้กดูครับ 😊' },
    { speaker: 'user', textEn: 'Can I get cake.' },
  ];
}

describe('Around Town roleplay after teaching', () => {
  it('coffee — first time after cake is the purple Start Roleplay card', () => {
    const reply = buildChoiceLessonAfterUser(AROUND_TOWN_COFFEE, {
      turns: coffeeTeachingTurns(),
      learnerFirstName: 'Nana',
    });
    assert.ok(reply?.roleplayIntro);
    assert.match(reply?.textEn ?? '', /พร้อมแล้วแตะเริ่ม Roleplay/);
    assert.equal(reply?.roleplayNpc, undefined);
    assert.equal(reply?.expectsUserSpeech, false);
  });

  it('coffee — tap Start Roleplay opens the barista ask, not the intro again', () => {
    const turns = [
      ...coffeeTeachingTurns(),
      {
        speaker: 'ai',
        textEn:
          'เยี่ยมเลยครับ! 👏\n\nต่อไปครูพี่บีจะเป็นบาริสต้านะครับ ☕\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
        roleplayIntro: COFFEE_INTRO,
      },
      { speaker: 'user', textEn: TAP_TO_CONTINUE_SENTINEL },
    ];
    const reply = buildChoiceLessonAfterUser(AROUND_TOWN_COFFEE, {
      turns,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined);
    assert.equal(reply?.roleplayIntro, undefined);
    assert.equal(reply?.roleplayNpc?.name, 'Barista');
    assert.equal(reply?.textEn, 'What can I get for you?');
    assert.equal(reply?.expectsUserSpeech, true);
  });

  it('coffee — Start Roleplay still opens barista when intro field is missing', () => {
    const turns = [
      ...coffeeTeachingTurns(),
      {
        speaker: 'ai',
        textEn:
          'ถูกต้องครับ! ต่อไปครูพี่บีจะเป็นบาริสต้านะครับ ☕\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      },
      { speaker: 'user', textEn: TAP_TO_CONTINUE_SENTINEL },
    ];
    const reply = buildChoiceLessonAfterUser(AROUND_TOWN_COFFEE, {
      turns,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined);
    assert.equal(reply?.roleplayNpc?.name, 'Barista');
    assert.equal(reply?.textEn, 'What can I get for you?');
  });

  it('coffee — ordering coffee advances to What type of coffee?', () => {
    const turns = [
      ...coffeeTeachingTurns(),
      {
        speaker: 'ai',
        textEn:
          'เยี่ยมเลยครับ! 👏\n\nต่อไปครูพี่บีจะเป็นบาริสต้านะครับ ☕\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      },
      { speaker: 'user', textEn: TAP_TO_CONTINUE_SENTINEL },
      { speaker: 'ai', textEn: 'What can I get for you?' },
      { speaker: 'user', textEn: 'Can I get a coffee?' },
    ];
    const reply = buildChoiceLessonAfterUser(AROUND_TOWN_COFFEE, {
      turns,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined);
    assert.equal(reply?.textEn, 'What type of coffee?');
    assert.equal(reply?.roleplayNpc?.name, 'Barista');
    assert.ok(reply?.emojiChoice?.options?.length);
  });

  it('coffee — mid-roleplay advances instead of rebuilding the intro', () => {
    const after = roleplayAfterTeaching('ee_around_town_coffee', [
      {
        speaker: 'ai',
        textEn: 'พร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
        roleplayIntro: COFFEE_INTRO,
      },
      {
        speaker: 'ai',
        textEn: 'What can I get for you?',
        roleplayNpc: { emoji: '🧔', name: 'Barista' },
      },
      { speaker: 'user', textEn: 'Can I get a coffee?' },
    ]);
    assert.equal(after?.textEn, 'What type of coffee?');
    assert.equal(after?.roleplayNpc?.name, 'Barista');
  });
});
