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
  fnd_v2_how_do_you_feel:
    'วันนี้เราจะฝึกบอกความรู้สึกครับ 😊 happy แปลว่า “มีความสุข” และ sad แปลว่า “เศร้า” 😢 ถ้ารู้สึกมีความสุขพูดว่า I\'m happy. ลองพูดตามครับ',
  talk_about_groups:
    'สวัสดีครับ {name}! วันนี้เราจะพูดถึงคนอื่นและสิ่งของครับ 👨 Ben เรียนห้องเดียวกับคุณ พูดว่า “He\'s my classmate.” โดย He\'s เป็นรูปสั้นของ He is ลองพูดตามครับ',
  fnd_v2_we_they:
    'ถ้าพูดถึงตัวเราและเพื่อนรวมกัน ใช้ we แปลว่า “พวกเรา” ครับ 👥 We are friends. หรือพูดสั้นว่า We\'re friends. ลองพูดตามว่า We\'re friends. ครับ',
  ee_about_me_family:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนคำศัพท์ครอบครัวครับ 👨‍👩‍👧 เริ่มจาก brother แปลว่า “พี่ชายหรือน้องชาย” ลองพูดตามว่า “brother” ครับ',
  numbers:
    'สวัสดีครับ {name}! วันนี้เราจะฝึกตัวเลข 0–10 กันครับ 🔢 เริ่มจาก 0–5: 0 zero, 1 one, 2 two, 3 three, 4 four, 5 five มีแอปเปิลกี่ลูกครับ? 🍎🍎🍎🍎',
  fnd_v2_numbers_11_20:
    'สวัสดีครับ {name}! วันนี้ไปต่อเลข 11 และ 12 ครับ: 11 eleven, 12 twelve 🔢 ลองพูดตามว่า “twelve” ครับ',
  fnd_v2_say_it_again:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนประโยคขอให้พูดอีกครั้งครับ 🔁 Can you say that again? แปลว่า “พูดอีกครั้งได้ไหม” คำว่า again แปลว่า “อีกครั้ง” ใช้เมื่อฟังไม่ทัน ลองพูดตามว่า “Can you say that again?” ครับ',
  fnd_v2_basic_colors:
    'วันนี้เราจะเรียนสีพื้นฐานกันครับ 🎨 red แปลว่า “สีแดง” และ blue แปลว่า “สีน้ำเงิน” ลองพูดตามว่า “red” ครับ',
  fnd_v2_shop_things:
    'วันนี้เราจะเรียนชื่อของในร้านครับ 🛍️ bag แปลว่า “กระเป๋า” ลองพูดตามว่า “bag” ครับ',
  fnd_v2_buying_something:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนประโยคซื้อของครับ 🛍️ ถ้าอยากได้สิ่งนี้ พูดว่า I want this. แปลว่า “ฉันอยากได้สิ่งนี้” ลองพูดตามครับ',
  telling_time:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกเวลาเป็นภาษาอังกฤษครับ ⏰ ลองพูดตามว่า It\'s six o\'clock.',
  everyday_numbers:
    'สวัสดีครับ {name}! วันนี้เราจะฝึกตัวเลข 20–100 กันครับ 🔢 เริ่มจาก 20 twenty, 30 thirty, 40 forty, 50 fifty ลองพูดตามคำว่า “forty” ครับ',
  money_prices:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนถามและบอกราคาเป็นภาษาอังกฤษครับ 💵 ลองพูดตามว่า How much is it?',
  likes_dislikes:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกสิ่งที่ชอบและไม่ชอบครับ ☕ I like... แปลว่า “ฉันชอบ...” เช่น I like coffee. แปลว่า “ฉันชอบกาแฟ” ลองพูดตามว่า “I like coffee.” ครับ',
  fnd_v2_daily_actions:
    'วันนี้เราจะฝึกพูดกิจวัตรประจำวันครับ 🌅 I wake up. แปลว่า “ฉันตื่นนอน” ลองพูดตามว่า “I wake up.” ครับ',
  wants_needs:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน I want / I need / I have ครับ 💧 I want ใช้บอกสิ่งที่อยากได้, I need ใช้บอกสิ่งที่จำเป็นต้องใช้ และ I have ใช้บอกสิ่งที่มีอยู่แล้ว เริ่มจาก I want water. แปลว่า “ฉันอยากได้น้ำ” ลองพูดตามครับ',
  can_cant:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน I can / I can\'t ครับ 🏊 can แปลว่า “ทำได้” ส่วน can\'t แปลว่า “ทำไม่ได้” เช่น I can swim. คือ “ฉันว่ายน้ำได้” ลองพูดตามว่า “I can swim.” ครับ',
  asking_for_help:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน 3 ประโยคช่วยชีวิตเวลาฟังอังกฤษไม่ทัน 🆘 I don\'t understand. แปลว่า “ฉันไม่เข้าใจ” ใช้เมื่อฟังแล้วไม่เข้าใจ ลองพูดตามว่า “I don\'t understand.” ครับ',
  asking_questions:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนถามคำถามง่ายๆ ครับ 🚻 Where ใช้ถามสถานที่ และ Where is the bathroom? แปลว่า “ห้องน้ำอยู่ที่ไหน” ใช้เมื่อต้องการหาห้องน้ำ ลองพูดตามครับ',
  fnd_v2_places_directions:
    'วันนี้เราจะเรียนสถานที่และการบอกทางง่ายๆ ครับ 🗺️ bathroom แปลว่า “ห้องน้ำ” ลองพูดตามว่า “bathroom” ครับ',
  fnd_v2_goodbye_closing:
    'วันนี้เราจะฝึกกล่าวลาและจบบทสนทนาครับ 👋 Goodbye. แปลว่า “ลาก่อน” ลองพูดตามว่า “Goodbye.” ครับ',
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
  fnd_v2_how_do_you_feel: (name) =>
    foundationCompletion(
      name,
      'ตอนนี้คุณถามและบอกความรู้สึกพื้นฐานเป็นภาษาอังกฤษได้แล้ว',
    ),
  talk_about_groups: (name) =>
    foundationCompletion(name, 'วันนี้คุณใช้ He\'s..., She\'s... และ It\'s... เพื่อพูดถึงคนและสิ่งของได้แล้ว'),
  fnd_v2_we_they: (name) =>
    foundationCompletion(
      name,
      'ตอนนี้คุณใช้ We\'re... พูดถึงกลุ่มของเรา และ They\'re... พูดถึงคนกลุ่มอื่นได้แล้ว',
    ),
  ee_about_me_family: (name) =>
    foundationCompletion(name, 'วันนี้คุณแนะนำครอบครัวด้วย This is my... และ I have... ได้แล้ว'),
  numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณฝึกตัวเลข 0–10 และลองใช้กับของรอบตัวแล้ว'),
  fnd_v2_numbers_11_20: (name) =>
    foundationCompletion(name, 'วันนี้คุณฝึกตัวเลข 11–20 และลองใช้กับหมายเลขห้อง รถเมล์ และล็อกเกอร์แล้ว'),
  fnd_v2_say_it_again: (name) =>
    foundationCompletion(name, 'วันนี้คุณขอให้พูดอีกครั้ง และถามว่าพูดว่าอะไรเป็นภาษาอังกฤษได้แล้ว'),
  fnd_v2_basic_colors: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูดสีพื้นฐาน 5 สี และบอกสีที่ตัวเองชอบได้แล้ว 🎨'),
  fnd_v2_shop_things: (name) =>
    foundationCompletion(name, 'วันนี้คุณเรียกชื่อของในร้าน 5 อย่าง และบอกสิ่งที่อยากได้เป็นภาษาอังกฤษได้แล้ว 🛍️'),
  fnd_v2_buying_something: (name) =>
    foundationCompletion(name, 'วันนี้คุณบอกสิ่งที่ต้องการ ตอบสนองต่อราคา และตัดสินใจซื้อเป็นภาษาอังกฤษได้แล้ว'),
  telling_time: (name) =>
    foundationCompletion(name, 'วันนี้คุณฝึกบอกเวลาพื้นฐานด้วย o\'clock ตัวเลข และ a.m./p.m. แล้ว'),
  everyday_numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณอ่านเลขหลักสิบ และประกอบเลขสองหลักตั้งแต่ 20–100 ได้แล้ว'),
  money_prices: (name) =>
    foundationCompletion(name, 'วันนี้คุณถามราคา เข้าใจหน่วยเงิน และบอกราคาเป็นภาษาอังกฤษได้แล้ว'),
  likes_dislikes: (name) =>
    foundationCompletion(name, 'วันนี้คุณใช้คำอาหารและเครื่องดื่ม 5 คำ เพื่อบอกสิ่งที่ชอบและไม่ชอบได้แล้ว'),
  fnd_v2_daily_actions: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูดกิจวัตรประจำวัน 5 อย่าง และเลือกเล่าสองกิจกรรมของตัวเองได้แล้ว 🌅'),
  wants_needs: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูด I want / I need / I have ได้แล้ว'),
  can_cant: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูด I can / I can\'t ได้แล้ว'),
  asking_for_help: (name) =>
    foundationCompletion(name, 'วันนี้คุณมี 3 ประโยคช่วยชีวิตเมื่อฟังอังกฤษไม่ทันแล้ว'),
  asking_questions: (name) =>
    foundationCompletion(name, 'วันนี้คุณถามคำถามง่ายๆ ด้วย What, Where, Who และ How ได้แล้ว'),
  fnd_v2_places_directions: (name) =>
    foundationCompletion(name, 'วันนี้คุณเรียกชื่อสถานที่และการเดินทาง พร้อมถามทางและบอกทางง่ายๆ ได้แล้ว 🗺️'),
  fnd_v2_goodbye_closing: (name) =>
    foundationCompletion(name, 'วันนี้คุณกล่าวลาและจบบทสนทนาเป็นภาษาอังกฤษได้หลายแบบแล้ว 👋'),
};

