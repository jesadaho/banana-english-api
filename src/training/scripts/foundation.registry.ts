import {
  createFoundationLessonDef,
  FOUNDATION_LESSON_IDS,
} from '../foundation/foundation.helpers';
import {
  FOUNDATION_BOARDS,
  FOUNDATION_CLOSE_MATCHERS,
  FOUNDATION_LOOSE_MATCHERS,
  FOUNDATION_MAX_STEPS,
} from '../foundation/foundation-boards';
import type { ChoiceLessonDef } from './choice-lesson.script';

function foundationCompletion(name: string, thai: string): string {
  const n = name.trim() || 'เพื่อน';
  return `สุดยอดครับ ${n}! 🎉 ${thai} 🍌`;
}

const OPENING_TEXTS: Record<(typeof FOUNDATION_LESSON_IDS)[number], string> = {
  greetings:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนการทักทายกันครับ — Hello, Hi และทักทายตามเวลาในวัน 😊 เริ่มจากคำแรก: Hello! ลองพูดตามครับ',
  introductions:
    'สวัสดีครับ {name}! วันนี้เราจะฝึกแนะนำตัวครับ 📝 My name is {name}. แปลว่า “ฉันชื่อ {name}” และพูดแบบสั้นว่า I\'m {name}. ได้ ใช้สองแบบนี้เพื่อบอกชื่อของเรา ลองพูดตามว่า “My name is {name}.” ครับ',
  yes_no_maybe:
    'สวัสดีครับ {name}! วันนี้เราจะฝึกตอบ Yes, No และ Maybe ครับ ✅ ถ้ามีคนถาม Do you like coffee? แปลว่า “คุณชอบกาแฟไหม” และเราชอบ ให้ตอบ Yes, I do. แปลว่า “ใช่ ฉันชอบ” ลองพูดตามว่า “Yes, I do.” ครับ',
  polite_expressions:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนคำสุภาพที่ใช้ทุกวันครับ 🙏 Thank you very much. แปลว่า “ขอบคุณมาก” ใช้เมื่ออยากขอบคุณใคร ลองพูดตามว่า “Thank you very much.” ครับ',
  meet_people:
    'สวัสดีครับ {name}! วันนี้เป็นวันแรกในคลาสครับ 🙋 ถ้าเราเพิ่งมาใหม่ พูดว่า “I\'m new here.” แปลว่า “ฉันเพิ่งมาใหม่” โดย I\'m เป็นรูปสั้นของ I am ลองพูดตามครับ',
  talk_about_groups:
    'สวัสดีครับ {name}! วันนี้เราจะพูดถึงคนอื่นและสิ่งของครับ 👨 Ben เรียนห้องเดียวกับคุณ พูดว่า “He\'s my classmate.” โดย He\'s เป็นรูปสั้นของ He is ลองพูดตามครับ',
  ee_about_me_family:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนคำศัพท์ครอบครัวครับ 👨‍👩‍👧 เริ่มจาก brother แปลว่า “พี่ชายหรือน้องชาย” ลองพูดตามว่า “brother” ครับ',
  numbers:
    'สวัสดีครับ {name}! วันนี้เราจะฝึกตัวเลข 0–20 กันครับ 🔢 เริ่มจาก 0–5: 0 zero, 1 one, 2 two, 3 three, 4 four, 5 five มีแอปเปิลกี่ลูกครับ? 🍎🍎🍎🍎',
  telling_time:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกเวลาเป็นภาษาอังกฤษครับ ⏰ ลองพูดตามว่า It\'s six o\'clock.',
  everyday_numbers:
    'สวัสดีครับ {name}! วันนี้เราจะฝึกตัวเลข 20–100 กันครับ 🔢 เริ่มจาก 20 twenty, 30 thirty, 40 forty, 50 fifty ลองพูดตามคำว่า “forty” ครับ',
  money_prices:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนถามและบอกราคาเป็นภาษาอังกฤษครับ 💵 ลองพูดตามว่า How much is it?',
  likes_dislikes:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกสิ่งที่ชอบและไม่ชอบครับ ☕ I like... แปลว่า “ฉันชอบ...” เช่น I like coffee. แปลว่า “ฉันชอบกาแฟ” ลองพูดตามว่า “I like coffee.” ครับ',
  wants_needs:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน I want / I need / I have ครับ 💧 I want ใช้บอกสิ่งที่อยากได้, I need ใช้บอกสิ่งที่จำเป็นต้องใช้ และ I have ใช้บอกสิ่งที่มีอยู่แล้ว เริ่มจาก I want water. แปลว่า “ฉันอยากได้น้ำ” ลองพูดตามครับ',
  can_cant:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน I can / I can\'t ครับ 🏊 can แปลว่า “ทำได้” ส่วน can\'t แปลว่า “ทำไม่ได้” เช่น I can swim. คือ “ฉันว่ายน้ำได้” ลองพูดตามว่า “I can swim.” ครับ',
  asking_for_help:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน 3 ประโยคช่วยชีวิตเวลาฟังอังกฤษไม่ทัน 🆘 I don\'t understand. แปลว่า “ฉันไม่เข้าใจ” ใช้เมื่อฟังแล้วไม่เข้าใจ ลองพูดตามว่า “I don\'t understand.” ครับ',
  asking_questions:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนถามคำถามง่ายๆ ครับ 🚻 Where ใช้ถามสถานที่ และ Where is the bathroom? แปลว่า “ห้องน้ำอยู่ที่ไหน” ใช้เมื่อต้องการหาห้องน้ำ ลองพูดตามครับ',
};

