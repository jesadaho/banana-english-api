import {
  aroundTownRoleplayIntroSpeech,
  looksLikeAroundTownRoleplayBridge,
  normalizeGuidedSpeaking,
} from '../../lessons/lessons.data';
import {
  type ChoiceStepTier,
  type ForcedGuidedBoard,
  computeThreeTierChoiceProgress,
  createBoardChoiceScorer,
  forceGuidedBoardSoftTeachIfNeeded,
  looksLikeSoftTeachReveal,
  pendingThreeTierSoftTeach,
  resolveBoardTextEn,
  resolveForcedBoardTextEn,
} from '../../lessons/choice-board';
import type { LessonTeachingLanguage } from '../../lessons/lesson-teaching';

type AroundTownIntroForceResult = {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  roleplayIntro: unknown;
  roleplayNpc: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: false;
};

function aroundTownIntroAlreadyShown(
  history: Array<{
    speaker: string;
    roleplayIntro?: unknown;
    roleplayNpc?: unknown;
  }>,
): boolean {
  return history.some(
    (t) =>
      t.speaker === 'ai' &&
      (t.roleplayIntro != null || t.roleplayNpc != null),
  );
}

function latestShoppingLookingForUserText(
  history: Array<{ speaker: string; textEn?: string }>,
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t?.speaker !== 'user') continue;
    const text = (t.textEn ?? '').trim();
    if (text) return text;
  }
  return null;
}

function historyHasFavoritesGroupStepCue(
  history: Array<{
    speaker: string;
    textEn?: string;
    roleplayNpc?: unknown;
  }>,
): boolean {
  return history.some((t) => {
    if (t.speaker !== 'ai' || t.roleplayNpc != null) return false;
    const text = t.textEn ?? '';
    const lower = text.toLowerCase();
    return (
      text.includes('กินด้วยกัน') ||
      lower.includes('eat together') ||
      (lower.includes('do you') && lower.includes('together'))
    );
  });
}

function satisfiesFavoritesGroupAnswer(userText: string): boolean {
  const t = userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/s+/g, ' ');
  if (!t) return false;
  return (
    t.includes('we ') ||
    t.includes('eat together') ||
    t.includes('watch movies') ||
    /^(yes|yeah|yep|we do)/.test(t)
  );
}

function matchesExactFromScorer(
  scoreStep: (step: number, text: string) => ChoiceStepTier,
): (step: number, text: string) => boolean {
  return (step, text) => scoreStep(step, text) === 'exact';
}

export const DAILY_ROUTINE_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: {
    textEn:
      'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
    withPraise: true,
    stem: '...',
    expectedSpeech: 'wake up',
    softTeachHintTh: 'ตื่นนอน',
    options: [
      { emoji: '⏰', label: 'wake up', speak: 'wake up' },
      { emoji: '💼', label: 'go to work', speak: 'go to work' },
      { emoji: '🛌', label: 'go to sleep', speak: 'go to sleep' },
    ],
  },
  2: {
    textEn:
      'ยอดเยี่ยม! ปกติคุณตื่นกี่โมงครับ? What time do you wake up? 🌅',
    withPraise: true,
    stem: 'I wake up at...',
    expectedSpeech: "I wake up at 7 o'clock.",
    softTeachHintTh: 'ถ้าจะบอกว่าตื่นกี่โมง เราจะพูดว่า',
    options: [
      {
        emoji: '⏰',
        label: "6 o'clock",
        speak: "I wake up at 6 o'clock.",
      },
      {
        emoji: '⏰',
        label: "7 o'clock",
        speak: "I wake up at 7 o'clock.",
      },
      {
        emoji: '⏰',
        label: "8 o'clock",
        speak: "I wake up at 8 o'clock.",
      },
      {
        emoji: '⏰',
        label: "9 o'clock",
        speak: "I wake up at 9 o'clock.",
      },
    ],
  },
  3: {
    textEn:
      'แล้วคุณเข้านอนประมาณกี่โมงครับ? What time do you go to sleep? 🌙',
    withPraise: true,
    stem: 'I go to sleep at...',
    expectedSpeech: "I go to sleep at 11 o'clock.",
    softTeachHintTh: 'ถ้าจะบอกว่าเข้านอนกี่โมง เราจะพูดว่า',
    options: [
      {
        emoji: '🌙',
        label: "10 o'clock",
        speak: "I go to sleep at 10 o'clock.",
      },
      {
        emoji: '🌙',
        label: "11 o'clock",
        speak: "I go to sleep at 11 o'clock.",
      },
      {
        emoji: '🌙',
        label: "12 o'clock",
        speak: "I go to sleep at 12 o'clock.",
      },
      {
        emoji: '🌙',
        label: "1 o'clock",
        speak: "I go to sleep at 1 o'clock.",
      },
    ],
  },
  5: {
    textEn:
      'เป๊ะเลยครับ! ถ้ากิจกรรมไหนทำเป็นประจำ ให้เติม every day ไว้ท้ายประโยคครับ แล้วนอกจากตื่นนอนกับนอน คุณทำอะไรทุกวันบ้างครับ? What do you do every day? ☕💼',
    withPraise: true,
    stem: 'I ... every day.',
    expectedSpeech: 'I drink coffee every day.',
    softTeachHintTh: 'ถ้าจะบอกกิจกรรมที่ทำทุกวัน เราจะพูดว่า',
    options: [
      {
        emoji: '💼',
        label: 'go to work',
        speak: 'I go to work every day.',
      },
      {
        emoji: '☕',
        label: 'drink coffee',
        speak: 'I drink coffee every day.',
      },
      {
        emoji: '🏃',
        label: 'exercise',
        speak: 'I exercise every day.',
      },
      {
        emoji: '📖',
        label: 'study English',
        speak: 'I study English every day.',
      },
    ],
  },
};

function normalizeDailyRoutineSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function isStandaloneAmPm(userText: string): 'AM' | 'PM' | null {
  const t = normalizeDailyRoutineSpeech(userText);
  if (/^(p\.?m\.?|pm|p m)$/.test(t)) return 'PM';
  if (/^(a\.?m\.?|am|em|aim|a m)$/.test(t)) return 'AM';
  return null;
}

/** Step 5 — need a short sentence, not AM/PM alone (guided cards use full line). */
function matchesDailyRoutineAmPmSentence(userText: string): boolean {
  const t = normalizeDailyRoutineSpeech(userText);
  if (!t || /\bevery day\b/.test(t)) return false;
  if (isStandaloneAmPm(t) != null) return false;
  return (
    /\b(i\s+)?wake up at\b/.test(t) &&
    /\b(a\.?m\.?|p\.?m\.?|am|pm|em)\b/.test(t)
  );
}

const DAILY_ROUTINE_HOUR_TOKEN =
  /\b([1-9]|1[0-2]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|o'?clock)\b/;

export function scoreDailyRoutineStep(
  step: number,
  userText: string,
): ChoiceStepTier {
  const t = normalizeDailyRoutineSpeech(userText);
  if (!t) return 'wrong';

  switch (step) {
    case 1:
      if (
        /^(i(?:'m| am)\s+)?ready$/.test(t) ||
        t === "i'm ready" ||
        t === 'i am ready'
      ) {
        return 'exact';
      }
      if (/\bready\b/.test(t)) return 'near';
      return 'wrong';

    case 2:
      if (
        (t === 'wake up' || t === 'i wake up') &&
        !/\bat\b/.test(t)
      ) {
        return 'exact';
      }
      if (
        t === 'get up' ||
        t === 'i get up' ||
        /^i(?:'m)?\s*waking up$/.test(t)
      ) {
        return 'near';
      }
      return 'wrong';

    case 3: {
      const noAmPm = !/\b(a\.?m\.?|p\.?m\.?)\b/.test(t);
      const noEveryDay = !/\bevery day\b/.test(t);
      const hasHour = DAILY_ROUTINE_HOUR_TOKEN.test(t);
      if (
        /\bi wake up at\b/.test(t) &&
        hasHour &&
        noAmPm &&
        noEveryDay
      ) {
        return 'exact';
      }
      if (
        /\bi get up at\b/.test(t) &&
        hasHour &&
        noAmPm &&
        noEveryDay
      ) {
        return 'near';
      }
      if (
        (/\b(wake|get) up\b/.test(t) || hasHour) &&
        noAmPm &&
        noEveryDay
      ) {
        return 'near';
      }
      return 'wrong';
    }

    case 4:
      if (/\bi go to sleep at\b/.test(t) || /\bi sleep at\b/.test(t)) {
        return 'exact';
      }
      if (/\bi go to bed at\b/.test(t)) return 'near';
      return 'wrong';

    case 5:
      if (matchesDailyRoutineAmPmSentence(userText)) return 'exact';
      if (
        /\b(seven|7|eight|8|nine|9|six|6)\b/.test(t) &&
        /\b(morning|afternoon|evening|night)\b/.test(t)
      ) {
        return 'near';
      }
      if (/^(a\.?m\.?|p\.?m\.?|am|pm|em)$/.test(t.trim())) return 'wrong';
      if (/\b(am|pm|em)\b/.test(t) && !/\bi wake up at\b/.test(t)) {
        return 'near';
      }
      return 'wrong';

    case 6:
      if (
        /\bi (go to work|drink coffee|exercise|study english) every day\b/.test(
          t,
        )
      ) {
        return 'exact';
      }
      if (
        /\bevery day\b/.test(t) &&
        (/\bi\b/.test(t) ||
          /\bgo to work\b/.test(t) ||
          /\bdrink coffee\b/.test(t) ||
          /\bexercise\b/.test(t) ||
          /\bstudy\b/.test(t)) &&
        t.length >= 12
      ) {
        return 'near';
      }
      if (/\bevery day\b/.test(t)) return 'near';
      return 'wrong';

    case 7:
      if (/\bi wake up at\b/.test(t) && /\bevery day\b/.test(t)) {
        return 'exact';
      }
      return 'wrong';

    default:
      return 'wrong';
  }
}

/** Happy-path pool only (exact tier). */
function matchesDailyRoutineStep(step: number, userText: string): boolean {
  return scoreDailyRoutineStep(step, userText) === 'exact';
}

/** How many Daily Routine speak steps are cleared (0–7). */
export function dailyRoutineProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  return computeThreeTierChoiceProgress(history, 7, scoreDailyRoutineStep);
}

export function dailyRoutineBoardForStep(
  step: number,
  history: Array<{ speaker: string; textEn?: string }>,
): ForcedGuidedBoard | null {
  if (step === 1) {
    return {
      textEn: '',
      stem: '',
      expectedSpeech: "I'm ready",
      options: [{ emoji: '🚀', label: "I'm ready", speak: "I'm ready" }],
    };
  }
  if (step === 5) {
    return dailyRoutineAmPmBoard(extractDailyRoutineWakeHour(history));
  }
  if (step === 7) {
    const hour = extractDailyRoutineWakeHour(history);
    const ampm = extractDailyRoutineAmPm(history);
    return {
      textEn: '',
      stem: 'I wake up at... every day.',
      expectedSpeech: `I wake up at ${hour} ${ampm} every day.`,
      softTeachHintTh: 'ถ้าจะบอกว่าตื่นทุกวัน เราจะพูดว่า',
      options: [
        {
          emoji: '⏰',
          label: 'every day',
          speak: `I wake up at ${hour} ${ampm} every day.`,
        },
      ],
    };
  }
  const boardKey = step === 6 ? 5 : step - 1;
  return DAILY_ROUTINE_BOARDS[boardKey] ?? null;
}

function extractDailyRoutineWakeHour(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const text = turn.textEn ?? '';
    const m = text.match(/wake up at\s+(\d{1,2})/i);
    if (m) {
      const h = parseInt(m[1], 10);
      if (h >= 1 && h <= 12) return h;
    }
    const word = text.match(
      /wake up at\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i,
    );
    if (word) {
      return wordMap[word[1].toLowerCase()] ?? 7;
    }
  }
  return 7;
}

function extractDailyRoutineAmPm(
  history: Array<{ speaker: string; textEn?: string }>,
): 'AM' | 'PM' {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.speaker !== 'user') continue;
    const t = normalizeDailyRoutineSpeech(turn.textEn ?? '');
    if (/\bevery day\b/.test(t)) continue;
    if (!matchesDailyRoutineAmPmSentence(t)) continue;
    if (/\bp\.?m\.?\b/.test(t) || /\bpm\b/.test(t)) return 'PM';
    if (/\ba\.?m\.?\b/.test(t) || /\b(am|em)\b/.test(t)) return 'AM';
  }
  return 'AM';
}

/**
 * Detect Daily Routine board from AI question text.
 * 1=vocab, 2=wake, 3=sleep, 4=ampm, 5=activity, 6=active-recall (no cards).
 */
function dailyRoutineBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (
    t.includes('wake up every day') ||
    (t.includes('ตื่นกี่โมง') && t.includes('ทุกวัน')) ||
    t.includes('คำถามสุดท้าย')
  ) {
    return 6;
  }
  if (
    t.includes('what do you do every day') ||
    t.includes('ทำอะไรทุกวัน')
  ) {
    return 5;
  }
  if (
    (/\bam\b/.test(t) && /\bpm\b/.test(t)) ||
    t.includes('am หรือ pm') ||
    (t.includes('เช้า') && t.includes('ดึก') && t.includes('am'))
  ) {
    return 4;
  }
  if (
    t.includes('go to sleep') ||
    t.includes('เข้านอน') ||
    t.includes('ไปนอนประมาณ')
  ) {
    return 3;
  }
  if (
    (t.includes('what time do you wake up') || t.includes('ตื่นกี่โมง')) &&
    !t.includes('ทุกวัน') &&
    !t.includes('every day')
  ) {
    return 2;
  }
  if (
    t.includes('ตื่นนอน') &&
    (t.includes('คือคำไหน') || t.includes('คำไหน'))
  ) {
    return 1;
  }
  return null;
}

function dailyRoutineAmPmBoard(wakeHour: number): ForcedGuidedBoard {
  return {
    textEn:
      'สุดยอด! ทีนี้ถ้าอยากระบุให้ชัดว่าเป็น เช้า หรือ ดึก เราใช้ AM (เช้า) และ PM (ดึก) แทน o\'clock ได้ครับ! เวลาตื่นนอนของคุณคือ AM หรือ PM ครับ? ☀️🌙',
    withPraise: true,
    stem: `I wake up at ${wakeHour}...`,
    expectedSpeech: `I wake up at ${wakeHour} AM.`,
    softTeachHintTh: 'ถ้าจะบอกว่าตื่นตอนเช้า เราจะพูดว่า',
    options: [
      {
        emoji: '☀️',
        label: 'AM (เช้า)',
        speak: `I wake up at ${wakeHour} AM.`,
      },
      {
        emoji: '🌙',
        label: 'PM (ดึก)',
        speak: `I wake up at ${wakeHour} PM.`,
      },
    ],
  };
}

/**
 * Pin Daily Routine guidedSpeaking boards (Turns 2–6).
 * Also strips choice cards on Active Recall (Turn 7).
 */
