import type { ScriptTurnResult } from './types';
import {
  createFoundationLessonDef,
  FOUNDATION_LESSON_IDS,
  personalize,
} from '../foundation/foundation.helpers';
import {
  FOUNDATION_BOARDS,
  FOUNDATION_LOOSE_MATCHERS,
  FOUNDATION_MAX_STEPS,
} from '../foundation/foundation-boards';
import type { ChoiceLessonDef } from './choice-lesson.script';

function foundationCompletion(name: string, thai: string): string {
  const n = name.trim() || 'เพื่อน';
  return `สุดยอดครับ ${n}! 🎉 ${thai} — เก่งมากครับ! 🍌`;
}

const OPENING_TEXTS: Record<(typeof FOUNDATION_LESSON_IDS)[number], string> = {
  introductions:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนรู้การแนะนำตัวเป็นภาษาอังกฤษกันครับ 📝 My name is {name} แปลว่า “ฉันชื่อ {name}” ลองพูดตามนะครับ',
  yes_no_maybe:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนรู้ตอบคำถาม Yes / No / Maybe กันครับ ✅ ลองพูดตามว่า Yes, I do. นะครับ',
  polite_expressions:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนคำสุภาพที่ใช้ทุกวันครับ 🙏 ลองพูดตามว่า Thank you very much.',
  meet_people:
    'สวัสดีครับ {name}! วันนี้เรามาฝึกพูดเกี่ยวกับตัวเองและคู่สนทนาครับ 🙋 ลองพูดตามว่า I am {name}.',
  talk_about_groups:
    'สวัสดีครับ {name}! วันนี้เรามาพูดถึงคนอื่นและสิ่งของครับ 👨 ลองพูดตามว่า He is my father.',
  ee_about_me_family:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนคำศัพท์ครอบครัวและประโยคง่ายๆ กันครับ 👨‍👩‍👧 พร้อมแล้วพูดว่า I\'m ready ได้เลยครับ 🚀',
  numbers:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนตัวเลข 0–20 กันครับ 🔢 ลองพูดตามว่า three นะครับ',
  telling_time:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกเวลาเป็นภาษาอังกฤษครับ ⏰ ลองพูดตามว่า It\'s six o\'clock.',
  everyday_numbers:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนตัวเลข 20–100 กันครับ 🔢 ลองพูดตามว่า forty นะครับ',
  money_prices:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนถามและบอกราคาเป็นภาษาอังกฤษครับ 💵 ลองพูดตามว่า How much is it?',
  likes_dislikes:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกสิ่งที่ชอบและไม่ชอบครับ ☕ ลองพูดตามว่า I like coffee.',
  wants_needs:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน I want / I need / I have ครับ 💧 ลองพูดตามว่า I want water.',
  can_cant:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน I can / I can\'t ครับ 🏊 ลองพูดตามว่า I can swim.',
  asking_for_help:
    'สวัสดีครับ {name}! วันนี้เรามาเรียน 3 ประโยคช่วยชีวิตเวลาฟังอังกฤษไม่ทัน 🆘 ลองพูดตามว่า I don\'t understand.',
  asking_questions:
    'สวัสดีครับ {name}! วันนี้เรามาเรียนถามคำถามง่ายๆ ครับ 🚻 ลองพูดตามว่า Where is the bathroom?',
};

const COMPLETION_TEXTS: Record<
  (typeof FOUNDATION_LESSON_IDS)[number],
  (name: string) => string
> = {
  introductions: (name) =>
    foundationCompletion(name, 'วันนี้คุณแนะนำตัวได้แล้ว ทั้งชื่อ ทักทาย และบอกที่อยู่/งาน'),
  yes_no_maybe: (name) =>
    foundationCompletion(name, 'วันนี้คุณตอบ Yes / No / Maybe และคำตอบสั้นๆ ได้แล้ว'),
  polite_expressions: (name) =>
    foundationCompletion(name, 'วันนี้คุณใช้ please, thank you, excuse me และ sorry ได้แล้ว'),
  meet_people: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูด I am... และ You are... ได้แล้ว'),
  talk_about_groups: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูด He is..., She is... และ It is... ได้แล้ว'),
  ee_about_me_family: (name) =>
    foundationCompletion(name, 'วันนี้คุณแนะนำครอบครัวด้วย This is my... และ I have... ได้แล้ว'),
  numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณพูดตัวเลข 0–20 ได้แล้ว'),
  telling_time: (name) =>
    foundationCompletion(name, 'วันนี้คุณบอกเวลาและใช้ a.m./p.m. ได้แล้ว'),
  everyday_numbers: (name) =>
    foundationCompletion(name, 'วันนี้คุณอ่านตัวเลข 20–100 ได้แล้ว'),
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
    foundationCompletion(name, 'วันนี้คุณถามคำถามง่ายๆ ด้วย What/Where/When/Who/How ได้แล้ว'),
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
    matchesLoose: FOUNDATION_LOOSE_MATCHERS[lessonId],
    pinWithoutGuidedSteps:
      lessonId === 'ee_about_me_family' ? [1] : undefined,
  });

  if (lessonId === 'ee_about_me_family') {
    return {
      ...base,
      buildOpening(learnerFirstName: string): ScriptTurnResult {
        const name = learnerFirstName.trim();
        return {
          textEn: personalize(OPENING_TEXTS.ee_about_me_family, name || 'Ben'),
          textTh: '',
          isLessonComplete: false,
          expectsUserSpeech: true,
          expectedSpeech: "I'm ready",
        };
      },
    };
  }

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