const COMPLETION_TEXTS: Record<
  (typeof FOUNDATION_LESSON_IDS)[number],
  (name: string) => string
> = {
  greetings: (name) =>
    foundationCompletion(name, 'วันนี้คุณทักทายได้หลายแบบแล้ว ทั้ง Hello, Hi และทักทายตามเวลาในวัน'),
  introductions: (name) =>
    foundationCompletion(
      name,
      'วันนี้คุณแนะนำตัวเป็นภาษาอังกฤษได้แล้ว ทั้งบอกชื่อ บอกว่ามาจากไหน และตอบเวลาพบคนใหม่ได้',
    ),
  yes_no_maybe: (name) =>
    foundationCompletion(name, 'วันนี้คุณตอบ Yes / No / Maybe และคำตอบสั้นๆ ได้แล้ว'),
  polite_expressions: (name) =>
    foundationCompletion(name, 'วันนี้คุณใช้ thank you, you\'re welcome, excuse me และ sorry ได้แล้ว'),
  meet_people: (name) =>
    foundationCompletion(name, 'วันนี้คุณใช้ I\'m... เพื่อพูดเกี่ยวกับตัวเอง และ You\'re... เพื่อพูดกับคนอื่นได้แล้ว'),
  talk_about_groups: (name) =>
    foundationCompletion(name, 'วันนี้คุณใช้ He\'s..., She\'s... และ It\'s... เพื่อพูดถึงคนและสิ่งของได้แล้ว'),
  ee_about_me_family: (name) =>
    foundationCompletion(name, 'วันนี้คุณแนะนำครอบครัวด้วย This is my... และ I have... ได้แล้ว'),
  numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณฝึกตัวเลข 0–20 และลองใช้กับของรอบตัว หมายเลขห้อง และรถเมล์แล้ว'),
  telling_time: (name) =>
    foundationCompletion(name, 'วันนี้คุณฝึกบอกเวลาพื้นฐานด้วย o\'clock ตัวเลข และ a.m./p.m. แล้ว'),
  everyday_numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณอ่านเลขหลักสิบ และประกอบเลขสองหลักตั้งแต่ 20–100 ได้แล้ว'),
  money_prices: (name) =>
    foundationCompletion(name, 'วันนี้คุณถามและบอกราคาเป็นภาษาอังกฤษได้แล้ว'),
  likes_dislikes: (name) =>
    foundationCompletion(name, 'วันนี้คุณบอกสิ่งที่ชอบและไม่ชอบได้แล้ว'),
  wants_needs: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูด I want / I need / I have ได้แล้ว'),
  can_cant: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูด I can / I can\'t ได้แล้ว'),
  asking_for_help: (name) =>
    foundationCompletion(name, 'วันนี้คุณมี 3 ประโยคช่วยชีวิตเมื่อฟังอังกฤษไม่ทันแล้ว'),
  asking_questions: (name) =>
    foundationCompletion(name, 'วันนี้คุณถามคำถามง่ายๆ ด้วย What, Where, Who และ How ได้แล้ว'),
};

const COMPLETION_TTS_TEXTS: Partial<
  Record<(typeof FOUNDATION_LESSON_IDS)[number], (name: string) => string>
> = {
  numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณฝึกตัวเลขศูนย์ถึงยี่สิบ และลองใช้กับของรอบตัว หมายเลขห้อง และรถเมล์แล้ว'),
  everyday_numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณอ่านเลขหลักสิบ และประกอบเลขสองหลักตั้งแต่ยี่สิบถึงหนึ่งร้อยได้แล้ว'),
};

function buildFoundationDef(
  lessonId: (typeof FOUNDATION_LESSON_IDS)[number],
): ChoiceLessonDef {
  const base = createFoundationLessonDef({
    lessonId,
    maxStep: FOUNDATION_MAX_STEPS[lessonId],
    boards: FOUNDATION_BOARDS[lessonId],
    openingText: OPENING_TEXTS[lessonId],
    completionText: COMPLETION_TEXTS[lessonId],
    completionTtsText: COMPLETION_TTS_TEXTS[lessonId],
    matchesLoose: FOUNDATION_LOOSE_MATCHERS[lessonId],
    matchesClose: FOUNDATION_CLOSE_MATCHERS[lessonId],
    exactExpectedOnlySteps:
      lessonId === 'greetings' ? [3, 5, 7] : undefined,
  });

  return base;
}

export const FOUNDATION_CHOICE_LESSONS: ChoiceLessonDef[] =
  FOUNDATION_LESSON_IDS.map(buildFoundationDef);

const BY_ID = new Map(FOUNDATION_CHOICE_LESSONS.map((d) => [d.lessonId, d]));

export function getFoundationChoiceLesson(
  lessonId: string,
): ChoiceLessonDef | undefined {
  return BY_ID.get(lessonId);
}

export function isFoundationChoiceLesson(lessonId: string): boolean {
  return BY_ID.has(lessonId);
}

export { FOUNDATION_LESSON_IDS };