export function forceDailyRoutineGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
  expectsUserSpeech: boolean;
  expectedSpeech: string | null;
  emojiChoice: null;
  isTaskComplete: boolean;
} | null {
  if (lessonId !== 'ee_about_me_daily_routine') return null;
  if (current.isTaskComplete) return null;

  const progress = dailyRoutineProgress(history);
  const lastUserText = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].speaker === 'user') {
        return (history[i].textEn ?? '').trim();
      }
    }
    return '';
  })();
  const duplicateReady =
    progress === 1 &&
    lastUserText.length > 0 &&
    matchesDailyRoutineStep(1, lastUserText);
  const justClearedStep =
    progress >= 1 &&
    lastUserText.length > 0 &&
    matchesDailyRoutineStep(progress, lastUserText);

  if (
    looksLikeSoftTeachReveal(current.textEn ?? '') &&
    !duplicateReady &&
    !justClearedStep
  ) {
    return null;
  }
  if (
    pendingThreeTierSoftTeach(
      history,
      dailyRoutineProgress,
      7,
      scoreDailyRoutineStep,
    ) &&
    !duplicateReady &&
    !justClearedStep
  ) {
    return null;
  }
  if (nextTurn < 1) return null;

  if (progress >= 7) return null;

  const fromText = dailyRoutineBoardFromAiText(current.textEn ?? '');
  // After ready (progress=1) → board 1 (vocab); after vocab (2) → board 2, …
  // progress N completed ⇒ next board key = N (for N=1..5), recall = 6.
  let target = fromText;
  if (target == null) {
    if (progress >= 1 && progress <= 6) target = progress;
    else return null;
  } else if (progress >= 1 && progress <= 6 && progress > target) {
    // Learner already cleared this step — don't re-pin an earlier board because
    // the model repeated the AM/PM (or other) question.
    target = progress;
  }

  // Active Recall — no choice cards.
  if (target === 6) {
    if (current.guidedSpeaking == null && current.expectsUserSpeech) {
      return null;
    }
    const hour = extractDailyRoutineWakeHour(history);
    const ampm = extractDailyRoutineAmPm(history);
    return {
      textEn: resolveBoardTextEn(
        current.textEn ?? '',
        current.textEn?.trim() ||
          'เท่มากครับ! คำถามสุดท้าย... ปกติคุณตื่นกี่โมงทุกวันครับ? What time do you wake up every day? ลองตอบเป็นประโยคภาษาอังกฤษเต็มๆ ดูครับ! ✨',
        { withPraise: true },
      ),
      textTh: current.textTh?.trim() || null,
      guidedSpeaking: null,
      expectsUserSpeech: true,
      expectedSpeech: `I wake up at ${hour} ${ampm} every day.`,
      emojiChoice: null,
      isTaskComplete: false,
    };
  }

  if (target < 1 || target > 5) return null;

  const wakeHour = extractDailyRoutineWakeHour(history);
  const board =
    target === 4
      ? dailyRoutineAmPmBoard(wakeHour)
      : DAILY_ROUTINE_BOARDS[target];
  if (!board) return null;

  const stemOk =
    current.guidedSpeaking?.stem
      ?.toLowerCase()
      .includes(board.stem.toLowerCase().slice(0, 10)) ?? false;
  const optionsOk =
    (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, target),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: {
      stem: board.stem,
      emoji: first.emoji,
      speak: first.speak,
      ...(first.label ? { label: first.label } : {}),
      options,
    },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * Deterministic Daily Routine tutor line from learner progress alone.
 * Skips soft-teach guards so board turns never fall through to Gemini
 * (which was failing deterministically around Core Flow turn 4 / AM-PM).
 */
export function buildDailyRoutineScriptedReplyFromProgress(
  history: Array<{ speaker: string; textEn?: string }>,
  progressOverride?: number,
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
  expectsUserSpeech: boolean;
  expectedSpeech: string | null;
  isTaskComplete: boolean;
} | null {
  const progress = progressOverride ?? dailyRoutineProgress(history);
  if (progress >= 7) {
    return {
      textEn:
        'สุดยอดมากครับ! 🎉 วันนี้คุณบอกได้ทั้งเวลาตื่น นอน และกิจกรรมที่ทำ every day ได้คล่องสุดๆ บทแรกผ่านแล้วครับ! 🍌✨',
      textTh: '',
      guidedSpeaking: null,
      expectsUserSpeech: false,
      expectedSpeech: null,
      isTaskComplete: true,
    };
  }

  // progress N cleared ⇒ next board key = N (1..5), or active recall at 6.
  if (progress < 1 || progress > 6) return null;

  if (progress === 6) {
    const hour = extractDailyRoutineWakeHour(history);
    const ampm = extractDailyRoutineAmPm(history);
    return {
      textEn:
        'เท่มากครับ! คำถามสุดท้าย... ปกติคุณตื่นกี่โมงทุกวันครับ? What time do you wake up every day? ลองตอบเป็นประโยคภาษาอังกฤษเต็มๆ ดูครับ! ✨',
      textTh: null,
      guidedSpeaking: null,
      expectsUserSpeech: true,
      expectedSpeech: `I wake up at ${hour} ${ampm} every day.`,
      isTaskComplete: false,
    };
  }

  const target = progress;
  const wakeHour = extractDailyRoutineWakeHour(history);
  const board =
    target === 4
      ? dailyRoutineAmPmBoard(wakeHour)
      : DAILY_ROUTINE_BOARDS[target];
  if (!board) return null;

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: board.textEn,
    textTh: null,
    guidedSpeaking: {
      stem: board.stem,
      emoji: first.emoji,
      speak: first.speak,
      ...(first.label ? { label: first.label } : {}),
      options,
    },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    isTaskComplete: false,
  };
}

/** Scripted turn when Gemini fails (RECITATION / empty / JSON errors) on Daily Routine. */
export function buildDailyRoutineFallbackTrainingReply(
  lessonId: string,
  history: Array<{ speaker: string; textEn?: string }>,
  nextTurn: number,
): {
  textEn: string;
  textTh: string;
  isLessonComplete: boolean;
  expectsUserSpeech: boolean;
  expectedSpeech?: string;
  guidedSpeaking?: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
} | null {
  if (lessonId !== 'ee_about_me_daily_routine' || nextTurn < 1) {
    return null;
  }

  const scripted = buildDailyRoutineScriptedReplyFromProgress(history);
  if (!scripted) return null;

  return {
    textEn: scripted.textEn,
    textTh: scripted.textTh ?? '',
    isLessonComplete: scripted.isTaskComplete,
    expectsUserSpeech: scripted.expectsUserSpeech,
    expectedSpeech: scripted.expectedSpeech ?? undefined,
    guidedSpeaking: scripted.guidedSpeaking ?? undefined,
  };
}

export type FoodFavoriteId = 'pizza' | 'sushi' | 'somtam';

/** Learner's food choice — board branch (pizza/sushi/somtam) or free-form spoken word. */
export type FoodLessonChoice = {
  /** Lowercase token used in English patterns, e.g. "burger", "pizza". */
  spoken: string;
  /** Title case for tutor lines, e.g. "Burger". */
  display: string;
  /** Curriculum board branch when pizza/sushi/somtam; null for free-form food. */
  boardId: FoodFavoriteId | null;
};

function foodDisplayFromSpoken(spoken: string): string {
  return spoken
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function resolveFoodBoardId(spoken: string): FoodFavoriteId | null {
  const t = spoken.toLowerCase().trim();
  if (t === 'pizza' || t === 'pizzas') return 'pizza';
  if (t === 'sushi') return 'sushi';
  if (t === 'somtam' || t === 'som tam' || t === 'papaya salad') return 'somtam';
  return null;
}

function parseFoodFromILike(normalized: string): string | null {
  const m = normalized.match(/\bi like(?: to eat)?\s+(.+)$/i);
  if (!m) return null;
  const food = m[1]
    .trim()
    .replace(/\b(please|too|a lot|very much|so much)\b.*$/i, '')
    .replace(/^the\s+/, '')
    .replace(/[.!?]+$/g, '')
    .trim();
  if (!food || food.length < 2) return null;
  return food;
}

function foodChoiceFromSpoken(spoken: string): FoodLessonChoice {
  const cleaned = spoken.trim().toLowerCase();
  const boardId = resolveFoodBoardId(cleaned);
  const canonical = boardId ?? cleaned;
  return {
    spoken: canonical,
    display: foodDisplayFromSpoken(canonical),
    boardId,
  };
}

/** Food the learner picked (from "I like …" or later mentions). Defaults to pizza. */
export function extractFoodLessonChoice(
  history: Array<{ speaker: string; textEn?: string }>,
): FoodLessonChoice {
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizeFoodSpeech(turn.textEn ?? '');
    if (!t || !/\bi like\b/.test(t)) continue;
    const parsed = parseFoodFromILike(t);
    if (parsed) return foodChoiceFromSpoken(parsed);
    if (/\bpizza\b/.test(t)) return foodChoiceFromSpoken('pizza');
    if (/\bsushi\b/.test(t)) return foodChoiceFromSpoken('sushi');
    if (
      /\bsom\s*-?\s*tam\b/.test(t) ||
      /\bsomtam\b/.test(t) ||
      /\bpapaya salad\b/.test(t)
    ) {
      return foodChoiceFromSpoken('somtam');
    }
  }
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizeFoodSpeech(turn.textEn ?? '');
    if (!t) continue;
    if (/\bpizza\b/.test(t)) return foodChoiceFromSpoken('pizza');
    if (/\bsushi\b/.test(t)) return foodChoiceFromSpoken('sushi');
    if (
      /\bsom\s*-?\s*tam\b/.test(t) ||
      /\bsomtam\b/.test(t) ||
      /\bpapaya salad\b/.test(t)
    ) {
      return foodChoiceFromSpoken('somtam');
    }
  }
  return foodChoiceFromSpoken('pizza');
}

/** Food & Drinks 1.2 — Turn 1 favorite-food board (also used on opening). */
export const FOOD_FAVORITE_GUIDED_SPEAKING = {
  stem: 'I like...',
  options: [
    { emoji: '🍕', label: 'Pizza', speak: 'I like pizza.' },
    { emoji: '🍣', label: 'Sushi', speak: 'I like sushi.' },
    { emoji: '🌶️🥗', label: 'Somtam', speak: 'I like somtam.' },
  ],
} as const;

export function foodFavoriteOpeningText(_learnerFirstName: string): string {
  return 'พูดถึงของโปรดเนี่ย นึกถึงแล้วหิวเลยเนอะ วันนี้มาคุยเรื่องของกินกันครับ! 😋 ปกติแล้วคุณชอบทานอะไรเป็นพิเศษครับ? What food do you like?';
}

const FOOD_DESCRIBE_BOARDS: Record<
  FoodFavoriteId,
  {
    textEn: string;
    stem: string;
    expectedSpeech: string;
    options: Array<{ emoji: string; label: string; speak: string }>;
  }
> = {
  pizza: {
    textEn:
      'Pizza! ของโปรดเลยครับ 🍕 แล้วพิซซ่าถาดโปรดของคุณเป็นยังไงครับ? What is pizza like?',
    stem: 'Pizza is...',
    expectedSpeech: 'Pizza is delicious.',
    options: [
      { emoji: '😋', label: 'delicious', speak: 'Pizza is delicious.' },
      { emoji: '🧀', label: 'cheesy', speak: 'Pizza is cheesy.' },
      { emoji: '🌶️', label: 'spicy', speak: 'Pizza is spicy.' },
    ],
  },
  sushi: {
    textEn:
      'Sushi! น่าทานมากครับ 🍣 แล้วซูชิที่คุณชอบเป็นยังไงครับ? What is sushi like?',
    stem: 'Sushi is...',
    expectedSpeech: 'Sushi is fresh.',
    options: [
      { emoji: '🐟', label: 'fresh', speak: 'Sushi is fresh.' },
      { emoji: '😋', label: 'delicious', speak: 'Sushi is delicious.' },
      { emoji: '❤️', label: 'healthy', speak: 'Sushi is healthy.' },
    ],
  },
  somtam: {
    textEn:
      'Somtam! แซ่บแน่นอน 🌶️ แล้วส้มตำของคุณรสชาติเป็นยังไงครับ? What is somtam like?',
    stem: 'Somtam is...',
    expectedSpeech: 'Somtam is spicy.',
    options: [
      { emoji: '🌶️', label: 'spicy', speak: 'Somtam is spicy.' },
      { emoji: '😋', label: 'delicious', speak: 'Somtam is delicious.' },
      { emoji: '🥗', label: 'healthy', speak: 'Somtam is healthy.' },
    ],
  },
};

function foodDisplayName(food: FoodFavoriteId): string {
  switch (food) {
    case 'pizza':
      return 'Pizza';
    case 'sushi':
      return 'Sushi';
    case 'somtam':
      return 'Somtam';
  }
}

function foodDrinkBoard(food: FoodFavoriteId): {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
} {
  const display = foodDisplayName(food);
  return {
    textEn: `น่าทานมากครับ! แล้วปกติคุณชอบดื่มอะไรคู่กับ ${display} ครับ? What do you usually drink with ${food}? 🥤`,
    stem: `I drink... with ${food}.`,
    expectedSpeech: `I drink iced tea with ${food}.`,
    options: [
      {
        emoji: '🥤',
        label: 'iced tea',
        speak: `I drink iced tea with ${food}.`,
      },
      {
        emoji: '☕',
        label: 'hot coffee',
        speak: `I drink hot coffee with ${food}.`,
      },
      {
        emoji: '🧃',
        label: 'fruit juice',
        speak: `I drink fruit juice with ${food}.`,
      },
    ],
  };
}

function foodDescribeBoardForChoice(choice: FoodLessonChoice): ForcedGuidedBoard {
  if (choice.boardId) return FOOD_DESCRIBE_BOARDS[choice.boardId];
  const { spoken, display } = choice;
  return {
    textEn: `${display}! ของโปรดเลยครับ 🍽️ แล้ว${display}ที่คุณชอบเป็นยังไงครับ? What is ${spoken} like?`,
    withPraise: true,
    stem: `${display} is...`,
    expectedSpeech: `${display} is delicious.`,
    options: [
      { emoji: '😋', label: 'delicious', speak: `${display} is delicious.` },
      { emoji: '😋', label: 'tasty', speak: `${display} is tasty.` },
      { emoji: '🌶️', label: 'spicy', speak: `${display} is spicy.` },
    ],
  };
}

function foodDrinkBoardForChoice(choice: FoodLessonChoice): ForcedGuidedBoard {
  if (choice.boardId) return foodDrinkBoard(choice.boardId);
  const { spoken, display } = choice;
  return {
    textEn: `น่าทานมากครับ! แล้วปกติคุณชอบดื่มอะไรคู่กับ ${display} ครับ? What do you usually drink with ${spoken}? 🥤`,
    withPraise: true,
    stem: `I drink... with ${spoken}.`,
    expectedSpeech: `I drink iced tea with ${spoken}.`,
    options: [
      {
        emoji: '🥤',
        label: 'iced tea',
        speak: `I drink iced tea with ${spoken}.`,
      },
      {
        emoji: '☕',
        label: 'hot coffee',
        speak: `I drink hot coffee with ${spoken}.`,
      },
      {
        emoji: '🧃',
        label: 'fruit juice',
        speak: `I drink fruit juice with ${spoken}.`,
      },
    ],
  };
}

const FOOD_EMOJI_QUIZ_BOARDS: Record<4 | 5 | 6, ForcedGuidedBoard> = {
  4: {
    textEn: 'เก่งมากครับ! 👏 มาทาย Emoji Quiz กันนะ 😋🍕',
    withPraise: true,
    stem: 'Pizza is...',
    expectedSpeech: 'Pizza is delicious.',
    options: [
      { emoji: '😋', label: 'delicious', speak: 'Pizza is delicious.' },
      { emoji: '☕', label: 'coffee', speak: 'coffee.' },
      { emoji: '🍳', label: 'breakfast', speak: 'breakfast.' },
    ],
  },
  5: {
    textEn: 'ข้อต่อไปครับ! 🥤🍕',
    withPraise: true,
    stem: 'I drink ____ with pizza.',
    expectedSpeech: 'I drink iced tea with pizza.',
    options: [
      {
        emoji: '🥤',
        label: 'iced tea',
        speak: 'I drink iced tea with pizza.',
      },
      { emoji: '🌶️', label: 'spicy', speak: 'spicy.' },
      { emoji: '🍳', label: 'breakfast', speak: 'breakfast.' },
    ],
  },
  6: {
    textEn: 'ข้อสุดท้ายครับ! 🌶️🥗',
    withPraise: true,
    stem: 'Somtam is...',
    expectedSpeech: 'Somtam is spicy.',
    options: [
      { emoji: '🌶️', label: 'spicy', speak: 'Somtam is spicy.' },
      { emoji: '☕', label: 'coffee', speak: 'coffee.' },
      { emoji: '🍳', label: 'breakfast', speak: 'breakfast.' },
    ],
  },
};

function normalizeFoodSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function extractFoodFavorite(
  history: Array<{ speaker: string; textEn?: string }>,
): FoodFavoriteId | null {
  return extractFoodLessonChoice(history).boardId;
}

