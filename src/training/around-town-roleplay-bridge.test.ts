import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TAP_TO_CONTINUE_SENTINEL } from '../common/api.types';
import { nextAroundTownRoleplayTurn } from '../lessons/lessons.data';
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

describe('all roleplay lessons advance past the first staff ask', () => {
  const cases: Array<{
    lessonId: string;
    intro: string;
    firstAsk: string;
    user: string;
    nextAsk: string | RegExp;
  }> = [
    {
      lessonId: 'ee_around_town_shopping',
      intro: 'ต่อไปครูพี่บีจะเป็นพนักงานร้านเสื้อผ้านะครับ 😊\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      firstAsk: 'Can I help you?',
      user: "I'm looking for a shirt.",
      nextAsk: 'What size?',
    },
    {
      lessonId: 'ee_around_town_restaurant',
      intro: 'ต่อไปครูพี่บีจะเป็นพนักงานร้านอาหารนะครับ 😊\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      firstAsk: 'Are you ready to order?',
      user: "I'd like chicken.",
      nextAsk: 'Anything to drink?',
    },
    {
      lessonId: 'ee_around_town_coffee',
      intro: 'ต่อไปครูพี่บีจะเป็นบาริสต้านะครับ ☕\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      firstAsk: 'What can I get for you?',
      user: 'Can I get a coffee?',
      nextAsk: 'What type of coffee?',
    },
    {
      lessonId: 'ee_around_town_airport',
      intro: 'ต่อไปครูพี่บีจะเป็นพนักงานเช็กอินนะครับ 😊\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      firstAsk: 'How can I help you?',
      user: "I'd like to check in.",
      nextAsk: 'May I see your passport?',
    },
    {
      lessonId: 'ee_around_town_pharmacy',
      intro: 'ต่อไปครูพี่บีจะเป็นเภสัชกรนะครับ 😊\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      firstAsk: 'How can I help you?',
      user: 'Can you help me?',
      nextAsk: "What's wrong?",
    },
    {
      lessonId: 'ee_around_town_transport',
      intro: 'คราวนี้ลองคุยกับพนักงานขายตั๋วกันครับ 😊\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      firstAsk: 'Hello, Where are you going?',
      user: "I'm going to Chiang Mai.",
      nextAsk: 'How are you traveling?',
    },
    {
      lessonId: 'ee_around_town_convenience',
      intro: 'พร้อม Roleplay แล้วใช่ไหมครับ? 😊\n\nคุณเจอคนท้องถิ่นแล้ว... ไปลองถามทางกันเลยครับ!',
      firstAsk: 'Yes?',
      user: 'Excuse me. Where is the bathroom?',
      nextAsk: /go straight|over there|turn left/i,
    },
    {
      lessonId: 'ee_about_me_favorites',
      intro: 'คราวนี้ลองคุยเรื่องหนังกันเล่นๆ นะครับ 😊\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      firstAsk: 'Which movie do you prefer?',
      user: 'I prefer action movies.',
      nextAsk: 'Why?',
    },
    {
      lessonId: 'ee_stories_last_night',
      intro: 'คราวนี้ลองย้อนกลับไปเมื่อคืน แล้วเล่าให้เพื่อนฟังว่าเกิดอะไรขึ้นกันครับ!\n\nพร้อมแล้วแตะเริ่ม Roleplay ได้เลย!',
      firstAsk: 'What were you doing last night?',
      user: 'I was watching TV.',
      nextAsk: 'What was your friend doing?',
    },
  ];

  for (const spec of cases) {
    it(`${spec.lessonId} — continue after intro opens first staff ask`, () => {
      const first = nextAroundTownRoleplayTurn(spec.lessonId, 'thai', [
        { speaker: 'ai', textEn: spec.intro },
        { speaker: 'user', textEn: TAP_TO_CONTINUE_SENTINEL },
      ]);
      assert.equal(first?.deferToAi, undefined);
      assert.match(first?.textEn ?? '', new RegExp(spec.firstAsk.replace(/[?]/g, '\\?')));
      assert.notEqual(first?.textEn, spec.intro);
    });

    it(`${spec.lessonId} — first answer advances (does not loop the same ask)`, () => {
      const next = nextAroundTownRoleplayTurn(spec.lessonId, 'thai', [
        { speaker: 'ai', textEn: spec.intro },
        { speaker: 'user', textEn: TAP_TO_CONTINUE_SENTINEL },
        { speaker: 'ai', textEn: spec.firstAsk },
        { speaker: 'user', textEn: spec.user },
      ]);
      assert.ok(next, `${spec.lessonId} should keep roleplay going`);
      if (typeof spec.nextAsk === 'string') {
        assert.equal(next?.textEn, spec.nextAsk);
      } else {
        assert.match(next?.textEn ?? '', spec.nextAsk);
      }
      assert.notEqual(next?.textEn, spec.firstAsk);
    });
  }
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
