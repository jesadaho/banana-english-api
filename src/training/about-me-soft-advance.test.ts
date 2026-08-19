import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';
import {
  ABOUT_ME_CHOICE_LESSONS,
  ABOUT_ME_DAILY_ROUTINE,
  ABOUT_ME_FOOD,
  ABOUT_ME_FRIENDS,
  ABOUT_ME_HOBBIES,
  ABOUT_ME_HOME,
  ABOUT_ME_PEOPLE,
  ABOUT_ME_PETS,
  ABOUT_ME_WEATHER,
  ABOUT_ME_WORK_SCHOOL,
  ABOUT_ME_FAVORITES,
} from './scripts/about-me.registry';

type Turn = { speaker: string; textEn?: string };

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

function assertSoftAdvance(
  history: Turn[],
  lessonId: string,
  modelPattern: RegExp,
  advancePattern: RegExp,
): void {
  const def = ABOUT_ME_CHOICE_LESSONS.find((d) => d.lessonId === lessonId);
  assert.ok(def, `missing def ${lessonId}`);
  const reply = buildChoiceLessonAfterUser(def!, {
    turns: history,
    learnerFirstName: 'Nana',
  });
  assert.equal(reply?.deferToAi, undefined, `${lessonId} should soft-advance scripted`);
  assert.match(reply?.textEn ?? '', /คำตอบนี้เราพูดว่า/, `${lessonId} missing model line`);
  assert.match(reply?.textEn ?? '', modelPattern, `${lessonId} model phrase`);
  assert.match(reply?.textEn ?? '', /ไปต่อกันเลย —/, `${lessonId} missing advance lead-in`);
  assert.match(reply?.textEn ?? '', advancePattern, `${lessonId} advance cue`);
  assert.doesNotMatch(
    reply?.textEn ?? '',
    /ไม่เป็นไรครับ ไปต่อกัน!/,
    `${lessonId} should not use old prefix`,
  );
}

describe('About Me soft-advance copy (all 10 lessons)', () => {
  it('daily routine — step 2 wake up', () => {
    assertSoftAdvance(
      [
        { speaker: 'ai', textEn: "Say I'm ready" },
        { speaker: 'user', textEn: "I'm ready" },
        {
          speaker: 'ai',
          textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
        },
        { speaker: 'user', textEn: 'go to work' },
        { speaker: 'ai', textEn: 'ลองพูดตามนะครับ wake up' },
        { speaker: 'user', textEn: 'go to sleep' },
      ],
      ABOUT_ME_DAILY_ROUTINE.lessonId,
      /"wake up"/,
      /What time do you wake up\?/,
    );
  });

  it('food — step 1 favorite food', () => {
    assertSoftAdvance(
      doubleWrong(
        'What food do you like?',
        'I work at an office.',
        'ลองพูดตามว่า I like pizza.',
        'Good morning.',
      ),
      ABOUT_ME_FOOD.lessonId,
      /"I like pizza\."/,
      /What is pizza like\?/,
    );
  });

  it('home — step 1 place type', () => {
    assertSoftAdvance(
      doubleWrong(
        'What kind of place do you live in?',
        'I like pizza.',
        'ลองพูดตาม I live in an apartment.',
        'Good morning.',
      ),
      ABOUT_ME_HOME.lessonId,
      /"I live in an apartment\."/,
      /Who do you live with\?/,
    );
  });

  it('work & school — step 1 activity', () => {
    assertSoftAdvance(
      doubleWrong(
        'Do you work or study?',
        'Good morning.',
        'ลองพูดตาม I work.',
        'Hello.',
      ),
      ABOUT_ME_WORK_SCHOOL.lessonId,
      /"I work\."/,
      /Where do you work\?/,
    );
  });

  it('hobbies — step 1 activity', () => {
    assertSoftAdvance(
      doubleWrong(
        'What do you like to do in your free time?',
        'Good morning.',
        'ลองพูดตาม I watch movies.',
        'Hello.',
      ),
      ABOUT_ME_HOBBIES.lessonId,
      /"I watch movies\."/,
      /How often do you watch movies\?/,
    );
  });

  it('pets — step 1 pet choice', () => {
    assertSoftAdvance(
      doubleWrong(
        'Do you have any pets?',
        'I like pizza.',
        'ลองพูดตาม I have a dog.',
        'Good morning.',
      ),
      ABOUT_ME_PETS.lessonId,
      /"I have a dog\."/,
      /What is your dog like\?/,
    );
  });

  it('people — step 1 family member', () => {
    assertSoftAdvance(
      doubleWrong(
        'Who would you like to talk about?',
        'I have a dog.',
        'ลองพูดตาม My brother.',
        'Good morning.',
      ),
      ABOUT_ME_PEOPLE.lessonId,
      /"My brother\."/,
      /What does he do\?/,
    );
  });

  it('weather — step 1 hot', () => {
    assertSoftAdvance(
      doubleWrong(
        "วันนี้อากาศร้อนมากเลยครับ! ถ้าจะพูดว่า 'อากาศร้อน' ภาษาอังกฤษใช้คำว่าอะไรครับ?",
        'I like pizza.',
        'ลองพูดตาม Hot.',
        'Good morning.',
      ),
      ABOUT_ME_WEATHER.lessonId,
      /"Hot\."/,
      /How do you say the weather is very cold today\?/,
    );
  });

  it('friends — step 1 activity together', () => {
    assertSoftAdvance(
      doubleWrong(
        'วันหยุด คุณกับเพื่อนชอบทำอะไรกันครับ?',
        'I work.',
        'ลองพูดตาม We play games together.',
        'Good morning.',
      ),
      ABOUT_ME_FRIENDS.lessonId,
      /"We play games together\."/,
      /How do you say we eat out together\?/,
    );
  });

  it('favorites — step 1 prefer food', () => {
    assertSoftAdvance(
      doubleWrong(
        'Which food do you prefer?',
        'I work.',
        'ลองพูดตาม I prefer pizza.',
        'Good morning.',
      ),
      ABOUT_ME_FAVORITES.lessonId,
      /"I prefer pizza\."/,
      /Why do you like it\?/,
    );
  });
});