function matchesFoodStep(
  step: number,
  userText: string,
  choice: FoodLessonChoice,
): boolean {
  const t = normalizeFoodSpeech(userText);
  if (!t) return false;
  const spokenRe = choice.spoken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tasteAdj =
    /\b(delicious|cheesy|spicy|fresh|healthy|yummy|tasty|sweet|sour|salty|good|great|nice)\b/.test(
      t,
    ) || /\bis [a-z][a-z'-]{1,20}$/.test(t);
  switch (step) {
    case 1: // I like [food] — board OR any clear food
      return /\bi like\b/.test(t) && t.replace(/\bi like\b/, '').trim().length >= 2;
    case 2: // [Food] is [adj]
      if (!tasteAdj || !/\bis\b/.test(t) || /\bi like\b/.test(t)) return false;
      if (spokenRe && new RegExp(`\\b${spokenRe}\\b`).test(t)) return true;
      // Soft-accept "It is delicious" / free "[food] is [adj]"
      return /^(it|.+) is\b/.test(t);
    case 3: // I drink … with [food]
      if (!/\bi drink\b/.test(t) || !/\bwith\b/.test(t)) return false;
      // Soft-accept any clear drink+with (board food optional)
      return t.replace(/\bi drink\b/, '').trim().length >= 4;
    case 4: // Emoji Quiz: Pizza is delicious
      return (
        t === 'delicious' ||
        t === 'pizza is delicious' ||
        /\bpizza is delicious\b/.test(t)
      );
    case 5: // Emoji Quiz: I drink iced tea with pizza
      return (
        t === 'iced tea' ||
        /\bi drink iced tea with pizza\b/.test(t)
      );
    case 6: // Emoji Quiz: Somtam is spicy
      return (
        t === 'spicy' ||
        t === 'somtam is spicy' ||
        /\bsom\s*-?\s*tam is spicy\b/.test(t) ||
        /\bsomtam is spicy\b/.test(t)
      );
    default:
      return false;
  }
}

export function scoreFoodStepForHistory(
  history: Array<{ speaker: string; textEn?: string }>,
  step: number,
  userText: string,
): ChoiceStepTier {
  const choice = extractFoodLessonChoice(history);
  return createBoardChoiceScorer(
    normalizeFoodSpeech,
    (s) => foodBoardForStep(s, history),
    (s, t) => matchesFoodStep(s, t, choice),
  )(step, userText);
}

/** How many Food & Drinks speak steps are cleared (0–6). */
export function foodLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  const score = (step: number, text: string) =>
    scoreFoodStepForHistory(history, step, text);
  return computeThreeTierChoiceProgress(history, 6, score);
}

function foodBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (t.includes('ข้อสุดท้าย') || t.includes('🌶️🥗')) return 6;
  if (t.includes('ข้อต่อไป') || t.includes('🥤🍕')) return 5;
  if (t.includes('emoji quiz') || t.includes('😋🍕')) return 4;
  if (t.includes('ดื่มอะไรคู่') || t.includes('what do you usually drink')) {
    return 3;
  }
  if (
    t.includes('what is pizza like') ||
    t.includes('what is sushi like') ||
    t.includes('what is somtam like') ||
    t.includes('เป็นยังไงครับ')
  ) {
    return 2;
  }
  if (t.includes('what food do you like') || t.includes('ชอบทานอะไร')) {
    return 1;
  }
  return null;
}

/**
 * Pin Food & Drinks guidedSpeaking boards (Turns 1–6).
 */
export function forceFoodGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_food') return null;
  if (current.isTaskComplete) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      foodLessonProgress,
      6,
      (step, text) => scoreFoodStepForHistory(history, step, text),
    )
  ) {
    return null;
  }

  const progress = foodLessonProgress(history);
  if (progress >= 6) return null;

  const fromText = foodBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress >= 0 && progress <= 5) step = progress + 1;
    else return null;
  }

  if (step < 1 || step > 6) return null;
  if (nextTurn < 1 && step !== 1) return null;

  let board: ForcedGuidedBoard;

  if (step === 1) {
    board = {
      textEn:
        current.textEn?.trim() ||
        'พูดถึงของโปรดเนี่ย นึกถึงแล้วหิวเลยเนอะ วันนี้มาคุยเรื่องของกินกันครับ! 😋 ปกติแล้วคุณชอบทานอะไรเป็นพิเศษครับ? What food do you like?',
      withPraise: false,
      stem: FOOD_FAVORITE_GUIDED_SPEAKING.stem,
      expectedSpeech: 'I like pizza.',
      options: FOOD_FAVORITE_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
  } else {
    board = foodBoardForStep(step, history)!;
  }

  const stemOk =
    current.guidedSpeaking?.stem
      ?.toLowerCase()
      .includes(board.stem.toLowerCase().slice(0, 8)) ?? false;
  const optionsOk =
    (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    // Script may include praise; strip it. Keep model Success praise when advancing.
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: {
      stem: board.stem,
      emoji: first.emoji,
      speak: first.speak,
      ...(first.label ? { label: first.label } : {}),
      options,
    },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After Food Emoji Quiz → Celebrate.
 */
export function forceFoodCelebrateIfNeeded(
  lessonId: string,
  lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  learnerFirstName: string,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: true;
} | null {
  if (lessonId !== 'ee_about_me_food') return null;
  if (foodLessonProgress(history) < 6) return null;

  const name = learnerFirstName.trim() || 'เพื่อน';
  const body =
    lang === 'english'
      ? `Awesome, ${name}! 🎉 You named a favorite food, described it, and paired a drink — great work! 🍌✨`
      : `สุดยอดครับ ${name}! 🎉 วันนี้คุณบอกได้ทั้งของโปรด รสชาติ และเครื่องดื่มที่ดื่มคู่กันแล้วครับ — เก่งมากครับ! 🍌✨`;

  const raw = (current.textEn ?? '').trim();
  const praiseOk =
    lang === 'english'
      ? /^(great|awesome|nice work|well done|amazing)/i.test(raw)
      : /^(เยี่ยม|เก่งมาก|สุดยอด|ดีมาก|ยอดเยี่ยม)/u.test(raw);
  const textEn =
    current.isTaskComplete && praiseOk && raw.length > 30 ? raw : body;

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: true,
  };
}

/** Home 1.3 — Turn 1 home-type board (also used on opening). */
export const HOME_TYPE_GUIDED_SPEAKING = {
  stem: 'I live in...',
  options: [
    { emoji: '🏢', label: 'Apartment', speak: 'I live in an apartment.' },
    { emoji: '🏠', label: 'House', speak: 'I live in a house.' },
  ],
} as const;

export function homeOpeningText(): string {
  return 'วันนี้เรามาคุยเรื่องที่อยู่อาศัยกันบ้างดีกว่า 🏠 ตอนนี้คุณพักอยู่อาศัยแบบไหนครับ? What kind of place do you live in?';
}

export const HOME_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: {
    textEn: homeOpeningText(),
    withPraise: false,
    stem: 'I live in...',
    expectedSpeech: 'I live in an apartment.',
    options: [
      { emoji: '🏢', label: 'Apartment', speak: 'I live in an apartment.' },
      { emoji: '🏠', label: 'House', speak: 'I live in a house.' },
    ],
  },
  2: {
    textEn:
      'ฟังดูน่าอยู่มากเลยครับ! แล้วปกติคุณพักอยู่กับใครครับ? Who do you live with?',
    withPraise: true,
    stem: 'I live...',
    expectedSpeech: 'I live with my family.',
    options: [
      {
        emoji: '👨‍👩‍👧',
        label: 'Family',
        speak: 'I live with my family.',
      },
      { emoji: '👬', label: 'Friends', speak: 'I live with friends.' },
      { emoji: '🙂', label: 'Alone', speak: 'I live alone.' },
    ],
  },
  3: {
    textEn:
      'เยี่ยมเลยครับ! แล้วเวลาอยู่บ้าน มุมไหนเป็นมุมโปรดที่คุณชอบไปนั่งชิลมากที่สุดครับ? 🛋️✨ Where is your favorite place to relax at home?',
    withPraise: true,
    stem: 'I like to relax in the...',
    expectedSpeech: 'I like to relax in the living room.',
    options: [
      {
        emoji: '🛋️',
        label: 'Living room',
        speak: 'I like to relax in the living room.',
      },
      {
        emoji: '🛏️',
        label: 'Bedroom',
        speak: 'I like to relax in the bedroom.',
      },
      {
        emoji: '🍳',
        label: 'Kitchen',
        speak: 'I like to relax in the kitchen.',
      },
      {
        emoji: '🌳',
        label: 'Garden',
        speak: 'I like to relax in the garden.',
      },
    ],
  },
  4: {
    textEn:
      'เยี่ยมมากครับ! เดี๋ยวเรามาลองทบทวนกันนิดนะ 😊 ถ้าจะบอกว่า "ฉันอาศัยอยู่ในอพาร์ตเมนต์" จะพูดภาษาอังกฤษว่าอย่างไรครับ?',
    advanceQuestionEn: 'How do you say I live in an apartment?',
    withPraise: true,
    stem: '',
    expectedSpeech: 'I live in an apartment.',
    options: [
      {
        emoji: '🏢',
        label: 'Apartment',
        speak: 'I live in an apartment.',
      },
    ],
  },
  5: {
    textEn:
      'แล้วถ้าจะบอกว่า "ฉันอยู่กับครอบครัว" จะพูดว่าอย่างไรครับ?',
    advanceQuestionEn: 'How do you say I live with my family?',
    withPraise: true,
    stem: '',
    expectedSpeech: 'I live with my family.',
    options: [
      {
        emoji: '👨‍👩‍👧',
        label: 'Family',
        speak: 'I live with my family.',
      },
    ],
  },
  6: {
    textEn:
      'ข้อสุดท้ายครับ 😊 "ฉันชอบพักผ่อนในห้องนั่งเล่น" จะพูดภาษาอังกฤษว่าอย่างไรครับ?',
    advanceQuestionEn: 'How do you say I like to relax in the living room?',
    withPraise: true,
    stem: '',
    expectedSpeech: 'I like to relax in the living room.',
    options: [
      {
        emoji: '🛋️',
        label: 'Living room',
        speak: 'I like to relax in the living room.',
      },
    ],
  },
};

function normalizeHomeSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function matchesHomeStep(step: number, userText: string): boolean {
  const t = normalizeHomeSpeech(userText);
  if (!t) return false;
  switch (step) {
    case 1:
      return (
        /\bi live in\b/.test(t) &&
        (/\ban apartment\b/.test(t) || /\ba house\b/.test(t))
      );
    case 2:
      return (
        /\bi live with my family\b/.test(t) ||
        /\bi live with friends\b/.test(t) ||
        /\bi live alone\b/.test(t)
      );
    case 3:
      // Soft-accept "I like to relax in (the) …"
      return (
        /\bi like to relax in\b/.test(t) &&
        t.replace(/\bi like to relax in (the )?\b/, '').trim().length >= 3
      );
    case 4:
      return /\bi live in an apartment\b/.test(t);
    case 5:
      return /\bi live with my family\b/.test(t);
    case 6:
      return /\bi like to relax in the living room\b/.test(t);
    default:
      return false;
  }
}

export function scoreHomeStep(step: number, userText: string): ChoiceStepTier {
  return createBoardChoiceScorer(
    normalizeHomeSpeech,
    (s) => HOME_BOARDS[s] ?? null,
    matchesHomeStep,
  )(step, userText);
}

/** How many Home speak steps are cleared (0–6). */
export function homeLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  return computeThreeTierChoiceProgress(history, 6, scoreHomeStep);
}

function homeBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (t.includes('ห้องนั่งเล่น') || t.includes('ข้อสุดท้าย')) return 6;
  if (t.includes('อยู่กับครอบครัว')) return 5;
  if (t.includes('อพาร์ตเมนต์') && t.includes('ทบทวน')) return 4;
  if (
    t.includes('มุมโปรด') ||
    t.includes('ชอบไปนั่งชิล') ||
    t.includes('favorite place to relax')
  ) {
    return 3;
  }
  if (
    t.includes('พักอยู่กับใคร') ||
    t.includes('อาศัยอยู่กับใคร') ||
    t.includes('who do you live with')
  ) {
    return 2;
  }
  if (
    t.includes('พักอยู่อาศัยแบบไหน') ||
    t.includes('อาศัยอยู่แบบไหน') ||
    t.includes('what kind of place do you live in') ||
    t.includes('ที่อยู่อาศัย')
  ) {
    return 1;
  }
  return null;
}

/**
 * Pin Home guidedSpeaking boards (Turns 1–6).
 */
export function forceHomeGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_home') return null;
  if (current.isTaskComplete) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      homeLessonProgress,
      6,
      scoreHomeStep,
    )
  ) {
    return null;
  }

  const progress = homeLessonProgress(history);
  if (progress >= 6) return null;

  const fromText = homeBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress >= 0 && progress <= 5) step = progress + 1;
    else return null;
  }

  if (step < 1 || step > 6) return null;
  if (nextTurn < 1 && step !== 1) return null;

  const board = HOME_BOARDS[step];
  if (!board) return null;

  const stemOk =
    board.stem.trim() === ''
      ? !(current.guidedSpeaking?.stem?.trim())
      : (current.guidedSpeaking?.stem
          ?.toLowerCase()
          .includes(board.stem.toLowerCase().slice(0, 8)) ??
        false);
  const isSingleHint = board.options.length === 1;
  const optionsOk = isSingleHint
    ? (current.guidedSpeaking?.options?.length ?? 0) < 2 &&
      (current.guidedSpeaking?.emoji === board.options[0].emoji ||
        current.guidedSpeaking?.speak === board.options[0].speak)
    : (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: isSingleHint
      ? {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label ? { label: first.label } : {}),
        }
      : {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label ? { label: first.label } : {}),
          options,
        },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After Home mini quiz → Celebrate.
 */
export function forceHomeCelebrateIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: true;
} | null {
  if (lessonId !== 'ee_about_me_home') return null;
  if (homeLessonProgress(history) < 6) return null;

  const body =
    'สุดยอดครับ! 🎉 วันนี้คุณสามารถพูดเรื่องบ้านของตัวเองได้แล้ว ทั้งที่พัก คนที่อาศัยอยู่ด้วย และมุมโปรดในบ้าน เก่งมากครับ! 🍌';

  const raw = (current.textEn ?? '').trim();
  const praiseOk = /^(เยี่ยม|เก่งมาก|สุดยอด|ดีมาก|ยอดเยี่ยม)/u.test(raw);
  const textEn =
    current.isTaskComplete && praiseOk && raw.length > 30 ? raw : body;

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: true,
  };
}

export type WorkSchoolMode = 'work' | 'study';

/** Work & School 1.4 — Turn 1 activity board (also used on opening). */
export const WORK_SCHOOL_ACTIVITY_GUIDED_SPEAKING = {
  stem: 'I...',
  options: [
    { emoji: '💼', label: 'Work', speak: 'I work.' },
    { emoji: '📚', label: 'Study', speak: 'I study.' },
  ],
} as const;

export function workSchoolOpeningText(learnerFirstName: string): string {
  const name = learnerFirstName.trim() || 'เพื่อน';
  return `สวัสดีครับ ${name}! วันนี้เรามาคุยเรื่องชีวิตการทำงานหรือการเรียนกันบ้างดีกว่า 💼 ตอนนี้คุณทำงานหรือเรียนอยู่ครับ? Do you work or study?`;
}

function workSchoolLocationBoard(mode: WorkSchoolMode): {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
} {
  if (mode === 'study') {
    return {
      textEn:
        'โอ้ ยอดเยี่ยมเลยครับ! แล้วปกติคุณเรียนที่ไหนเป็นหลักครับ? Where do you study?',
      stem: 'I study at...',
      expectedSpeech: 'I study at school.',
      options: [
        { emoji: '🏢', label: 'School', speak: 'I study at school.' },
        { emoji: '🏠', label: 'Home', speak: 'I study at home.' },
      ],
    };
  }
  return {
    textEn:
      'โอ้ ยอดเยี่ยมเลยครับ! แล้วปกติคุณทำงานที่ไหนเป็นหลักครับ? Where do you work?',
    stem: 'I work at...',
    expectedSpeech: 'I work at an office.',
    options: [
      { emoji: '🏢', label: 'Office', speak: 'I work at an office.' },
      { emoji: '🏠', label: 'Home', speak: 'I work at home.' },
    ],
  };
}

function workSchoolFeelingBoard(mode: WorkSchoolMode): {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
} {
  if (mode === 'study') {
    return {
      textEn:
        'แล้วบรรยากาศการเรียนของคุณเป็นยังไงบ้างครับช่วงนี้? How is your school?',
      stem: 'School is...',
      expectedSpeech: 'School is fun.',
      options: [
        { emoji: '💼', label: 'Busy', speak: 'School is busy.' },
        { emoji: '🎉', label: 'Fun', speak: 'School is fun.' },
        { emoji: '☕', label: 'Relaxing', speak: 'School is relaxing.' },
      ],
    };
  }
  return {
    textEn:
      'แล้วบรรยากาศการทำงานของคุณเป็นยังไงบ้างครับช่วงนี้? How is your work?',
    stem: 'My work is...',
    expectedSpeech: 'My work is busy.',
    options: [
      { emoji: '💼', label: 'Busy', speak: 'My work is busy.' },
      { emoji: '🎉', label: 'Fun', speak: 'My work is fun.' },
      { emoji: '☕', label: 'Relaxing', speak: 'My work is relaxing.' },
    ],
  };
}

