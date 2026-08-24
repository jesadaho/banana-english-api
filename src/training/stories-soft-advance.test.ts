import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';
import {
  STORIES_BAD_DAY,
  STORIES_BIRTHDAY,
  STORIES_CHOICE_LESSONS,
  STORIES_FAVORITE,
  STORIES_FIRST_TIME,
  STORIES_FUNNY,
  STORIES_LAST_NIGHT,
  STORIES_LAST_WEEKEND,
  STORIES_SCHOOL,
  STORIES_VACATION,
  STORIES_YESTERDAY,
} from './scripts/stories.registry';

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
  const def = STORIES_CHOICE_LESSONS.find((d) => d.lessonId === lessonId);
  assert.ok(def, `missing def ${lessonId}`);
  const reply = buildChoiceLessonAfterUser(def!, {
    turns: history,
    learnerFirstName: 'Nana',
  });
  assert.equal(
    reply?.deferToAi,
    undefined,
    `${lessonId} should soft-advance scripted`,
  );
  assert.match(
    reply?.textEn ?? '',
    /ตรงนี้(พูดว่า|ใช้โครง)/,
    `${lessonId} missing model/skeleton line`,
  );
  assert.match(reply?.textEn ?? '', modelPattern, `${lessonId} model phrase`);
  assert.match(
    reply?.textEn ?? '',
    /ไปต่อกันเลย —/,
    `${lessonId} missing advance lead-in`,
  );
  assert.match(reply?.textEn ?? '', advancePattern, `${lessonId} advance cue`);
  assert.doesNotMatch(
    reply?.textEn ?? '',
    /ไม่เป็นไรครับ ไปต่อกัน!/,
    `${lessonId} should not use old prefix`,
  );
}

describe('Stories soft-advance copy (all 10 lessons)', () => {
  it('yesterday — step 1 this morning', () => {
    assertSoftAdvance(
      doubleWrong(
        'เมื่อเช้าฉันกินข้าวเช้ามานะ',
        'Good morning.',
        'ลองพูดตาม I ate breakfast this morning.',
        'Hello there.',
      ),
      STORIES_YESTERDAY.lessonId,
      /"I ate\.\.\. this morning"/,
      /กินข้าวเช้าเมื่อวาน|I ate breakfast yesterday/,
    );
  });

  it('last weekend — step 1 beach', () => {
    assertSoftAdvance(
      doubleWrong(
        'สุดสัปดาห์ที่แล้วฉันไปชายหาด',
        'Good morning.',
        'ลองพูดตาม I went to the beach.',
        'Hello there.',
      ),
      STORIES_LAST_WEEKEND.lessonId,
      /"I went to the\.\.\."/,
      /ไปช้อปปิ้ง|I went shopping/,
    );
  });

  it('vacation — step 1 Japan', () => {
    assertSoftAdvance(
      doubleWrong(
        'ฉันไปญี่ปุ่น',
        'Good morning.',
        'ลองพูดตาม I went to Japan.',
        'Hello there.',
      ),
      STORIES_VACATION.lessonId,
      /"I went to\.\.\."/,
      /ไปเกาหลี|I went to Korea/,
    );
  });

  it('birthday — step 1 party', () => {
    assertSoftAdvance(
      doubleWrong(
        'ฉันจัดงานวันเกิด',
        'Good morning.',
        'ลองพูดตาม I had a birthday party.',
        'Hello there.',
      ),
      STORIES_BIRTHDAY.lessonId,
      /"I had a\.\.\."/,
      /ได้ของขวัญ|I got a gift/,
    );
  });

  it('school — step 1 studied English', () => {
    assertSoftAdvance(
      doubleWrong(
        'ฉันเรียนภาษาอังกฤษ',
        'Good morning.',
        'ลองพูดตาม I studied English.',
        'Hello there.',
      ),
      STORIES_SCHOOL.lessonId,
      /"I studied\.\.\."|"I studied English\."/,
      /เล่นฟุตบอล|I played football/,
    );
  });

  it('funny — step 1 forgot bag', () => {
    assertSoftAdvance(
      doubleWrong(
        'ก่อนอื่น ฉันลืมกระเป๋า',
        'Good morning.',
        'ลองพูดตาม First, I forgot my bag.',
        'Hello there.',
      ),
      STORIES_FUNNY.lessonId,
      /"First, I\.\.\."/,
      /โทรศัพท์หาย|Then, I lost my phone/,
    );
  });

  it('bad day — step 1 late traffic', () => {
    assertSoftAdvance(
      doubleWrong(
        'ฉันมาสายเพราะรถติด',
        'Good morning.',
        'ลองพูดตาม I was late because of traffic.',
        'Hello there.',
      ),
      STORIES_BAD_DAY.lessonId,
      /"I was late because\.\.\."/,
      /ฝนตก|It rained, so I took the bus/,
    );
  });

  it('first time — step 1 first time', () => {
    assertSoftAdvance(
      doubleWrong(
        'เป็นครั้งแรกของฉัน',
        'Good morning.',
        'ลองพูดตาม It was my first time.',
        'Hello there.',
      ),
      STORIES_FIRST_TIME.lessonId,
      /"It was my\.\.\."/,
      /เครื่องบิน|It was my first time on an airplane/,
    );
  });

  it('favorite — step 1 family trip', () => {
    assertSoftAdvance(
      doubleWrong(
        'ความทรงจำโปรดคือทริปครอบครัว',
        'Good morning.',
        'ลองพูดตาม My favorite memory was our family trip.',
        'Hello there.',
      ),
      STORIES_FAVORITE.lessonId,
      /"My favorite memory was\.\.\."/,
      /วันหยุด|My favorite memory was our holiday/,
    );
  });

  it('last night — step 1 watching TV', () => {
    assertSoftAdvance(
      doubleWrong(
        'เมื่อคืนสองทุ่ม ฉันกำลังดูทีวี',
        'Good morning.',
        'ลองพูดตาม I was watching TV.',
        'Hello there.',
      ),
      STORIES_LAST_NIGHT.lessonId,
      /"I was\.\.\."/,
      /เขากำลังทำอาหาร|He was cooking/,
    );
  });
});