const COMPLETION_TTS_TEXTS: Partial<
  Record<(typeof FOUNDATION_LESSON_IDS)[number], (name: string) => string>
> = {
  numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณฝึกตัวเลขศูนย์ถึงสิบ และลองใช้กับของรอบตัวแล้ว'),
  fnd_v2_numbers_11_20: (name) =>
    foundationCompletion(
      name,
      'วันนี้คุณฝึกตัวเลขสิบเอ็ดถึงยี่สิบ และลองใช้กับหมายเลขห้อง รถเมล์ และล็อกเกอร์แล้ว',
    ),
  everyday_numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณอ่านเลขหลักสิบ และประกอบเลขสองหลักตั้งแต่ยี่สิบถึงหนึ่งร้อยได้แล้ว'),
};

const NUMBER_TTS_INSTRUCTION =
  'Speak warmly and naturally as Teacher B, a friendly English teacher for Thai learners. ' +
  'Thai number words stay Thai (หนึ่ง, สอง, สิบสี่). ' +
  'Latin-script English number words stay English (one, two, fourteen). ' +
  'Pronounce every Latin-script English word in English. Do not translate English words into Thai. ' +
  'Do not read this instruction aloud.';

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
    ttsInstruction:
      lessonId === 'numbers' ||
      lessonId === 'fnd_v2_numbers_11_20' ||
      lessonId === 'everyday_numbers'
        ? NUMBER_TTS_INSTRUCTION
        : undefined,
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