const WORK_SCHOOL_COMBO_BOARD = {
  textEn:
    'เก่งมากครับ! ถึงบางครั้งชีวิตจะยุ่งหรือเหนื่อยไปบ้าง แต่เราก็ยังหามุมสนุกกับมันได้เนอะ 😊 มาลองเชื่อมสองประโยคเข้าด้วยกันดูครับ พูดตามผมนะ... My work is busy, but I enjoy it.',
  stem: 'My work is busy, but...',
  expectedSpeech: 'My work is busy, but I enjoy it.',
  options: [
    {
      emoji: '💼',
      label: 'but I enjoy it',
      speak: 'My work is busy, but I enjoy it.',
    },
  ],
};

function normalizeWorkSchoolSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function extractWorkSchoolMode(
  history: Array<{ speaker: string; textEn?: string }>,
): WorkSchoolMode | null {
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizeWorkSpeech(turn.textEn ?? '');
    if (!t) continue;
    if (t === 'i study' || /^i study\b/.test(t)) return 'study';
    if (t === 'i work' || /^i work\b/.test(t) && !/\bat\b/.test(t)) {
      return 'work';
    }
  }
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizeWorkSchoolSpeech(turn.textEn ?? '');
    if (/\bi study at\b/.test(t) || /\bschool is\b/.test(t)) return 'study';
    if (/\bi work at\b/.test(t) || /\bmy work is\b/.test(t)) return 'work';
  }
  return 'work';
}

function normalizeWorkSpeech(userText: string): string {
  return normalizeWorkSchoolSpeech(userText);
}

function matchesWorkSchoolStep(
  step: number,
  userText: string,
  mode: WorkSchoolMode,
): boolean {
  const t = normalizeWorkSchoolSpeech(userText);
  if (!t) return false;
  switch (step) {
    case 1:
      return t === 'i work' || t === 'i study';
    case 2:
      if (mode === 'study') {
        return /\bi study at\b/.test(t) && t.length > 12;
      }
      return /\bi work at\b/.test(t) && t.length > 11;
    case 3:
      if (mode === 'study') {
        return (
          /\bschool is\b/.test(t) &&
          /[a-z]{3,}/.test(t.replace(/\bschool is\b/, ''))
        );
      }
      return (
        /\bmy work is\b/.test(t) &&
        /[a-z]{3,}/.test(t.replace(/\bmy work is\b/, ''))
      );
    case 4:
      return /\bmy work is busy\b/.test(t) && /\bbut\b/.test(t) && /\benjoy\b/.test(t);
    default:
      return false;
  }
}

export function scoreWorkSchoolStepForHistory(
  history: Array<{ speaker: string; textEn?: string }>,
  step: number,
  userText: string,
): ChoiceStepTier {
  const mode = extractWorkSchoolMode(history) ?? 'work';
  return createBoardChoiceScorer(
    normalizeWorkSchoolSpeech,
    (s) => workSchoolBoardForStep(s, history),
    (s, t) => matchesWorkSchoolStep(s, t, mode),
  )(step, userText);
}

/** How many Work & School speak steps are cleared (0–4). */
export function workSchoolLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  const score = (step: number, text: string) =>
    scoreWorkSchoolStepForHistory(history, step, text);
  return computeThreeTierChoiceProgress(history, 4, score);
}

function workSchoolBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (
    t.includes('my work is busy, but') ||
    (t.includes('เชื่อมสองประโยค') && t.includes('enjoy'))
  ) {
    return 4;
  }
  if (t.includes('บรรยากาศ') || t.includes('how is your work') || t.includes('how is your school')) {
    return 3;
  }
  if (
    t.includes('ทำงานที่ไหน') ||
    t.includes('เรียนที่ไหน') ||
    t.includes('where do you work') ||
    t.includes('where do you study')
  ) {
    return 2;
  }
  if (
    t.includes('ทำงานหรือเรียน') ||
    t.includes('do you work or study')
  ) {
    return 1;
  }
  return null;
}

/**
 * Pin Work & School guidedSpeaking boards (Turns 1–4).
 */
export function forceWorkSchoolGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_work_school') return null;
  if (current.isTaskComplete) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      workSchoolLessonProgress,
      4,
      (step, text) => scoreWorkSchoolStepForHistory(history, step, text),
    )
  ) {
    return null;
  }

  const progress = workSchoolLessonProgress(history);
  if (progress >= 4) return null;

  const mode = extractWorkSchoolMode(history) ?? 'work';
  const fromText = workSchoolBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress >= 0 && progress <= 3) step = progress + 1;
    else return null;
  }

  if (step < 1 || step > 4) return null;
  if (nextTurn < 1 && step !== 1) return null;

  let board: {
    textEn: string;
    stem: string;
    expectedSpeech: string;
    options: Array<{ emoji: string; label: string; speak: string }>;
  };
  if (step === 1) {
    board = {
      textEn: current.textEn?.trim() || workSchoolOpeningText(''),
      stem: WORK_SCHOOL_ACTIVITY_GUIDED_SPEAKING.stem,
      expectedSpeech: 'I work.',
      options: WORK_SCHOOL_ACTIVITY_GUIDED_SPEAKING.options.map((o) => ({
        ...o,
      })),
    };
    if (current.textEn?.trim()) {
      board = { ...board, textEn: current.textEn.trim() };
    }
  } else if (step === 2) {
    board = workSchoolLocationBoard(mode);
  } else if (step === 3) {
    board = workSchoolFeelingBoard(mode);
  } else {
    board = WORK_SCHOOL_COMBO_BOARD;
  }

  const isSingleHint = board.options.length === 1;
  const stemOk =
    current.guidedSpeaking?.stem
      ?.toLowerCase()
      .includes(board.stem.toLowerCase().slice(0, 8)) ?? false;
  const optionsOk = isSingleHint
    ? (current.guidedSpeaking?.options?.length ?? 0) < 2 &&
      (current.guidedSpeaking?.speak === board.options[0].speak ||
        current.guidedSpeaking?.emoji === board.options[0].emoji)
    : (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: isSingleHint
      ? {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label ? { label: first.label } : {}),
        }
      : {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label ? { label: first.label } : {}),
          options,
        },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After Work & School combo → Celebrate.
 */
export function forceWorkSchoolCelebrateIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  learnerFirstName: string,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: true;
} | null {
  if (lessonId !== 'ee_about_me_work_school') return null;
  if (workSchoolLessonProgress(history) < 4) return null;

  const name = learnerFirstName.trim() || 'เพื่อน';
  const body = `สุดยอดครับ ${name}! 🎉 วันนี้คุณบอกได้ทั้งทำงานหรือเรียน ที่ทำอยู่ และความรู้สึก — แถมเชื่อมประโยคด้วย but ได้แล้วครับ! 🍌`;

  const raw = (current.textEn ?? '').trim();
  const praiseOk = /^(เยี่ยม|เก่งมาก|สุดยอด|ดีมาก|ยอดเยี่ยม)/u.test(raw);
  const textEn =
    current.isTaskComplete && praiseOk && raw.length > 30 ? raw : body;

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: true,
  };
}

export type HobbiesActivity = 'watch_movies' | 'listen_music' | 'exercise';

const HOBBIES_ACTIVITY_META: Record<
  HobbiesActivity,
  { th: string; en: string; phrase: string }
> = {
  watch_movies: {
    th: 'ดูหนัง',
    en: 'watch movies',
    phrase: 'watch movies',
  },
  listen_music: {
    th: 'ฟังเพลง',
    en: 'listen to music',
    phrase: 'listen to music',
  },
  exercise: {
    th: 'ออกกำลังกาย',
    en: 'exercise',
    phrase: 'exercise',
  },
};

/** Hobbies 1.5 — Turn 1 hobby board (also used on opening). */
export const HOBBIES_HOBBY_GUIDED_SPEAKING = {
  stem: 'I...',
  options: [
    { emoji: '🎬', label: 'Watch movies', speak: 'I watch movies.' },
    { emoji: '🎵', label: 'Listen to music', speak: 'I listen to music.' },
    { emoji: '💪', label: 'Exercise', speak: 'I exercise.' },
  ],
} as const;

export function hobbiesOpeningText(): string {
  return 'วันนี้เรามาคุยเรื่องเวลาว่างและงานอดิเรกกันดีกว่า 🎨✨ ปกติแล้วเวลาว่างคุณชอบทำอะไรครับ? What do you like to do in your free time?';
}

function hobbiesFrequencyBoard(activity: HobbiesActivity): {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
} {
  const meta = HOBBIES_ACTIVITY_META[activity];
  return {
    textEn: `น่าสนใจมากเลยครับ! แล้วคุณ${meta.th}บ่อยแค่ไหนครับ? How often do you ${meta.en}?`,
    stem: 'I [frequency]...',
    expectedSpeech: `I often ${meta.phrase}.`,
    options: [
      {
        emoji: '⚡',
        label: 'Always',
        speak: `I always ${meta.phrase}.`,
      },
      {
        emoji: '📅',
        label: 'Usually',
        speak: `I usually ${meta.phrase}.`,
      },
      {
        emoji: '🔁',
        label: 'Often',
        speak: `I often ${meta.phrase}.`,
      },
      {
        emoji: '🎲',
        label: 'Sometimes',
        speak: `I sometimes ${meta.phrase}.`,
      },
    ],
  };
}

const HOBBIES_WEEKEND_BOARD = {
  textEn:
    'เยี่ยมเลยครับ 😊 ถ้าเป็นเวลาว่าง เรามักจะขึ้นต้นประโยคว่า In my free time... แต่ถ้าพูดถึงวันเสาร์–อาทิตย์ เราจะใช้ On weekends... ครับ! เดี๋ยวเรามาลองใช้จริงกันเลยครับ! แล้วอย่างวันเสาร์–อาทิตย์ คุณมักจะทำอะไรครับ? 🏃🎬 What do you usually do on weekends?',
  stem: 'On weekends, I usually...',
  expectedSpeech: 'On weekends, I usually exercise.',
  options: [
    {
      emoji: '🎬',
      label: 'Watch movies',
      speak: 'On weekends, I usually watch movies.',
    },
    {
      emoji: '🎵',
      label: 'Listen to music',
      speak: 'On weekends, I usually listen to music.',
    },
    {
      emoji: '💪',
      label: 'Exercise',
      speak: 'On weekends, I usually exercise.',
    },
  ],
};

const HOBBIES_QUIZ_USUALLY_BOARD = {
  textEn:
    "เก่งมากครับ! 👏 เดี๋ยวเรามาทดสอบความจำสั้นๆ กันนะ คำว่า 'เป็นประจำ' ในภาษาอังกฤษคือคำไหนครับ? How do you say 'เป็นประจำ' in English?",
  stem: 'เป็นประจำ =...',
  expectedSpeech: 'Usually.',
  options: [
    { emoji: '⚡', label: 'Always', speak: 'Always.' },
    { emoji: '📅', label: 'Usually', speak: 'Usually.' },
    { emoji: '🔁', label: 'Often', speak: 'Often.' },
    { emoji: '🎲', label: 'Sometimes', speak: 'Sometimes.' },
  ],
};

const HOBBIES_QUIZ_SOMETIMES_BOARD = {
  textEn:
    "แม่นยำมากครับ! แล้วคำว่า 'บางครั้ง' ล่ะครับ ภาษาอังกฤษคือคำไหน? And how about 'บางครั้ง'?",
  stem: 'บางครั้ง =...',
  expectedSpeech: 'Sometimes.',
  options: [
    { emoji: '⚡', label: 'Always', speak: 'Always.' },
    { emoji: '📅', label: 'Usually', speak: 'Usually.' },
    { emoji: '🔁', label: 'Often', speak: 'Often.' },
    { emoji: '🎲', label: 'Sometimes', speak: 'Sometimes.' },
  ],
};

function normalizeHobbiesSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function extractHobbiesActivity(
  history: Array<{ speaker: string; textEn?: string }>,
): HobbiesActivity | null {
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizeHobbiesSpeech(turn.textEn ?? '');
    if (!t) continue;
    // Prefer Turn-1 style: "I watch movies." / "I listen to music." / "I exercise."
    if (t === 'i watch movies' || /\bwatch movies\b/.test(t)) {
      return 'watch_movies';
    }
    if (t === 'i listen to music' || /\blisten to music\b/.test(t)) {
      return 'listen_music';
    }
    if (t === 'i exercise' || /\bexercise\b/.test(t)) return 'exercise';
  }
  return 'watch_movies';
}

function matchesHobbiesStep(
  step: number,
  userText: string,
  activity: HobbiesActivity,
): boolean {
  const t = normalizeHobbiesSpeech(userText);
  if (!t) return false;
  const phrase = HOBBIES_ACTIVITY_META[activity].phrase;
  switch (step) {
    case 1:
      // Board hobbies OR any clear "I …" free-time activity
      if (
        t === 'i watch movies' ||
        t === 'i listen to music' ||
        t === 'i exercise'
      ) {
        return true;
      }
      return (
        /^i (?!am\b|was\b|will\b|can\b|like\b)[\w][\w\s'-]{1,40}$/.test(t) &&
        !/\balways|usually|often|sometimes\b/.test(t)
      );
    case 2:
      if (
        new RegExp(
          `^i (always|usually|often|sometimes) ${phrase.replace(/\s+/g, '\\s+')}$`,
        ).test(t)
      ) {
        return true;
      }
      // Soft: I usually/often/… + any activity
      return /^i (always|usually|often|sometimes) [\w][\w\s'-]{1,40}$/.test(t);
    case 3:
      if (
        /\bon weekends,?\s*i usually\b/.test(t) &&
        (/\bwatch movies\b/.test(t) ||
          /\blisten to music\b/.test(t) ||
          /\bexercise\b/.test(t))
      ) {
        return true;
      }
      return /\bon weekends,?\s*i usually\b/.test(t) && t.length > 22;
    case 4:
      return t === 'usually';
    case 5:
      return t === 'sometimes';
    default:
      return false;
  }
}

/** How many Hobbies speak steps are cleared (0–5).
 * Mini Quiz steps 4–5: soft-advance after 2 failed attempts.
 */
export function hobbiesBoardForStep(
  step: number,
  history: Array<{ speaker: string; textEn?: string }>,
): ForcedGuidedBoard | null {
  const activity = extractHobbiesActivity(history) ?? 'watch_movies';
  const hobbyPhrase = HOBBIES_ACTIVITY_META[activity].phrase;
  if (step === 1) {
    return {
      textEn: '',
      stem: HOBBIES_HOBBY_GUIDED_SPEAKING.stem,
      expectedSpeech: `I ${hobbyPhrase}.`,
      options: HOBBIES_HOBBY_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
  }
  if (step === 2) return hobbiesFrequencyBoard(activity);
  if (step === 3) return HOBBIES_WEEKEND_BOARD;
  if (step === 4) return HOBBIES_QUIZ_USUALLY_BOARD;
  if (step === 5) return HOBBIES_QUIZ_SOMETIMES_BOARD;
  return null;
}

export function scoreHobbiesStepForHistory(
  history: Array<{ speaker: string; textEn?: string }>,
  step: number,
  userText: string,
): ChoiceStepTier {
  const activity = extractHobbiesActivity(history) ?? 'watch_movies';
  return createBoardChoiceScorer(
    normalizeHobbiesSpeech,
    (s) => hobbiesBoardForStep(s, history),
    (s, t) => matchesHobbiesStep(s, t, activity),
  )(step, userText);
}

export function hobbiesLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  const score = (step: number, text: string) =>
    scoreHobbiesStepForHistory(history, step, text);
  return computeThreeTierChoiceProgress(history, 5, score);
}

function hobbiesBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (t.includes('บางครั้ง') && (t.includes('ล่ะ') || t.includes('and how about'))) {
    return 5;
  }
  if (
    t.includes('เป็นประจำ') ||
    (t.includes('how do you say') && t.includes('เป็นประจำ'))
  ) {
    return 4;
  }
  if (
    t.includes('on weekends') ||
    t.includes('วันเสาร์') ||
    t.includes('in my free time')
  ) {
    return 3;
  }
  if (t.includes('บ่อยแค่ไหน') || t.includes('how often')) {
    return 2;
  }
  if (
    t.includes('เวลาว่างคุณชอบทำอะไร') ||
    t.includes('what do you like to do in your free time')
  ) {
    return 1;
  }
  return null;
}

/**
 * Pin Hobbies guidedSpeaking boards (Turns 1–5).
 */
export function forceHobbiesGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_hobbies') return null;
  if (current.isTaskComplete) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      hobbiesLessonProgress,
      5,
      (step, text) => scoreHobbiesStepForHistory(history, step, text),
    )
  ) {
    return null;
  }

  const progress = hobbiesLessonProgress(history);
  if (progress >= 5) return null;

  const activity = extractHobbiesActivity(history) ?? 'watch_movies';
  const fromText = hobbiesBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress >= 0 && progress <= 4) step = progress + 1;
    else return null;
  }

  if (step < 1 || step > 5) return null;
  if (nextTurn < 1 && step !== 1) return null;

  let board: {
    textEn: string;
    stem: string;
    expectedSpeech: string;
    options: Array<{ emoji: string; label: string; speak: string }>;
  };
  if (step === 1) {
    board = {
      textEn: current.textEn?.trim() || hobbiesOpeningText(),
      stem: HOBBIES_HOBBY_GUIDED_SPEAKING.stem,
      expectedSpeech: 'I watch movies.',
      options: HOBBIES_HOBBY_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
    if (current.textEn?.trim()) {
      board = { ...board, textEn: current.textEn.trim() };
    }
  } else if (step === 2) {
    board = hobbiesFrequencyBoard(activity);
  } else if (step === 3) {
    board = {
      textEn: HOBBIES_WEEKEND_BOARD.textEn,
      stem: HOBBIES_WEEKEND_BOARD.stem,
      expectedSpeech: HOBBIES_WEEKEND_BOARD.expectedSpeech,
      options: HOBBIES_WEEKEND_BOARD.options.map((o) => ({ ...o })),
    };
  } else if (step === 4) {
    board = {
      textEn: HOBBIES_QUIZ_USUALLY_BOARD.textEn,
      stem: HOBBIES_QUIZ_USUALLY_BOARD.stem,
      expectedSpeech: HOBBIES_QUIZ_USUALLY_BOARD.expectedSpeech,
      options: HOBBIES_QUIZ_USUALLY_BOARD.options.map((o) => ({ ...o })),
    };
  } else {
    board = {
      textEn: HOBBIES_QUIZ_SOMETIMES_BOARD.textEn,
      stem: HOBBIES_QUIZ_SOMETIMES_BOARD.stem,
      expectedSpeech: HOBBIES_QUIZ_SOMETIMES_BOARD.expectedSpeech,
      options: HOBBIES_QUIZ_SOMETIMES_BOARD.options.map((o) => ({ ...o })),
    };
  }

  const stemOk =
    current.guidedSpeaking?.stem
      ?.toLowerCase()
      .includes(board.stem.toLowerCase().slice(0, 8)) ?? false;
  const optionsOk =
    (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: {
      stem: board.stem,
      emoji: first.emoji,
      speak: first.speak,
      ...(first.label ? { label: first.label } : {}),
      options,
    },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After Hobbies mini quiz → Celebrate.
 */
export function forceHobbiesCelebrateIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  learnerFirstName: string,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: true;
} | null {
  if (lessonId !== 'ee_about_me_hobbies') return null;
  if (hobbiesLessonProgress(history) < 5) return null;

  const name = learnerFirstName.trim() || 'เพื่อน';
  const body = `สุดยอดครับ ${name}! 🎉 วันนี้คุณบอกงานอดิเรก ความถี่ และสิ่งที่มักทำวันเสาร์–อาทิตย์ได้แล้ว — เก่งมากครับ! 🍌`;

  const raw = (current.textEn ?? '').trim();
  const praiseOk = /^(เยี่ยม|เก่งมาก|สุดยอด|ดีมาก|ยอดเยี่ยม)/u.test(raw);
  const textEn =
    current.isTaskComplete && praiseOk && raw.length > 30 ? raw : body;

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: true,
  };
}

