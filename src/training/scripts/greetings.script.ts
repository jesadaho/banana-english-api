import type { ScriptTurnResult } from './types';
import {
  GREETINGS_STEP3_EXPECTED,
  GREETINGS_STEP7_EXPECTED,
} from '../engine/lesson-step.resolver';

const HELLO_HI_CHOICE = {
  options: [
    { emoji: '👋', label: 'Hello', speak: 'Hello' },
    { emoji: '✌️', label: 'Hi', speak: 'Hi' },
  ],
} as const;

const TIME_OF_DAY_CHOICE = {
  options: [
    { emoji: '🌅', label: 'Good morning', speak: 'Good morning' },
    { emoji: '☀️', label: 'Good afternoon', speak: 'Good afternoon' },
    { emoji: '🌙', label: 'Good evening', speak: 'Good evening' },
  ],
} as const;

/** Step content delivered AFTER the learner succeeds (or is accepted) on the prior step. */
function teachStep(
  step: number,
  name: string,
): ScriptTurnResult | null {
  switch (step) {
    case 2:
      return {
        textEn: `เยี่ยมเลย ${name}! Hello ใช้ทักทายได้ทั่วไปครับ 👋 ต่อไปคำสบายๆ: Hi! ลองพูดตามได้เลย`,
        textTh: `Great ${name}! Hello works anywhere. Next, the casual one: Hi! Say it with me.`,
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: 'Hi',
      };
    case 3:
      return {
        textEn:
          'Hello กับ Hi ต่างกันนิดหน่อย — Hello ฟังดูสุภาพกว่า Hi สบายๆ เหมาะกับเพื่อน ✌️ ถ้าเจอเพื่อนสนิท ควรทักว่าอะไรครับ?',
        textTh:
          'Hello is a bit more formal; Hi is casual with friends. You meet a close friend — which greeting fits?',
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: GREETINGS_STEP3_EXPECTED,
        emojiChoice: { options: [...HELLO_HI_CHOICE.options] },
      };
    case 4:
      return {
        textEn:
          'ถูกต้องครับ! ต่อไปทักทายตามเวลา — ช่วงเช้า (ก่อนเที่ยง) ใช้ Good morning 🌅 ลองพูดตามครับ',
        textTh:
          'Nice! Time-of-day greetings next — before noon say Good morning. Try it.',
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: 'Good morning',
      };
    case 5:
      return {
        textEn:
          'เก่งมาก! ช่วงบ่าย (หลังเที่ยงถึงเย็น) ใช้ Good afternoon ☀️ พูดตามได้เลยครับ',
        textTh: 'Great! In the afternoon say Good afternoon. Your turn.',
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: 'Good afternoon',
      };
    case 6:
      return {
        textEn:
          'ดีมากครับ! ตอนเย็น/กลางคืน ใช้ Good evening 🌙 ลองพูดตามนะ',
        textTh: 'Well done! In the evening say Good evening. Say it with me.',
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: 'Good evening',
      };
    case 7:
      return {
        textEn:
          'เช้า 7 โมง ควรทักว่าอะไรครับ? เลือกแล้วพูดทักทายผ่านไมค์ได้เลย 🕖',
        textTh: 'It is 7 in the morning — which greeting fits? Pick and say it.',
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: GREETINGS_STEP7_EXPECTED,
        emojiChoice: { options: [...TIME_OF_DAY_CHOICE.options] },
      };
    case 8:
      return {
        textEn:
          'เก่งมากครับ! คราวนี้ลองทักทายผมสักประโยค — ใช้คำไหนก็ได้ที่เรียนไป 👋',
        textTh: 'Awesome! Greet me with any phrase you learned — your choice.',
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: '',
      };
    case 9:
      return {
        textEn: `ยอดเยี่ยม ${name}! วันนี้คุณทักทายได้หลายแบบแล้ว 🎉 พร้อมไปบทเรียนถัดไปเลย!`,
        textTh: `Excellent ${name}! You can greet people confidently now. See you next lesson!`,
        isLessonComplete: true,
        expectsUserSpeech: false,
      };
    default:
      return null;
  }
}

/** After 2nd wrong — accept and advance without blocking the learner. */
function forceAdvanceStep(
  step: number,
  name: string,
): ScriptTurnResult | null {
  const next = teachStep(Math.min(step + 1, 9), name);
  if (!next) return null;
  if (next.isLessonComplete) return next;
  return {
    ...next,
    textEn: `ไม่เป็นไรครับ ไปต่อกัน! ${next.textEn}`,
    textTh: `No worries — let's move on! ${next.textTh}`,
  };
}

export function buildGreetingsOpening(learnerFirstName: string): ScriptTurnResult {
  const name = learnerFirstName.trim() || 'there';
  return {
    textEn: `สวัสดี ${name}! วันนี้เรามาเรียนการทักทายกันครับ — Hello, Hi และทักทายตามเวลาในวัน 😊 เริ่มจากคำแรก: Hello! ลองพูดตามครับ`,
    textTh: `Hi ${name}! Today we learn greetings — Hello, Hi, and time-of-day phrases. First word: Hello! Say it with me.`,
    isLessonComplete: false,
    expectsUserSpeech: true,
    expectedSpeech: 'Hello',
  };
}

export function buildGreetingsAfterUser(input: {
  step: number;
  attempt: number;
  matched: boolean;
  learnerFirstName: string;
}): ScriptTurnResult | null {
  const { step, attempt, matched, learnerFirstName } = input;
  const name = learnerFirstName.trim() || 'there';

  if (step >= 9) {
    return teachStep(9, name);
  }

  if (matched) {
    return teachStep(Math.min(step + 1, 9), name);
  }

  // Wrong #1 → Gemini soft-teach (model correct phrase + ask repeat).
  if (attempt === 1) {
    return { deferToAi: true, aiMode: 'softTeach' } as ScriptTurnResult;
  }

  // Wrong #2 → accept and advance (scripted, no LLM).
  return forceAdvanceStep(step, name);
}

export const GREETINGS_SCRIPT = {
  lessonId: 'greetings',
  buildOpening: buildGreetingsOpening,
  buildAfterUser: (input: Parameters<typeof buildGreetingsAfterUser>[0]) =>
    buildGreetingsAfterUser(input),
};
