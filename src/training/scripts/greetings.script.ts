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

function softHint(
  phrase: string,
  th: string,
  en: string,
  extra?: Partial<ScriptTurnResult>,
): ScriptTurnResult {
  return {
    textEn: th,
    textTh: en,
    isLessonComplete: false,
    expectsUserSpeech: true,
    expectedSpeech: phrase,
    ...extra,
  };
}

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

function softHintForStep(step: number): ScriptTurnResult {
  switch (step) {
    case 1:
      return softHint(
        'Hello',
        'ใกล้แล้วครับ! ลองพูดว่า "Hello" ชัดๆ อีกครั้งนะ 👋',
        'Almost! Try saying "Hello" clearly one more time.',
      );
    case 2:
      return softHint(
        'Hi',
        'เกือบได้แล้ว! ลองพูด "Hi" อีกครั้งนะ ✌️',
        'Almost! Try "Hi" once more.',
      );
    case 3:
      return softHint(
        GREETINGS_STEP3_EXPECTED,
        'เพื่อนสนิทมักใช้คำสบายๆ — ลองพูด "Hi" อีกครั้งนะ',
        'With a close friend, try "Hi" again.',
        { emojiChoice: { options: [...HELLO_HI_CHOICE.options] } },
      );
    case 4:
      return softHint(
        'Good morning',
        'ช่วงเช้าใช้ Good morning — ลองอีกครั้งนะ 🌅',
        'In the morning, say Good morning — try again.',
      );
    case 5:
      return softHint(
        'Good afternoon',
        'ช่วงบ่ายใช้ Good afternoon — ลองอีกครั้งนะ ☀️',
        'In the afternoon, say Good afternoon — try again.',
      );
    case 6:
      return softHint(
        'Good evening',
        'ตอนเย็นใช้ Good evening — ลองอีกครั้งนะ 🌙',
        'In the evening, say Good evening — try again.',
      );
    case 7:
      return softHint(
        GREETINGS_STEP7_EXPECTED,
        'เช้า 7 โมง — ลองพูด "Good morning" อีกครั้งนะ',
        'At 7am, try "Good morning" again.',
        { emojiChoice: { options: [...TIME_OF_DAY_CHOICE.options] } },
      );
    case 8:
      return softHint(
        '',
        'ลองทักทายด้วย Hello, Hi หรือ Good morning/afternoon/evening นะ 👋',
        'Try any greeting we learned — Hello, Hi, or a time-of-day phrase.',
      );
    default:
      return softHint(
        'Hello',
        'ลองพูดอีกครั้งนะครับ',
        'Try once more.',
      );
  }
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

  if (!matched && attempt === 1) {
    return softHintForStep(step);
  }

  if (!matched && attempt >= 2) {
    return { deferToAi: true } as ScriptTurnResult;
  }

  const nextStep = Math.min(step + 1, 9);
  return teachStep(nextStep, name);
}

export const GREETINGS_SCRIPT = {
  lessonId: 'greetings',
  buildOpening: buildGreetingsOpening,
  buildAfterUser: (input: Parameters<typeof buildGreetingsAfterUser>[0]) =>
    buildGreetingsAfterUser(input),
};