export type PetsAnimal = 'cat' | 'dog';

/** Pets 1.6 — Turn 1 pet board (also used on opening). */
export const PETS_CHOICE_GUIDED_SPEAKING = {
  stem: 'I have a...',
  options: [
    { emoji: '🐱', label: 'Cat', speak: 'I have a cat.' },
    { emoji: '🐶', label: 'Dog', speak: 'I have a dog.' },
  ],
} as const;

export function petsOpeningText(learnerFirstName: string): string {
  const name = learnerFirstName.trim() || 'เพื่อน';
  return `สวัสดีครับ ${name}! ในโลกนี้มีคน 2 ประเภทครับ... ทาสแมว ทาสหมา หรือทาสความสงบที่ไม่เลี้ยงอะไรเลย! 🐱🐶 วันนี้มาคุยเรื่อง pets (สัตว์เลี้ยง) กันครับ! คุณอยู่สายไหนครับ? Do you have any pets?`;
}

function petsDescribeBoard(animal: PetsAnimal): {
  textEn: string;
  advanceQuestionEn?: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
} {
  if (animal === 'dog') {
    return {
      textEn:
        'น่ารักมากครับ! แล้วน้องสัตว์เลี้ยงของคุณตัวนี้เป็นยังไงบ้างครับ?',
      advanceQuestionEn: 'What is your dog like?',
      stem: 'My dog is very...',
      expectedSpeech: 'My dog is very friendly.',
      options: [
        { emoji: '🥰', label: 'Cute', speak: 'My dog is very cute.' },
        {
          emoji: '🤝',
          label: 'Friendly',
          speak: 'My dog is very friendly.',
        },
      ],
    };
  }
  return {
    textEn:
      'น่ารักมากครับ! แล้วน้องสัตว์เลี้ยงของคุณตัวนี้เป็นยังไงบ้างครับ?',
    advanceQuestionEn: 'What is your cat like?',
    stem: 'My cat is very...',
    expectedSpeech: 'My cat is very cute.',
    options: [
      { emoji: '🥰', label: 'Cute', speak: 'My cat is very cute.' },
      {
        emoji: '🤝',
        label: 'Friendly',
        speak: 'My cat is very friendly.',
      },
    ],
  };
}

export const PETS_TIP_TEXT =
  "เก่งมากครับ! จำง่ายๆ เลยนะ 😊 ถ้าเป็นสัตว์เลี้ยงของเรา ให้ใช้ My เช่น My dog is friendly. แต่ถ้าเป็นของเพื่อน ให้ใช้ Your เช่น Your cat is cute. เดี๋ยวเรามาลองใช้จริงกันครับ! Use 'My' for your pet, and 'Your' for your friend's pet.";

const PETS_YOUR_BOARD = {
  textEn:
    "แล้วถ้าเราจะเอ่ยปากชมสัตว์เลี้ยงของเพื่อนบ้าง อยากลองชมตัวไหนดีครับ? 🐶🐱 How would you compliment your friend's pet?",
  stem: 'Your ... is very...',
  expectedSpeech: 'Your dog is very friendly.',
  options: [
    {
      emoji: '🐶',
      label: 'Dog',
      speak: 'Your dog is very friendly.',
    },
    {
      emoji: '🐱',
      label: 'Cat',
      speak: 'Your cat is very cute.',
    },
  ],
};

function normalizePetsSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function isPetsContinueTurn(textEn: string): boolean {
  const t = (textEn ?? '').trim().toLowerCase();
  return (
    t === '(tapped continue)' ||
    t === '[continue]' ||
    t.startsWith('(tapped continue')
  );
}

export function extractPetsAnimal(
  history: Array<{ speaker: string; textEn?: string }>,
): PetsAnimal {
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizePetsSpeech(turn.textEn ?? '');
    if (!t || isPetsContinueTurn(t)) continue;
    if (/\bcat\b/.test(t)) return 'cat';
    if (/\bdog\b/.test(t)) return 'dog';
  }
  return 'dog';
}

export type PetsAdjective = 'cute' | 'friendly';

export function extractPetsAdjective(
  history: Array<{ speaker: string; textEn?: string }>,
  animal: PetsAnimal,
): PetsAdjective {
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizePetsSpeech(turn.textEn ?? '');
    if (!t || isPetsContinueTurn(t)) continue;
    if (/\bcute\b/.test(t)) return 'cute';
    if (/\bfriendly\b/.test(t)) return 'friendly';
  }
  return animal === 'dog' ? 'friendly' : 'cute';
}

function petsComboBoard(
  animal: PetsAnimal,
  adjective: PetsAdjective,
): {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
} {
  const speak = `I have a ${animal}. My ${animal} is very ${adjective}.`;
  return {
    textEn:
      'คราวนี้ลองนำมารวมกัน ค่อยๆ พูด 2 ประโยคติดกันดูนะครับ!',
    stem: 'I have a...',
    expectedSpeech: speak,
    options: [
      {
        emoji: animal === 'dog' ? '🐶' : '🐱',
        label: '2 sentences',
        speak,
      },
    ],
  };
}

function matchesPetsSpeakStep(
  step: number,
  userText: string,
  animal: PetsAnimal,
  adjective: PetsAdjective,
): boolean {
  const t = normalizePetsSpeech(userText);
  if (!t || isPetsContinueTurn(t)) return false;
  switch (step) {
    case 1:
      // Soft-accept any "I have a/an …" pet (board or free)
      return /^i have (a|an) [\w][\w\s'-]{1,30}$/.test(t);
    case 2:
      // Soft-accept "My [pet] is very [adj]"
      return /^my [\w][\w\s'-]{0,20} is very [a-z][a-z'-]{1,20}$/.test(t);
    case 3:
      return (
        t === 'your dog is very friendly' || t === 'your cat is very cute'
      );
    case 4: {
      // Accept exact combo or close (optional period / one breath).
      const expected = `i have a ${animal}. my ${animal} is very ${adjective}`;
      const compact = t.replace(/\./g, '').replace(/\s+/g, ' ').trim();
      const expectedCompact = expected.replace(/\./g, '').replace(/\s+/g, ' ');
      return (
        t === expected ||
        compact === expectedCompact ||
        (/\bi have (a|an) \w+\b/.test(t) &&
          /\bmy \w+ is very \w+\b/.test(t))
      );
    }
    default:
      return false;
  }
}

/** Speak steps cleared (0–4): have → describe → Your → combo. */
export function petsBoardForStep(
  step: number,
  animal: PetsAnimal,
  adjective: PetsAdjective,
): ForcedGuidedBoard | null {
  if (step === 1) {
    return {
      textEn: '',
      stem: PETS_CHOICE_GUIDED_SPEAKING.stem,
      expectedSpeech: animal === 'dog' ? 'I have a dog.' : 'I have a cat.',
      options: PETS_CHOICE_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
  }
  if (step === 2) return petsDescribeBoard(animal);
  if (step === 3) {
    return {
      textEn: PETS_YOUR_BOARD.textEn,
      stem: PETS_YOUR_BOARD.stem,
      expectedSpeech: PETS_YOUR_BOARD.expectedSpeech,
      options: PETS_YOUR_BOARD.options.map((o) => ({ ...o })),
    };
  }
  if (step === 4) {
    return {
      textEn: '',
      stem: '',
      expectedSpeech: `I have a ${animal}. My ${animal} is very ${adjective}.`,
      options: [
        {
          emoji: '🐾',
          label: 'combo',
          speak: `I have a ${animal}. My ${animal} is very ${adjective}.`,
        },
      ],
    };
  }
  return null;
}

export function scorePetsStepForHistory(
  history: Array<{ speaker: string; textEn?: string }>,
  step: number,
  userText: string,
): ChoiceStepTier {
  const animal = extractPetsAnimal(history);
  const adjective = extractPetsAdjective(history, animal);
  return createBoardChoiceScorer(
    normalizePetsSpeech,
    (s) => petsBoardForStep(s, animal, adjective),
    (s, t) => matchesPetsSpeakStep(s, t, animal, adjective),
  )(step, userText);
}

export function petsLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  const filtered = history.filter((turn) => {
    if (turn.speaker !== 'user') return true;
    return !isPetsContinueTurn((turn.textEn ?? '').trim());
  });
  const score = (step: number, text: string) =>
    scorePetsStepForHistory(history, step, text);
  return computeThreeTierChoiceProgress(filtered, 4, score);
}

/** True when describe is done and learner has not yet tapped Continue after tip. */
function petsAwaitingTipContinue(
  history: Array<{ speaker: string; textEn?: string }>,
): boolean {
  if (petsLessonProgress(history) !== 2) return false;
  // After describe: if last user turn is continue, tip already passed.
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.speaker !== 'user') continue;
    const text = (turn.textEn ?? '').trim();
    if (!text) continue;
    return !isPetsContinueTurn(text);
  }
  return true;
}

function petsBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (
    t.includes('นำมารวมกัน') ||
    t.includes('2 ประโยค') ||
    t.includes('สองประโยค')
  ) {
    return 5;
  }
  if (
    t.includes('ชมสัตว์เลี้ยงของเพื่อน') ||
    t.includes("compliment your friend's pet") ||
    t.includes('your ... is very')
  ) {
    return 4;
  }
  if (
    (t.includes("use 'my'") || t.includes('ใช้ my') || t.includes('ให้ใช้ my')) &&
    (t.includes('your') || t.includes('ของเพื่อน'))
  ) {
    return 3;
  }
  if (
    t.includes('น้องสัตว์เลี้ยง') ||
    t.includes('เป็นยังไงบ้าง')
  ) {
    return 2;
  }
  if (
    t.includes('do you have any pets') ||
    t.includes('คุณอยู่สายไหน') ||
    t.includes('ทาสแมว')
  ) {
    return 1;
  }
  return null;
}

/**
 * Pin Pets guidedSpeaking boards (Turns 1, 2, 4, 5). Tip (3) handled separately.
 */
export function forcePetsGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_pets') return null;
  if (current.isTaskComplete) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      petsLessonProgress,
      4,
      (step, text) => scorePetsStepForHistory(history, step, text),
    )
  ) {
    return null;
  }

  const progress = petsLessonProgress(history);
  if (progress >= 4) return null;

  // During tip phase: do not pin speaking boards.
  if (petsAwaitingTipContinue(history)) return null;

  const animal = extractPetsAnimal(history);
  const adjective = extractPetsAdjective(history, animal);
  const fromText = petsBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress === 0) step = 1;
    else if (progress === 1) step = 2;
    else if (progress === 2) step = 4; // after tip continue → Your board
    else if (progress === 3) step = 5; // combo
    else return null;
  }

  // Tip is step 3 — skip here.
  if (step === 3) return null;
  if (step < 1 || step > 5) return null;
  if (nextTurn < 1 && step !== 1) return null;

  let board: {
    textEn: string;
    stem: string;
    expectedSpeech: string;
    options: Array<{ emoji: string; label: string; speak: string }>;
  };
  if (step === 1) {
    board = {
      textEn: current.textEn?.trim() || petsOpeningText(''),
      stem: PETS_CHOICE_GUIDED_SPEAKING.stem,
      expectedSpeech: 'I have a cat.',
      options: PETS_CHOICE_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
    if (current.textEn?.trim()) {
      board = { ...board, textEn: current.textEn.trim() };
    }
  } else if (step === 2) {
    board = petsDescribeBoard(animal);
  } else if (step === 4) {
    board = {
      textEn: PETS_YOUR_BOARD.textEn,
      stem: PETS_YOUR_BOARD.stem,
      expectedSpeech: PETS_YOUR_BOARD.expectedSpeech,
      options: PETS_YOUR_BOARD.options.map((o) => ({ ...o })),
    };
  } else {
    board = petsComboBoard(animal, adjective);
  }

  const isSingleHint = board.options.length === 1;
  const stemOk =
    current.guidedSpeaking?.stem
      ?.toLowerCase()
      .includes(board.stem.toLowerCase().slice(0, 8)) ?? false;
  const optionsOk = isSingleHint
    ? (current.guidedSpeaking?.options?.length ?? 0) < 2 &&
      (current.guidedSpeaking?.speak === board.options[0].speak ||
        current.guidedSpeaking?.emoji === board.options[0].emoji)
    : (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: isSingleHint
      ? {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label ? { label: first.label } : {}),
        }
      : {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label ? { label: first.label } : {}),
          options,
        },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After describe → My vs Your tip (listen-only).
 */
export function forcePetsTipIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_pets') return null;
  if (current.isTaskComplete) return null;
  if (!petsAwaitingTipContinue(history)) return null;

  const raw = (current.textEn ?? '').trim();
  const tipOk =
    /ให้ใช้ my/i.test(raw) ||
    /use ['']my['']/i.test(raw) ||
    (raw.includes('My dog is friendly') && raw.includes('Your cat is cute'));
  const textEn = resolveBoardTextEn(raw, PETS_TIP_TEXT, { withPraise: true });

  if (
    !current.expectsUserSpeech &&
    tipOk &&
    raw.length > 40
  ) {
    return null;
  }

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After Pets Your-compliment → Celebrate.
 */
