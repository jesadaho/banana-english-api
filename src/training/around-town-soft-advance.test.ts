import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';
import {
  AROUND_TOWN_AIRPORT,
  AROUND_TOWN_CHOICE_LESSONS,
  AROUND_TOWN_COFFEE,
  AROUND_TOWN_CONVENIENCE,
  AROUND_TOWN_HOTEL,
  AROUND_TOWN_PHARMACY,
  AROUND_TOWN_RESTAURANT,
  AROUND_TOWN_SHOPPING,
  AROUND_TOWN_SMART_SHOPPER,
  AROUND_TOWN_SURVIVAL,
  AROUND_TOWN_TRANSPORT,
} from './scripts/around-town.registry';

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
  const def = AROUND_TOWN_CHOICE_LESSONS.find((d) => d.lessonId === lessonId);
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

describe('Around Town soft-advance copy (all 10 lessons)', () => {
  it('shopping — step 1 shirt', () => {
    assertSoftAdvance(
      doubleWrong(
        'เสื้อ ในภาษาอังกฤษเรียกว่าอะไรนะครับ?',
        'Good morning.',
        'ลองพูดตาม shirt',
        'Hello there.',
      ),
      AROUND_TOWN_SHOPPING.lessonId,
      /"shirt"/,
      /กางเกง|What about pants\?/,
    );
  });

  it('restaurant — step 1 chicken', () => {
    assertSoftAdvance(
      doubleWrong(
        'ไก่ ในภาษาอังกฤษเรียกว่าอะไรนะครับ?',
        'Good morning.',
        'ลองพูดตาม chicken',
        'Hello there.',
      ),
      AROUND_TOWN_RESTAURANT.lessonId,
      /"chicken"/,
      /ข้าว|What about rice\?/,
    );
  });

  it('coffee — step 1 coffee', () => {
    assertSoftAdvance(
      doubleWrong(
        'กาแฟ ในภาษาอังกฤษเรียกว่าอะไรนะครับ?',
        'Good morning.',
        'ลองพูดตาม coffee',
        'Hello there.',
      ),
      AROUND_TOWN_COFFEE.lessonId,
      /"coffee"/,
      /ชา|What about tea\?/,
    );
  });

  it('convenience — step 1 looking for museum', () => {
    assertSoftAdvance(
      doubleWrong(
        'คุณอยากไปพิพิธภัณฑ์ คุณจะบอกคนท้องถิ่นว่าอย่างไรครับ?',
        'Good morning.',
        "ลองพูดตาม I'm looking for the museum.",
        'Hello there.',
      ),
      AROUND_TOWN_CONVENIENCE.lessonId,
      /I'm looking for the\.\.\./,
      /กำลังหาที่ไหน|I'm looking for the park/,
    );
  });

  it('transport — step 1 going to London', () => {
    assertSoftAdvance(
      doubleWrong(
        'Where are you going?',
        'Good morning.',
        "ลองพูดตาม I'm going to London.",
        'Hello there.',
      ),
      AROUND_TOWN_TRANSPORT.lessonId,
      /I'm going to\.\.\./,
      /กำลังจะไปเมืองนี้|I'm going to Paris/,
    );
  });

  it('smart shopper — step 1 which one is cheaper', () => {
    assertSoftAdvance(
      doubleWrong(
        "Which one is cheaper? เวลาเลือกของ 2 ชิ้นแล้วอยากถามว่า 'อันไหน...'",
        'Good morning.',
        'ลองพูดตาม Which one is cheaper?',
        'Hello there.',
      ),
      AROUND_TOWN_SMART_SHOPPER.lessonId,
      /Which one is \.\.\.\?/,
      /This one is bigger/,
    );
  });

  it('hotel — step 1 reservation', () => {
    assertSoftAdvance(
      doubleWrong(
        'ถ้าจะบอกพนักงานต้อนรับว่า จองห้องไว้ ให้พูดว่า... I have a reservation.',
        'Good morning.',
        'ลองพูดตาม I have a reservation.',
        'Hello there.',
      ),
      AROUND_TOWN_HOTEL.lessonId,
      /I have a\.\.\./,
      /เช็กอิน|I'd like to check in/,
    );
  });

  it('airport — step 1 passport', () => {
    assertSoftAdvance(
      doubleWrong(
        'พาสปอร์ต ในภาษาอังกฤษเรียกว่าอะไรนะครับ?',
        'Good morning.',
        'ลองพูดตาม passport',
        'Hello there.',
      ),
      AROUND_TOWN_AIRPORT.lessonId,
      /"passport"/,
      /เที่ยวบิน|What about flight\?/,
    );
  });

  it('pharmacy — step 1 headache', () => {
    assertSoftAdvance(
      doubleWrong(
        'ปวดหัว ในภาษาอังกฤษเรียกว่าอะไรนะครับ?',
        'Good morning.',
        'ลองพูดตาม headache',
        'Hello there.',
      ),
      AROUND_TOWN_PHARMACY.lessonId,
      /"headache"/,
      /ไข้|What about fever\?/,
    );
  });

  it('survival — step 1 cannot find bag', () => {
    assertSoftAdvance(
      doubleWrong(
        "I can't find my bag. บอกปัญหาก่อนครับ...",
        'Good morning.',
        "ลองพูดตาม I can't find my bag.",
        'Hello there.',
      ),
      AROUND_TOWN_SURVIVAL.lessonId,
      /I can't find my\.\.\./,
      /Can you help me/,
    );
  });
});