export function forcePetsCelebrateIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  learnerFirstName: string,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: true;
} | null {
  if (lessonId !== 'ee_about_me_pets') return null;
  if (petsLessonProgress(history) < 4) return null;

  const name = learnerFirstName.trim() || 'เพื่อน';
  const body = `สุดยอดครับ ${name}! 🎉 วันนี้คุณบอกสัตว์เลี้ยง บรรยายด้วย My ชมด้วย Your และพูดสองประโยคติดกันได้แล้ว — เก่งมากครับ! 🍌`;

  const raw = (current.textEn ?? '').trim();
  const praiseOk = /^(เยี่ยม|เก่งมาก|สุดยอด|ดีมาก|ยอดเยี่ยม)/u.test(raw);
  const textEn =
    current.isTaskComplete && praiseOk && raw.length > 30 ? raw : body;

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: true,
  };
}

export type PeoplePerson = 'brother' | 'sister';
export type PeopleJob = 'engineer' | 'designer' | 'business_owner' | 'other';

const PEOPLE_JOB_META: Record<
  PeopleJob,
  { th: string; speakArticle: string; label: string; emoji: string }
> = {
  engineer: {
    th: 'วิศวกร',
    speakArticle: 'an engineer',
    label: 'Engineer',
    emoji: '👨‍💻',
  },
  designer: {
    th: 'ดีไซเนอร์',
    speakArticle: 'a designer',
    label: 'Designer',
    emoji: '🎨',
  },
  business_owner: {
    th: 'เจ้าของธุรกิจ',
    speakArticle: 'a business owner',
    label: 'Business owner',
    emoji: '💼',
  },
  other: {
    th: 'อาชีพนั้น',
    speakArticle: 'a professional',
    label: 'Job',
    emoji: '💼',
  },
};

/** People 1.7 — Turn 1 person board (also used on opening). */
export const PEOPLE_PERSON_GUIDED_SPEAKING = {
  stem: 'My...',
  options: [
    { emoji: '👦', label: 'My brother', speak: 'My brother.' },
    { emoji: '👧', label: 'My sister', speak: 'My sister.' },
  ],
} as const;

export function peopleOpeningText(learnerFirstName: string): string {
  const name = learnerFirstName.trim() || 'เพื่อน';
  return `สวัสดีครับ ${name}! วันนี้มาลองแนะนำสมาชิกในครอบครัวเป็นภาษาอังกฤษกันครับ 👨‍👩‍👧 คุณอยากพูดถึงใครก่อนดีครับ? Who would you like to talk about?`;
}

function peopleJobBoard(person: PeoplePerson): {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
} {
  if (person === 'sister') {
    return {
      textEn:
        'Sister! สรุปวันนี้เล่าเรื่องพี่สาว/น้องสาวนะครับ 👧 แล้วเธอทำงานอะไรเหรอครับ? What does she do?',
      stem: 'My sister is...',
      expectedSpeech: 'My sister is an engineer.',
      options: [
        {
          emoji: '👨‍💻',
          label: 'Engineer',
          speak: 'My sister is an engineer.',
        },
        {
          emoji: '🎨',
          label: 'Designer',
          speak: 'My sister is a designer.',
        },
        {
          emoji: '💼',
          label: 'Business owner',
          speak: 'My sister is a business owner.',
        },
      ],
    };
  }
  return {
    textEn:
      'Brother! สรุปวันนี้เล่าเรื่องพี่ชาย/น้องชายนะครับ 👦 แล้วเขาทำงานอะไรเหรอครับ? What does he do?',
    stem: 'My brother is...',
    expectedSpeech: 'My brother is an engineer.',
    options: [
      {
        emoji: '👨‍💻',
        label: 'Engineer',
        speak: 'My brother is an engineer.',
      },
      {
        emoji: '🎨',
        label: 'Designer',
        speak: 'My brother is a designer.',
      },
      {
        emoji: '💼',
        label: 'Business owner',
        speak: 'My brother is a business owner.',
      },
    ],
  };
}

function peoplePersonalityBoard(
  person: PeoplePerson,
  job: PeopleJob,
  jobPraiseLabel?: string,
): {
  textEn: string;
  stem: string;
  expectedSpeech: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
} {
  const jobTh =
    job === 'other' && jobPraiseLabel
      ? jobPraiseLabel
      : PEOPLE_JOB_META[job].th;
  if (person === 'sister') {
    return {
      textEn: `${jobTh}ซะด้วย เท่มากๆ ครับ! แล้วเธอเป็นคนสไตล์ไหน/นิสัยยังไงครับ? What is she like?`,
      stem: 'She is very...',
      expectedSpeech: 'She is very nice.',
      options: [
        { emoji: '😂', label: 'Funny', speak: 'She is very funny.' },
        { emoji: '😊', label: 'Nice', speak: 'She is very nice.' },
        { emoji: '😅', label: 'Busy', speak: 'She is very busy.' },
      ],
    };
  }
  return {
    textEn: `${jobTh}ซะด้วย เท่มากๆ ครับ! แล้วเขาเป็นคนสไตล์ไหน/นิสัยยังไงครับ? What is he like?`,
    stem: 'He is very...',
    expectedSpeech: 'He is very funny.',
    options: [
      { emoji: '😂', label: 'Funny', speak: 'He is very funny.' },
      { emoji: '😊', label: 'Nice', speak: 'He is very nice.' },
      { emoji: '😅', label: 'Busy', speak: 'He is very busy.' },
    ],
  };
}

const PEOPLE_QUIZ_HE_BOARD = {
  textEn:
    "เก่งมากครับ! 🎉 สังเกตไหมครับว่า เวลาเราพูดถึงผู้ชาย เราใช้ He และถ้าพูดถึงผู้หญิง เราจะใช้ She แทนชื่อได้เลยครับ! ก่อนจบบท ลองบอกหน่อยครับ ว่าถ้าจะบอกว่า 'เขาเป็นคนตลกมาก' จะพูดเป็นภาษาอังกฤษว่ายังไงครับ? 😊",
  stem: '',
  expectedSpeech: 'He is very funny.',
  options: [
    { emoji: '😂', label: '', speak: 'He is very funny.' },
  ],
};

const PEOPLE_QUIZ_SHE_BOARD = {
  textEn: "แล้วถ้าจะบอกว่า 'เธอเป็นคนใจดีมาก' ล่ะครับ?",
  stem: '',
  expectedSpeech: 'She is very nice.',
  options: [
    { emoji: '😊', label: '', speak: 'She is very nice.' },
  ],
};

function normalizePeopleSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function extractPeoplePerson(
  history: Array<{ speaker: string; textEn?: string }>,
): PeoplePerson {
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizePeopleSpeech(turn.textEn ?? '');
    if (!t) continue;
    if (t === 'my brother' || /^my brother is\b/.test(t)) return 'brother';
    if (t === 'my sister' || /^my sister is\b/.test(t)) return 'sister';
  }
  return 'brother';
}

export function extractPeopleJob(
  history: Array<{ speaker: string; textEn?: string }>,
): PeopleJob {
  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizePeopleSpeech(turn.textEn ?? '');
    if (!t) continue;
    if (/\ban engineer\b/.test(t) || /\bengineer\b/.test(t)) return 'engineer';
    if (/\ba designer\b/.test(t) || /\bdesigner\b/.test(t)) return 'designer';
    if (/\bbusiness owner\b/.test(t)) return 'business_owner';
    if (matchesPeopleJobAnswer(t)) return 'other';
  }
  return 'engineer';
}

/** Free-form job noun for Turn 3 praise (e.g. "student" from "She is a student"). */
export function extractPeopleJobPraiseLabel(
  history: Array<{ speaker: string; textEn?: string }>,
): string | undefined {
  const known = extractPeopleJob(history);
  if (known !== 'other') return PEOPLE_JOB_META[known].th;

  for (const turn of history) {
    if (turn.speaker !== 'user') continue;
    const t = normalizePeopleSpeech(turn.textEn ?? '');
    if (!t || !matchesPeopleJobAnswer(t)) continue;
    const m =
      t.match(
        /^(?:my (?:brother|sister)|he|she)(?:'s| is) (?:an? )?(.+)$/,
      ) ?? t.match(/\bworks as (?:an? )?(.+)$/);
    const raw = m?.[1]?.trim();
    if (!raw || raw.length > 40) continue;
    // Title-case first word for praise: "student" → "Student"
    return raw.replace(/^\w/, (c) => c.toUpperCase());
  }
  return undefined;
}

/** True when speech is a job answer (board choice OR any reasonable free job). */
function matchesPeopleJobAnswer(userText: string): boolean {
  const t = normalizePeopleSpeech(userText);
  if (!t) return false;
  // Personality / person-only answers are not jobs.
  if (/very (funny|nice|busy)\b/.test(t)) return false;
  if (t === 'my brother' || t === 'my sister') return false;
  // Board choices
  if (
    /^my (brother|sister) is (an engineer|a designer|a business owner)$/.test(t)
  ) {
    return true;
  }
  // Free job: My brother/sister / He/She is a/an …
  if (
    /^(my (brother|sister)|he|she)('s| is) (an? )?[\w][\w\s'-]{0,40}$/.test(t)
  ) {
    return true;
  }
  // works as …
  if (/\bworks as\b/.test(t)) return true;
  return false;
}

function matchesPeopleStep(step: number, userText: string): boolean {
  const t = normalizePeopleSpeech(userText);
  if (!t) return false;
  switch (step) {
    case 1:
      return t === 'my brother' || t === 'my sister';
    case 2:
      return matchesPeopleJobAnswer(t);
    case 3:
      // Soft-accept any clear He/She + adjective (board or free).
      return /^(he|she) is (very )?[a-z][a-z'-]{1,20}$/.test(t);
    case 4:
      return t === 'he is very funny';
    case 5:
      return t === 'she is very nice';
    default:
      return false;
  }
}

export function peopleBoardForStep(
  step: number,
  person: PeoplePerson,
  job: PeopleJob,
  jobPraiseLabel: string | undefined,
): ForcedGuidedBoard | null {
  if (step === 1) {
    return {
      textEn: '',
      stem: PEOPLE_PERSON_GUIDED_SPEAKING.stem,
      expectedSpeech: 'My brother.',
      options: PEOPLE_PERSON_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
  }
  if (step === 2) return peopleJobBoard(person);
  if (step === 3) {
    return peoplePersonalityBoard(person, job, jobPraiseLabel);
  }
  if (step === 4) return PEOPLE_QUIZ_HE_BOARD;
  if (step === 5) return PEOPLE_QUIZ_SHE_BOARD;
  return null;
}

export function scorePeopleStepForHistory(
  history: Array<{ speaker: string; textEn?: string }>,
  step: number,
  userText: string,
): ChoiceStepTier {
  const person = extractPeoplePerson(history);
  const job = extractPeopleJob(history);
  const jobPraiseLabel = extractPeopleJobPraiseLabel(history);
  return createBoardChoiceScorer(
    normalizePeopleSpeech,
    (s) => peopleBoardForStep(s, person, job, jobPraiseLabel),
    matchesPeopleStep,
  )(step, userText);
}

/** Speak steps cleared (0–5). Quiz 4–5 soft-advance after 2 failed attempts. */
export function peopleLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  const score = (step: number, text: string) =>
    scorePeopleStepForHistory(history, step, text);
  return computeThreeTierChoiceProgress(history, 5, score);
}

function peopleBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (t.includes('เธอเป็นคนใจดีมาก') || t.includes('ใจดีมาก')) return 5;
  if (
    t.includes('เขาเป็นคนตลกมาก') ||
    (t.includes('ใช้ he') && t.includes('ใช้ she')) ||
    (t.includes('เราใช้ he') && t.includes('she'))
  ) {
    return 4;
  }
  if (
    t.includes('นิสัยยังไง') ||
    t.includes('สไตล์ไหน') ||
    t.includes('what is he like') ||
    t.includes('what is she like')
  ) {
    return 3;
  }
  if (
    t.includes('ทำงานอะไร') ||
    t.includes('what does he do') ||
    t.includes('what does she do')
  ) {
    return 2;
  }
  if (
    t.includes('who would you like to talk about') ||
    t.includes('อยากพูดถึงใคร')
  ) {
    return 1;
  }
  return null;
}

/**
 * Pin People guidedSpeaking boards (Turns 1–5).
 */
export function forcePeopleGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_people') return null;
  if (current.isTaskComplete) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      peopleLessonProgress,
      5,
      (step, text) => scorePeopleStepForHistory(history, step, text),
    )
  ) {
    return null;
  }

  const progress = peopleLessonProgress(history);
  if (progress >= 5) return null;

  const person = extractPeoplePerson(history);
  const job = extractPeopleJob(history);
  const jobPraiseLabel = extractPeopleJobPraiseLabel(history);
  const fromText = peopleBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress >= 0 && progress <= 4) step = progress + 1;
    else return null;
  }

  if (step < 1 || step > 5) return null;
  if (nextTurn < 1 && step !== 1) return null;

  let board: {
    textEn: string;
    stem: string;
    expectedSpeech: string;
    options: Array<{ emoji: string; label: string; speak: string }>;
  };
  if (step === 1) {
    board = {
      textEn: current.textEn?.trim() || peopleOpeningText(''),
      stem: PEOPLE_PERSON_GUIDED_SPEAKING.stem,
      expectedSpeech: 'My brother.',
      options: PEOPLE_PERSON_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
    if (current.textEn?.trim()) {
      board = { ...board, textEn: current.textEn.trim() };
    }
  } else if (step === 2) {
    board = peopleJobBoard(person);
  } else if (step === 3) {
    board = peoplePersonalityBoard(person, job, jobPraiseLabel);
  } else if (step === 4) {
    board = {
      textEn: PEOPLE_QUIZ_HE_BOARD.textEn,
      stem: PEOPLE_QUIZ_HE_BOARD.stem,
      expectedSpeech: PEOPLE_QUIZ_HE_BOARD.expectedSpeech,
      options: PEOPLE_QUIZ_HE_BOARD.options.map((o) => ({ ...o })),
    };
  } else {
    board = {
      textEn: PEOPLE_QUIZ_SHE_BOARD.textEn,
      stem: PEOPLE_QUIZ_SHE_BOARD.stem,
      expectedSpeech: PEOPLE_QUIZ_SHE_BOARD.expectedSpeech,
      options: PEOPLE_QUIZ_SHE_BOARD.options.map((o) => ({ ...o })),
    };
  }

  const isSingleHint = board.options.length === 1;
  const stemOk =
    board.stem.trim() === ''
      ? !(current.guidedSpeaking?.stem?.trim())
      : (current.guidedSpeaking?.stem
          ?.toLowerCase()
          .includes(board.stem.toLowerCase().slice(0, 8)) ??
        false);
  const wantEmojiOnly =
    isSingleHint &&
    board.stem.trim() === '' &&
    !(board.options[0].label?.trim());
  const labelOk =
    !wantEmojiOnly || !(current.guidedSpeaking?.label?.trim());
  const optionsOk = isSingleHint
    ? (current.guidedSpeaking?.options?.length ?? 0) < 2 &&
      (current.guidedSpeaking?.speak === board.options[0].speak ||
        current.guidedSpeaking?.emoji === board.options[0].emoji)
    : (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    labelOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: isSingleHint
      ? {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label?.trim() ? { label: first.label } : {}),
        }
      : {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label?.trim() ? { label: first.label } : {}),
          options,
        },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After People mini quiz → Celebrate.
 */
export function forcePeopleCelebrateIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  learnerFirstName: string,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: true;
} | null {
  if (lessonId !== 'ee_about_me_people') return null;
  if (peopleLessonProgress(history) < 5) return null;

  const name = learnerFirstName.trim() || 'เพื่อน';
  const body = `สุดยอดครับ ${name}! 🎉 วันนี้คุณแนะนำคนในครอบครัว บอกอาชีพ บรรยายนิสัย และใช้ He/She ได้แล้ว — เก่งมากครับ! 🍌`;

  const raw = (current.textEn ?? '').trim();
  const praiseOk = /^(เยี่ยม|เก่งมาก|สุดยอด|ดีมาก|ยอดเยี่ยม)/u.test(raw);
  const textEn =
    current.isTaskComplete && praiseOk && raw.length > 30 ? raw : body;

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: true,
  };
}

/** Weather 1.9 — Turn 1 hot quiz. */
export const WEATHER_HOT_QUIZ_GUIDED_SPEAKING = {
  stem: '',
  options: [
    { emoji: '🔥', label: 'Hot', speak: 'Hot.' },
    { emoji: '☀️', label: 'Sunny', speak: 'Sunny.' },
    { emoji: '🥶', label: 'Cold', speak: 'Cold.' },
  ],
};

const WEATHER_COLD_BOARD = {
  textEn:
    "ถูกต้องครับ! 👏 ถ้าจะบอกว่า 'วันนี้อากาศร้อนมาก' ให้พูดว่า The weather is very hot today. แล้วถ้าจะบอกว่า 'วันนี้อากาศหนาวมาก' จะพูดว่าอย่างไรครับ?",
  advanceQuestionEn: 'How do you say the weather is very cold today?',
  stem: 'The weather is very...',
  expectedSpeech: 'The weather is very cold today.',
  options: [
    { emoji: '🥶', label: 'Cold', speak: 'The weather is very cold today.' },
  ],
};

const WEATHER_PREFERENCE_GUIDED_SPEAKING = {
  stem: 'I like ... weather.',
  options: [
    { emoji: '☀️', label: 'Sunny', speak: 'I like sunny weather.' },
    { emoji: '🌧️', label: 'Rainy', speak: 'I like rainy weather.' },
    { emoji: '🥶', label: 'Cold', speak: 'I like cold weather.' },
  ],
};

const WEATHER_QUIZ_RAINY_BOARD = {
  textEn:
    "ก่อนจบบท ลองบอกหน่อยครับ 😊 ถ้าจะพูดว่า 'ฉันชอบอากาศฝนตก' จะพูดเป็นภาษาอังกฤษว่าอย่างไรครับ?",
  advanceQuestionEn: 'How do you say I like rainy weather?',
  stem: '',
  expectedSpeech: 'I like rainy weather.',
  options: [{ emoji: '🌧️', label: '', speak: 'I like rainy weather.' }],
};

function normalizeWeatherSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function matchesWeatherStep(step: number, userText: string): boolean {
  const t = normalizeWeatherSpeech(userText);
  if (!t) return false;
  switch (step) {
    case 1:
      return (
        t === 'hot' ||
        t === "it's hot" ||
        t === 'it is hot' ||
        t === 'hot weather'
      );
    case 2:
      return t === 'the weather is very cold today';
    case 3:
      // Soft-accept any "I like [adj] weather"
      return /^i like [\w][\w\s'-]{0,20} weather$/.test(t);
    case 4:
      return t === 'i like rainy weather';
    default:
      return false;
  }
}

export function weatherBoardForStep(step: number): ForcedGuidedBoard | null {
  if (step === 1) {
    return {
      textEn: '',
      stem: WEATHER_HOT_QUIZ_GUIDED_SPEAKING.stem,
      expectedSpeech: 'Hot.',
      options: WEATHER_HOT_QUIZ_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
  }
  if (step === 2) return WEATHER_COLD_BOARD;
  if (step === 3) {
    return {
      textEn: '',
      stem: WEATHER_PREFERENCE_GUIDED_SPEAKING.stem,
      expectedSpeech: 'I like sunny weather.',
      options: WEATHER_PREFERENCE_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
  }
  if (step === 4) return WEATHER_QUIZ_RAINY_BOARD;
  return null;
}

export function scoreWeatherStep(step: number, userText: string): ChoiceStepTier {
  return createBoardChoiceScorer(
    normalizeWeatherSpeech,
    weatherBoardForStep,
    matchesWeatherStep,
  )(step, userText);
}

/** Speak steps cleared (0–4). Quiz 1 & 4 soft-advance after 2 failed attempts. */
export function weatherLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  return computeThreeTierChoiceProgress(history, 4, scoreWeatherStep);
}

function weatherBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (t.includes('ฉันชอบอากาศฝนตก') || t.includes('อากาศฝนตก')) return 4;
  if (t.includes('ชอบอากาศแบบไหน') || t.includes('what weather do you like')) {
    return 3;
  }
  if (
    t.includes('อากาศหนาวมาก') ||
    t.includes('the weather is very hot today')
  ) {
    return 2;
  }
  if (t.includes('อากาศร้อน') || t.includes('อากาศร้อนมากเลย')) return 1;
  return null;
}

/**
 * Pin Weather guidedSpeaking boards (Turns 1–4).
 */
export function forceWeatherGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_weather') return null;
  if (current.isTaskComplete) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      weatherLessonProgress,
      4,
      scoreWeatherStep,
    )
  ) {
    return null;
  }

  const progress = weatherLessonProgress(history);
  if (progress >= 4) return null;

  const fromText = weatherBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress >= 0 && progress <= 3) step = progress + 1;
    else return null;
  }

  if (step < 1 || step > 4) return null;
  if (nextTurn < 1 && step !== 1) return null;

  let board: {
    textEn: string;
    stem: string;
    expectedSpeech: string;
    options: Array<{ emoji: string; label: string; speak: string }>;
    withPraise?: boolean;
  };
  if (step === 1) {
    board = {
      textEn:
        current.textEn?.trim() ||
        "วันนี้อากาศร้อนมากเลยครับ! 🔥 ถ้าจะพูดว่า 'อากาศร้อน' ภาษาอังกฤษใช้คำว่าอะไรครับ?",
      stem: WEATHER_HOT_QUIZ_GUIDED_SPEAKING.stem,
      expectedSpeech: 'Hot.',
      options: WEATHER_HOT_QUIZ_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
      withPraise: false,
    };
  } else if (step === 2) {
    board = {
      textEn: WEATHER_COLD_BOARD.textEn,
      stem: WEATHER_COLD_BOARD.stem,
      expectedSpeech: WEATHER_COLD_BOARD.expectedSpeech,
      options: WEATHER_COLD_BOARD.options.map((o) => ({ ...o })),
    };
  } else if (step === 3) {
    board = {
      textEn: current.textEn?.trim() || 'แล้วคุณชอบอากาศแบบไหนครับ?',
      stem: WEATHER_PREFERENCE_GUIDED_SPEAKING.stem,
      expectedSpeech: 'I like sunny weather.',
      options: WEATHER_PREFERENCE_GUIDED_SPEAKING.options.map((o) => ({
        ...o,
      })),
    };
  } else {
    board = {
      textEn: WEATHER_QUIZ_RAINY_BOARD.textEn,
      stem: WEATHER_QUIZ_RAINY_BOARD.stem,
      expectedSpeech: WEATHER_QUIZ_RAINY_BOARD.expectedSpeech,
      options: WEATHER_QUIZ_RAINY_BOARD.options.map((o) => ({ ...o })),
    };
  }

  const isSingleHint = board.options.length === 1;
  const stemOk =
    board.stem.trim() === ''
      ? !(current.guidedSpeaking?.stem?.trim())
      : (current.guidedSpeaking?.stem
          ?.toLowerCase()
          .includes(board.stem.toLowerCase().slice(0, 8)) ??
        false);
  const wantEmojiOnly =
    isSingleHint &&
    board.stem.trim() === '' &&
    !(board.options[0].label?.trim());
  const labelOk =
    !wantEmojiOnly || !(current.guidedSpeaking?.label?.trim());
  const optionsOk = isSingleHint
    ? (current.guidedSpeaking?.options?.length ?? 0) < 2 &&
      (current.guidedSpeaking?.speak === board.options[0].speak ||
        current.guidedSpeaking?.emoji === board.options[0].emoji)
    : (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    labelOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: isSingleHint
      ? {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label?.trim() ? { label: first.label } : {}),
        }
      : {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label?.trim() ? { label: first.label } : {}),
          options,
        },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After Weather quick check → Celebrate.
 */
export function forceWeatherCelebrateIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  learnerFirstName: string,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: true;
} | null {
  if (lessonId !== 'ee_about_me_weather') return null;
  if (weatherLessonProgress(history) < 4) return null;

  const name = learnerFirstName.trim() || 'เพื่อน';
  const body = `สุดยอดครับ ${name}! 🎉 วันนี้คุณบอกสภาพอากาศและบอกอากาศที่ชอบได้แล้ว — เก่งมากครับ! 🍌`;

  const raw = (current.textEn ?? '').trim();
  const praiseOk = /^(เยี่ยม|เก่งมาก|สุดยอด|ดีมาก|ยอดเยี่ยม)/u.test(raw);
  const textEn =
    current.isTaskComplete && praiseOk && raw.length > 30 ? raw : body;

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: true,
  };
}

/** Friends 1.8 — Turn 1 choose activity. */
export const FRIENDS_ACTIVITY_GUIDED_SPEAKING = {
  stem: 'We ....... together.',
  options: [
    {
      emoji: '🎮',
      label: 'Play games',
      speak: 'We play games together.',
    },
    {
      emoji: '🍽️',
      label: 'Eat out',
      speak: 'We eat out together.',
    },
    {
      emoji: '🎳',
      label: 'Hang out',
      speak: 'We hang out together.',
    },
  ],
};

const FRIENDS_EAT_OUT_BOARD = {
  textEn: 'แล้วถ้าจะพูดว่า พวกเรากินข้าวด้วยกัน จะพูดว่าอย่างไรครับ?',
  advanceQuestionEn: 'How do you say we eat out together?',
  stem: '',
  expectedSpeech: 'We eat out together.',
  options: [
    { emoji: '🍽️', label: 'Eat out', speak: 'We eat out together.' },
  ],
};

const FRIENDS_THEY_PLAY_BOARD = {
  textEn:
    'เยี่ยมครับ! 😊 แล้วถ้าจะพูดว่า พวกเขาเล่นเกมด้วยกัน จะพูดว่าอย่างไรครับ?',
  advanceQuestionEn: 'How do you say they play games together?',
  stem: 'They ........ together.',
  expectedSpeech: 'They play games together.',
  options: [
    {
      emoji: '🎮',
      label: 'Play games',
      speak: 'They play games together.',
    },
  ],
};

const FRIENDS_HANG_OUT_BOARD = {
  textEn: 'ก่อนจบบท ลองบอกหน่อยครับ 😊 พวกเราไปเที่ยวด้วยกัน',
  advanceQuestionEn: 'How do you say we hang out together?',
  stem: '',
  expectedSpeech: 'We hang out together.',
  options: [
    { emoji: '🎳', label: 'Hang out', speak: 'We hang out together.' },
  ],
};

const FRIENDS_THEY_EAT_OUT_BOARD = {
  textEn: 'แล้ว พวกเขากินข้าวด้วยกัน',
  expectedSpeech: 'They eat out together.',
};

export function friendsOpeningText(learnerFirstName: string): string {
  const name = learnerFirstName.trim();
  const greet = name ? `สวัสดีครับ ${name}! ` : 'สวัสดีครับ! ';
  return `${greet}วันหยุด คุณกับเพื่อนชอบทำอะไรกันครับ?`;
}

function normalizeFriendsSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function matchesFriendsStep(step: number, userText: string): boolean {
  const t = normalizeFriendsSpeech(userText);
  if (!t) return false;
  switch (step) {
    case 1:
      // Soft-accept any clear "We … together"
      return /^we .+ together$/.test(t) && t.length >= 14;
    case 2:
      return t === 'we eat out together';
    case 3:
      return t === 'they play games together';
    case 4:
      return t === 'we hang out together';
    case 5:
      return t === 'they eat out together';
    default:
      return false;
  }
}

export function friendsBoardForStep(step: number): ForcedGuidedBoard | null {
  if (step === 1) {
    return {
      textEn: '',
      stem: FRIENDS_ACTIVITY_GUIDED_SPEAKING.stem,
      expectedSpeech: 'We play games together.',
      options: FRIENDS_ACTIVITY_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
  }
  if (step === 2) return FRIENDS_EAT_OUT_BOARD;
  if (step === 3) return FRIENDS_THEY_PLAY_BOARD;
  if (step === 4) return FRIENDS_HANG_OUT_BOARD;
  if (step === 5) {
    return {
      textEn: FRIENDS_THEY_EAT_OUT_BOARD.textEn,
      stem: '',
      expectedSpeech: FRIENDS_THEY_EAT_OUT_BOARD.expectedSpeech,
      options: [
        {
          emoji: '🍽️',
          label: 'Eat out',
          speak: FRIENDS_THEY_EAT_OUT_BOARD.expectedSpeech,
        },
      ],
    };
  }
  return null;
}

export function scoreFriendsStep(step: number, userText: string): ChoiceStepTier {
  return createBoardChoiceScorer(
    normalizeFriendsSpeech,
    friendsBoardForStep,
    matchesFriendsStep,
  )(step, userText);
}

/** Speak steps cleared (0–5). Quick checks 4 & 5 soft-advance after 2 failed attempts. */
export function friendsLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  return computeThreeTierChoiceProgress(history, 5, scoreFriendsStep);
}

function friendsBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (t.includes('พวกเขากินข้าว')) return 5;
  if (t.includes('พวกเราไปเที่ยว') || t.includes('ก่อนจบบท')) return 4;
  if (t.includes('พวกเขาเล่นเกม') || t.includes('they ........ together')) {
    return 3;
  }
  if (t.includes('พวกเรากินข้าว')) return 2;
  if (
    t.includes('วันหยุด') ||
    t.includes('ชอบทำอะไรกัน') ||
    t.includes('we ....... together')
  ) {
    return 1;
  }
  return null;
}

/**
 * Pin Friends guidedSpeaking boards (Turns 1–4) and strip hints on Turn 5.
 */
export function forceFriendsGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_friends') return null;
  if (current.isTaskComplete) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      friendsLessonProgress,
      5,
      scoreFriendsStep,
    )
  ) {
    return null;
  }

  const progress = friendsLessonProgress(history);
  if (progress >= 5) return null;

  const fromText = friendsBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress >= 0 && progress <= 4) step = progress + 1;
    else return null;
  }

  if (step < 1 || step > 5) return null;
  if (nextTurn < 1 && step !== 1) return null;

  // Turn 5 — free recall, no choice cards.
  if (step === 5) {
    if (current.guidedSpeaking == null && current.expectsUserSpeech) {
      return null;
    }
    return {
      textEn: resolveBoardTextEn(
        current.textEn ?? '',
        FRIENDS_THEY_EAT_OUT_BOARD.textEn,
        { withPraise: true },
      ),
      textTh: current.textTh?.trim() || null,
      guidedSpeaking: null,
      expectsUserSpeech: true,
      expectedSpeech: FRIENDS_THEY_EAT_OUT_BOARD.expectedSpeech,
      emojiChoice: null,
      isTaskComplete: false,
    };
  }

  let board: {
    textEn: string;
    stem: string;
    expectedSpeech: string;
    options: Array<{ emoji: string; label: string; speak: string }>;
    withPraise?: boolean;
  };
  if (step === 1) {
    board = {
      textEn: current.textEn?.trim() || friendsOpeningText(''),
      stem: FRIENDS_ACTIVITY_GUIDED_SPEAKING.stem,
      expectedSpeech: 'We play games together.',
      options: FRIENDS_ACTIVITY_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
      withPraise: false,
    };
  } else if (step === 2) {
    board = {
      textEn: FRIENDS_EAT_OUT_BOARD.textEn,
      stem: FRIENDS_EAT_OUT_BOARD.stem,
      expectedSpeech: FRIENDS_EAT_OUT_BOARD.expectedSpeech,
      options: FRIENDS_EAT_OUT_BOARD.options.map((o) => ({ ...o })),
    };
  } else if (step === 3) {
    board = {
      textEn: FRIENDS_THEY_PLAY_BOARD.textEn,
      stem: FRIENDS_THEY_PLAY_BOARD.stem,
      expectedSpeech: FRIENDS_THEY_PLAY_BOARD.expectedSpeech,
      options: FRIENDS_THEY_PLAY_BOARD.options.map((o) => ({ ...o })),
    };
  } else {
    board = {
      textEn: FRIENDS_HANG_OUT_BOARD.textEn,
      stem: FRIENDS_HANG_OUT_BOARD.stem,
      expectedSpeech: FRIENDS_HANG_OUT_BOARD.expectedSpeech,
      options: FRIENDS_HANG_OUT_BOARD.options.map((o) => ({ ...o })),
    };
  }

  const isSingleHint = board.options.length === 1;
  const stemOk =
    board.stem.trim() === ''
      ? !(current.guidedSpeaking?.stem?.trim())
      : (current.guidedSpeaking?.stem
          ?.toLowerCase()
          .includes(board.stem.toLowerCase().slice(0, 8)) ??
        false);
  const wantEmojiOnly =
    isSingleHint &&
    board.stem.trim() === '' &&
    !(board.options[0].label?.trim());
  const labelOk =
    !wantEmojiOnly || !(current.guidedSpeaking?.label?.trim());
  const optionsOk = isSingleHint
    ? (current.guidedSpeaking?.options?.length ?? 0) < 2 &&
      (current.guidedSpeaking?.speak === board.options[0].speak ||
        current.guidedSpeaking?.emoji === board.options[0].emoji)
    : (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    labelOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: isSingleHint
      ? {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label?.trim() ? { label: first.label } : {}),
        }
      : {
          stem: board.stem,
          emoji: first.emoji,
          speak: first.speak,
          ...(first.label?.trim() ? { label: first.label } : {}),
          options,
        },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

/**
 * After Friends quick checks → Celebrate.
 */
export function forceFriendsCelebrateIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  learnerFirstName: string,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
  },
): {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: true;
} | null {
  if (lessonId !== 'ee_about_me_friends') return null;
  if (friendsLessonProgress(history) < 5) return null;

  const name = learnerFirstName.trim() || 'เพื่อน';
  const body = `สุดยอดครับ ${name}! 🎉 วันนี้คุณพูด We/They … together กับเพื่อนได้แล้ว — เก่งมากครับ! 🍌`;

  const raw = (current.textEn ?? '').trim();
  const praiseOk = /^(เยี่ยม|เก่งมาก|สุดยอด|ดีมาก|ยอดเยี่ยม)/u.test(raw);
  const textEn =
    current.isTaskComplete && praiseOk && raw.length > 30 ? raw : body;

  return {
    textEn,
    textTh: null,
    expectsUserSpeech: false,
    expectedSpeech: null,
    guidedSpeaking: null,
    emojiChoice: null,
    isTaskComplete: true,
  };
}

/**
 * After Survival Step 3 (Can you speak…?) → Emoji Speak Intro + full batch.
 */

/** Favorites 1.10 — Step 1 food preference. */
const FAVORITES_PREFER_GUIDED_SPEAKING = {
  stem: 'I prefer...',
  options: [
    { emoji: '🍕', label: 'Pizza', speak: 'I prefer pizza.' },
    { emoji: '🍣', label: 'Sushi', speak: 'I prefer sushi.' },
  ],
};

const FAVORITES_OPINION_BOARD = {
  textEn: 'Why do you like it? ทำไมถึงชอบครับ?',
  stem: "I think it's...",
  expectedSpeech: "I think it's delicious.",
  softTeachHintTh: 'ถ้าจะบอกว่าชอบเพราะอะไร เราจะพูดว่า',
  options: [
    { emoji: '😋', label: 'delicious', speak: "I think it's delicious." },
    { emoji: '🌶️', label: 'spicy', speak: "I think it's spicy." },
  ],
};

const FAVORITES_FRIENDS_BOARD = {
  textEn: 'What about your friends? แล้วเพื่อนๆ ล่ะชอบอะไร?',
  stem: 'They like...',
  expectedSpeech: 'They like pizza.',
  softTeachHintTh: 'ถ้าจะบอกว่าเพื่อนชอบอะไร เราจะพูดว่า',
  options: [
    { emoji: '🍕', label: 'Pizza', speak: 'They like pizza.' },
    { emoji: '🍔', label: 'Burger', speak: 'They like burgers.' },
  ],
};

const FAVORITES_GROUP_BOARD = {
  textEn: 'Do you eat together? พวกคุณกินด้วยกันไหม?',
  stem: 'We...',
  expectedSpeech: 'We eat together.',
  softTeachHintTh: 'ถ้าจะบอกว่าทำอะไรด้วยกัน เราจะพูดว่า',
  options: [
    { emoji: '🍽️', label: 'eat together', speak: 'We eat together.' },
    { emoji: '🎬', label: 'watch movies', speak: 'We watch movies.' },
  ],
};

function normalizeFavoritesSpeech(userText: string): string {
  return userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function matchesFavoritesStep(step: number, userText: string): boolean {
  const t = normalizeFavoritesSpeech(userText);
  if (!t) return false;
  switch (step) {
    case 1:
      return (
        (/\bi prefer\b/.test(t) || /\bprefer\b/.test(t)) &&
        (/\bpizza\b/.test(t) || /\bsushi\b/.test(t))
      );
    case 2:
      return (
        (/\bi think\b/.test(t) &&
          (/\bdelicious\b/.test(t) || /\bspicy\b/.test(t))) ||
        t === 'delicious' ||
        t === 'spicy' ||
        ((/\bit'?s\b/.test(t) || /\bit is\b/.test(t)) &&
          (/\bdelicious\b/.test(t) || /\bspicy\b/.test(t)))
      );
    case 3:
      return (
        /\bthey like\b/.test(t) &&
        (/\bpizza\b/.test(t) || /\bburger\b/.test(t) || /\bburgers\b/.test(t))
      );
    case 4:
      return (
        t === 'we eat together' ||
        t === 'we watch movies' ||
        /\bwe eat together\b/.test(t) ||
        /\bwe watch movies\b/.test(t) ||
        t === 'yes we do' ||
        /^yes\b/.test(t)
      );
    default:
      return false;
  }
}

export function favoritesBoardForStep(step: number): ForcedGuidedBoard | null {
  if (step === 1) {
    return {
      textEn:
        'Which food do you prefer? ระหว่างสองอย่างนี้ คุณชอบอันไหนมากกว่ากันครับ?',
      stem: FAVORITES_PREFER_GUIDED_SPEAKING.stem,
      expectedSpeech: 'I prefer pizza.',
      softTeachHintTh: 'ถ้าจะบอกว่าชอบอาหารอันไหนมากกว่า เราจะพูดว่า',
      options: FAVORITES_PREFER_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
      withPraise: false,
    };
  }
  if (step === 2) return FAVORITES_OPINION_BOARD;
  if (step === 3) return FAVORITES_FRIENDS_BOARD;
  if (step === 4) return FAVORITES_GROUP_BOARD;
  return null;
}

export function scoreFavoritesStep(step: number, userText: string): ChoiceStepTier {
  return createBoardChoiceScorer(
    normalizeFavoritesSpeech,
    favoritesBoardForStep,
    matchesFavoritesStep,
  )(step, userText);
}

/** Teaching speak steps cleared (0–4) before Movie roleplay. */
export function favoritesLessonProgress(
  history: Array<{ speaker: string; textEn?: string }>,
): number {
  return computeThreeTierChoiceProgress(history, 4, scoreFavoritesStep);
}

function favoritesBoardFromAiText(textEn: string): number | null {
  const t = (textEn ?? '').toLowerCase();
  if (!t) return null;
  if (
    t.includes('กินด้วยกัน') ||
    (t.includes('do you') && t.includes('together')) ||
    t.includes('eat together')
  ) {
    return 4;
  }
  if (
    t.includes('what about your friends') ||
    t.includes('เพื่อนๆ') ||
    t.includes('เพื่อนล่ะ')
  ) {
    return 3;
  }
  if (
    t.includes('why do you like') ||
    t.includes('ทำไมถึงชอบ')
  ) {
    return 2;
  }
  if (
    t.includes('which food do you prefer') ||
    t.includes('ชอบอันไหน') ||
    t.includes('i prefer')
  ) {
    return 1;
  }
  return null;
}

function favoritesRoleplayStarted(
  history: Array<{
    speaker: string;
    textEn?: string;
    roleplayIntro?: unknown;
    roleplayNpc?: unknown;
  }>,
): boolean {
  return history.some(
    (t) =>
      t.speaker === 'ai' &&
      (t.roleplayIntro != null || t.roleplayNpc != null),
  );
}

/**
 * Pin Favorites teaching boards (Steps 1–4) before Movie roleplay.
 */
export function forceFavoritesGuidedSpeakingIfNeeded(
  lessonId: string,
  _lang: LessonTeachingLanguage,
  nextTurn: number,
  history: Array<{
    speaker: string;
    textEn?: string;
    roleplayIntro?: unknown;
    roleplayNpc?: unknown;
  }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
    roleplayIntro?: unknown;
    roleplayNpc?: unknown;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: NonNullable<ReturnType<typeof normalizeGuidedSpeaking>>;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== 'ee_about_me_favorites') return null;
  if (current.isTaskComplete) return null;
  if (current.roleplayIntro != null || current.roleplayNpc != null) return null;
  if (favoritesRoleplayStarted(history)) return null;
  if (looksLikeSoftTeachReveal(current.textEn ?? '')) return null;
  if (
    pendingThreeTierSoftTeach(
      history,
      favoritesLessonProgress,
      4,
      scoreFavoritesStep,
    )
  ) {
    return null;
  }

  const progress = favoritesLessonProgress(history);
  if (progress >= 4) return null;

  const fromText = favoritesBoardFromAiText(current.textEn ?? '');
  let step = fromText;
  if (step == null) {
    if (progress >= 0 && progress <= 3) step = progress + 1;
    else return null;
  }

  if (step < 1 || step > 4) return null;
  if (nextTurn < 1 && step !== 1) return null;

  const board = favoritesBoardForStep(step);
  if (!board) return null;

  const stemOk =
    board.stem.trim() === ''
      ? !(current.guidedSpeaking?.stem?.trim())
      : (current.guidedSpeaking?.stem
          ?.toLowerCase()
          .includes(board.stem.toLowerCase().slice(0, 8)) ??
        false);
  const optionsOk =
    (current.guidedSpeaking?.options?.length ?? 0) >= board.options.length;
  if (
    current.expectsUserSpeech &&
    stemOk &&
    optionsOk &&
    current.guidedSpeaking
  ) {
    return null;
  }

  const options = board.options.map((o) => ({ ...o }));
  const first = options[0];
  return {
    textEn: resolveForcedBoardTextEn(current.textEn ?? '', board, step),
    textTh: current.textTh?.trim() || null,
    guidedSpeaking: {
      stem: board.stem,
      emoji: first.emoji,
      speak: first.speak,
      ...(first.label ? { label: first.label } : {}),
      options,
    },
    expectsUserSpeech: true,
    expectedSpeech: board.expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}

export function foodBoardForStep(
  step: number,
  history: Array<{ speaker: string; textEn?: string }>,
): ForcedGuidedBoard | null {
  const choice = extractFoodLessonChoice(history);
  if (step === 1) {
    return {
      textEn: '',
      withPraise: false,
      stem: FOOD_FAVORITE_GUIDED_SPEAKING.stem,
      expectedSpeech: choice.boardId
        ? `I like ${choice.boardId === 'somtam' ? 'somtam' : choice.boardId}.`
        : `I like ${choice.spoken}.`,
      options: FOOD_FAVORITE_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
    };
  }
  if (step === 2) return foodDescribeBoardForChoice(choice);
  if (step === 3) return foodDrinkBoardForChoice(choice);
  if (step >= 4 && step <= 6) {
    return FOOD_EMOJI_QUIZ_BOARDS[step as 4 | 5 | 6];
  }
  return null;
}

export function workSchoolBoardForStep(
  step: number,
  history: Array<{ speaker: string; textEn?: string }>,
): ForcedGuidedBoard | null {
  const mode = extractWorkSchoolMode(history) ?? 'work';
  if (step === 1) {
    return {
      textEn: '',
      stem: WORK_SCHOOL_ACTIVITY_GUIDED_SPEAKING.stem,
      expectedSpeech: mode === 'study' ? 'I study.' : 'I work.',
      options: WORK_SCHOOL_ACTIVITY_GUIDED_SPEAKING.options.map((o) => ({
        ...o,
      })),
    };
  }
  if (step === 2) return workSchoolLocationBoard(mode);
  if (step === 3) return workSchoolFeelingBoard(mode);
  if (step === 4) return WORK_SCHOOL_COMBO_BOARD;
  return null;
}

/** Wrong answer → เฉลย + พูดตาม once; never re-ask the same About Me question. */
export function forceAboutMeSoftTeachForLesson(
  lessonId: string,
  lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: ReturnType<typeof normalizeGuidedSpeaking>;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
): ReturnType<typeof forceGuidedBoardSoftTeachIfNeeded> {
  switch (lessonId) {
    case 'ee_about_me_daily_routine':
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: dailyRoutineProgress,
          maxStep: 7,
          matchesStep: matchesDailyRoutineStep,
          scoreStep: scoreDailyRoutineStep,
          getBoard: (step) => dailyRoutineBoardForStep(step, history),
        },
      );
    case 'ee_about_me_home':
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: homeLessonProgress,
          maxStep: 6,
          matchesStep: matchesExactFromScorer(scoreHomeStep),
          scoreStep: scoreHomeStep,
          getBoard: (step) => HOME_BOARDS[step] ?? null,
        },
      );
    case 'ee_about_me_food':
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: foodLessonProgress,
          maxStep: 6,
          matchesStep: matchesExactFromScorer((step, text) =>
            scoreFoodStepForHistory(history, step, text),
          ),
          scoreStep: (step, text) =>
            scoreFoodStepForHistory(history, step, text),
          getBoard: (step) => foodBoardForStep(step, history),
        },
      );
    case 'ee_about_me_work_school':
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: workSchoolLessonProgress,
          maxStep: 4,
          matchesStep: matchesExactFromScorer((step, text) =>
            scoreWorkSchoolStepForHistory(history, step, text),
          ),
          scoreStep: (step, text) =>
            scoreWorkSchoolStepForHistory(history, step, text),
          getBoard: (step) => workSchoolBoardForStep(step, history),
        },
      );
    case 'ee_about_me_hobbies':
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: hobbiesLessonProgress,
          maxStep: 5,
          matchesStep: matchesExactFromScorer((step, text) =>
            scoreHobbiesStepForHistory(history, step, text),
          ),
          scoreStep: (step, text) =>
            scoreHobbiesStepForHistory(history, step, text),
          getBoard: (step) => hobbiesBoardForStep(step, history),
        },
      );
    case 'ee_about_me_pets': {
      const animal = extractPetsAnimal(history);
      const adjective = extractPetsAdjective(history, animal);
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: petsLessonProgress,
          maxStep: 4,
          matchesStep: matchesExactFromScorer((step, text) =>
            scorePetsStepForHistory(history, step, text),
          ),
          scoreStep: (step, text) =>
            scorePetsStepForHistory(history, step, text),
          getBoard: (step) => petsBoardForStep(step, animal, adjective),
        },
      );
    }
    case 'ee_about_me_people': {
      const person = extractPeoplePerson(history);
      const job = extractPeopleJob(history);
      const jobPraiseLabel = extractPeopleJobPraiseLabel(history);
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: peopleLessonProgress,
          maxStep: 5,
          matchesStep: matchesExactFromScorer((step, text) =>
            scorePeopleStepForHistory(history, step, text),
          ),
          scoreStep: (step, text) =>
            scorePeopleStepForHistory(history, step, text),
          getBoard: (step) =>
            peopleBoardForStep(step, person, job, jobPraiseLabel),
        },
      );
    }
    case 'ee_about_me_weather':
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: weatherLessonProgress,
          maxStep: 4,
          matchesStep: matchesExactFromScorer(scoreWeatherStep),
          scoreStep: scoreWeatherStep,
          getBoard: weatherBoardForStep,
        },
      );
    case 'ee_about_me_friends':
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: friendsLessonProgress,
          maxStep: 5,
          matchesStep: matchesExactFromScorer(scoreFriendsStep),
          scoreStep: scoreFriendsStep,
          getBoard: friendsBoardForStep,
        },
      );
    case 'ee_about_me_favorites':
      return forceGuidedBoardSoftTeachIfNeeded(
        lessonId,
        lessonId,
        lang,
        history,
        current,
        {
          progressFn: favoritesLessonProgress,
          maxStep: 4,
          matchesStep: matchesExactFromScorer(scoreFavoritesStep),
          scoreStep: scoreFavoritesStep,
          getBoard: favoritesBoardForStep,
        },
      );
    default:
      return null;
  }
}

/** v2 PoolGate — Home board lookup by speak step (1–6). */
export function homeBoardForStep(step: number): ForcedGuidedBoard | null {
  return HOME_BOARDS[step] ?? null;
}

/** v2 PoolGate — Pets board with animal/adjective from history. */
export function petsBoardForStepFromHistory(
  step: number,
  history: Array<{ speaker: string; textEn?: string }>,
): ForcedGuidedBoard | null {
  const animal = extractPetsAnimal(history) ?? 'dog';
  const adjective = extractPetsAdjective(history, animal);
  return petsBoardForStep(step, animal, adjective);
}

/** v2 PoolGate — People board with sibling/job context from history. */
export function peopleBoardForStepFromHistory(
  step: number,
  history: Array<{ speaker: string; textEn?: string }>,
): ForcedGuidedBoard | null {
  const person = extractPeoplePerson(history);
  const job = extractPeopleJob(history);
  const jobPraiseLabel = extractPeopleJobPraiseLabel(history);
  return peopleBoardForStep(step, person, job, jobPraiseLabel);
}

export function weatherOpeningText(): string {
  return "วันนี้อากาศร้อนมากเลยครับ! 🔥 ถ้าจะพูดว่า 'อากาศร้อน' ภาษาอังกฤษใช้คำว่าอะไรครับ?";
}

export function favoritesOpeningText(learnerFirstName: string): string {
  const name = learnerFirstName.trim();
  return `สวัสดีครับ${name ? ` ${name}` : ''}! วันนี้มาคุยเรื่องของโปรดกันครับ 🍕 Which food do you prefer? ระหว่างสองอย่างนี้ คุณชอบอันไหนมากกว่ากันครับ?`;
}
