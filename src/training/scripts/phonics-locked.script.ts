import type { ChatTurn } from '../../session-store/session-store.service';
import type { ScriptTurnResult } from './types';

/**
 * Locked Phonics teaching scripts (8 beats, no Gemini, no learner name).
 * Every line is fixed text so its audio can live in the TTS bank.
 *
 * Beats: 1 intro+word1 · 2 word2 · 3 contrast pair · 4 recall word1+word2
 * (no model) · 5 try-first transfer · 6 reveal (hit: listen / miss: model +
 * repeat) · 7 phrase · 8 complete. Speak beats retry once, then advance.
 */
export type PhonicsLockedWord = { word: string; th: string };

export type PhonicsLockedSpec = {
  lessonId: string;
  /** Spoken sound label, e.g. "Short U". */
  soundName: string;
  /** Highlighted spelling on the cards, e.g. "u". */
  letter: string;
  /** Beat 1 explanation before the first model. */
  introTh: string;
  word1: PhonicsLockedWord;
  word2: PhonicsLockedWord;
  /** Minimal-pair partner of word1 (differs only in the taught sound). */
  contrast: PhonicsLockedWord & { letter: string; explainTh: string };
  transfer: PhonicsLockedWord;
  phrase: { text: string; th: string; noteTh?: string };
};

export const PHONICS_LOCKED_SPECS: PhonicsLockedSpec[] = [
  {
    lessonId: 'pron_phonics_05_short_u',
    soundName: 'Short U',
    letter: 'u',
    introTh:
      'วันนี้เราจะฝึกอ่านคำที่ใช้เสียง Short U กันครับ ตัว u ในคำนี้ไม่ได้อ่านว่า "ยู" แต่เป็นเสียงสั้นๆ คล้าย "อะ" ครับ',
    word1: { word: 'cup', th: 'ถ้วย' },
    word2: { word: 'mug', th: 'แก้วมีหู' },
    contrast: {
      word: 'cap',
      th: 'หมวกแก๊ป',
      letter: 'a',
      explainTh:
        'ต่างกันแค่เสียงสระตรงกลาง cup ใช้เสียง u ส่วน cap ใช้เสียง a ที่เราเรียนมาแล้ว',
    },
    transfer: { word: 'mud', th: 'โคลน' },
    phrase: {
      text: 'a cup',
      th: 'ถ้วยหนึ่งใบ',
      noteTh: 'ตัว a ข้างหน้าพูดเบาๆ สั้นๆ นะครับ',
    },
  },
];

export const PHONICS_LOCKED_PROGRESS_MAX = 8;

const RETRY_TH = 'ลองอีกครั้งนะครับ';
const MISS_MARK = 'miss';

export function phonicsLockedSpecFor(
  lessonId: string,
): PhonicsLockedSpec | undefined {
  return PHONICS_LOCKED_SPECS.find((spec) => spec.lessonId === lessonId);
}

export function isPhonicsLockedLesson(lessonId: string): boolean {
  return phonicsLockedSpecFor(lessonId) != null;
}

type Beat = {
  step: number;
  text: string;
  /** '' = listen-only beat (tap to continue). */
  expected: string;
  cards: Array<{ emoji: string; label: string; speak: string }>;
  retryText?: string;
  choice?: string;
  complete?: boolean;
};

function card(letter: string, word: string) {
  return { emoji: letter, label: word, speak: word };
}

function beats(spec: PhonicsLockedSpec) {
  const { letter, word1: w1, word2: w2, contrast: c, transfer: t, phrase: p } =
    spec;
  const retry = (say: string) => `${RETRY_TH}\n${say}`;
  return {
    1: {
      step: 1,
      text: `${spec.introTh} ฟังคำนี้นะครับ ${w1.word} … ลองพูดตามครับ ${w1.word}`,
      expected: w1.word,
      cards: [card(letter, w1.word)],
      retryText: retry(w1.word),
    },
    2: {
      step: 2,
      text: `${w1.word} แปลว่า${w1.th}ครับ ส่วนคำนี้อ่านว่า ${w2.word} แปลว่า${w2.th} สังเกตว่าเสียงสระเหมือนกันเลยครับ ${w1.word} … ${w2.word} ทีนี้ลองพูดคำว่า ${w2.word} ครับ`,
      expected: w2.word,
      cards: [card(letter, w2.word)],
      retryText: retry(w2.word),
    },
    3: {
      step: 3,
      text: `ทีนี้ลองฟังสองคำนี้นะครับ ${w1.word} … ${c.word} ${c.explainTh} ${c.word} แปลว่า${c.th}ครับ ลองพูดช้าๆ ทั้งสองคำครับ ${w1.word} … ${c.word}`,
      expected: `${w1.word} ${c.word}`,
      cards: [card(letter, w1.word), card(c.letter, c.word)],
      retryText: retry(`${w1.word} … ${c.word}`),
    },
    4: {
      step: 4,
      text: `กลับมาที่เสียง ${spec.soundName} ของเราครับ ลองอ่านสองคำนี้ต่อกัน คราวนี้ครูบีจะไม่อ่านให้ฟังก่อนนะครับ`,
      expected: `${w1.word} ${w2.word}`,
      cards: [card(letter, w1.word), card(letter, w2.word)],
      retryText: `ฟังอีกทีนะครับ ${w1.word} … ${w2.word} ลองอีกครั้งครับ`,
    },
    5: {
      step: 5,
      text: `ทีนี้ลองอ่านคำใหม่ดูครับ ตัว ${letter} ในคำนี้ใช้เสียงเดียวกับ ${w1.word} และ ${w2.word} คำนี้อ่านว่าอะไรครับ?`,
      expected: t.word,
      cards: [card(letter, t.word)],
    },
    '6hit': {
      step: 6,
      text: `ใช่ครับ ${t.word} แปลว่า${t.th}ครับ คุณอ่านคำใหม่ได้เองแล้ว!`,
      expected: '',
      cards: [card(letter, t.word)],
    },
    '6miss': {
      step: 6,
      text: `ลองฟังคำนี้อีกทีนะครับ ${t.word} … ใช้เสียงสระสั้นๆ แบบในคำว่า ${w1.word} ${t.word} แปลว่า${t.th}ครับ ลองพูดตามอีกครั้งครับ ${t.word}`,
      expected: t.word,
      cards: [card(letter, t.word)],
      choice: MISS_MARK,
    },
    7: {
      step: 7,
      text: `ก่อนจบ ลองเพิ่มอีกนิดครับ ถ้าจะพูดว่า "${p.th}" เราพูดว่า ${p.text}${p.noteTh ? ` ${p.noteTh}` : ''} ฟังอีกครั้ง ${p.text} … ลองพูดตามครับ`,
      expected: p.text,
      cards: [card(letter, p.text)],
      retryText: retry(p.text),
    },
    8: {
      step: 8,
      text: `วันนี้เราได้ฝึก ${w1.word}, ${w2.word}, ${t.word} ทั้งสามคำใช้เสียง ${spec.soundName} เหมือนกันครับ แล้วเจอกันบทหน้าครับ!`,
      expected: '',
      cards: [w1.word, w2.word, t.word].map((w) => card(letter, w)),
      complete: true,
    },
  } satisfies Record<string, Beat>;
}

function toResult(beat: Beat, opts?: { retry?: boolean }): ScriptTurnResult {
  const text = opts?.retry && beat.retryText ? beat.retryText : beat.text;
  const speak = beat.expected !== '' && !beat.complete;
  return {
    v7Step: beat.step,
    v7Retry: opts?.retry || undefined,
    v7Choice: beat.choice,
    textEn: text,
    ttsText: text,
    textTh: '',
    isLessonComplete: beat.complete === true,
    expectsUserSpeech: speak,
    expectedSpeech: speak ? beat.expected : '',
    ...(beat.cards.length ? { emojiChoice: { options: beat.cards } } : {}),
    ...(beat.complete ? { completionStatus: 'completed_independently' as const } : {}),
  };
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Lexical match only (STT text, not acoustic evidence): every target word said. */
export function phonicsLockedMatches(userText: string, expected: string): boolean {
  const said = new Set(words(userText));
  const target = words(expected).filter((w) => w !== 'a');
  return target.length > 0 && target.every((w) => said.has(w));
}

export function buildPhonicsLockedOpening(lessonId: string): ScriptTurnResult {
  const spec = phonicsLockedSpecFor(lessonId);
  if (!spec) throw new Error(`missing locked phonics spec: ${lessonId}`);
  return toResult(beats(spec)[1]);
}

export function buildPhonicsLockedAfterUser(input: {
  lessonId: string;
  turns: ChatTurn[];
  userText: string;
}): ScriptTurnResult {
  const spec = phonicsLockedSpecFor(input.lessonId);
  if (!spec) throw new Error(`missing locked phonics spec: ${input.lessonId}`);
  const b = beats(spec);
  const lastAi = [...input.turns].reverse().find((t) => t.speaker === 'ai');
  const step = lastAi?.v7Step ?? 1;
  const retried = lastAi?.v7Retry === true;
  const hit = phonicsLockedMatches(input.userText, lastAi?.expectedSpeech ?? '');

  switch (step) {
    case 5:
      return toResult(hit ? b['6hit'] : b['6miss']);
    case 6:
      return toResult(b[7]);
    case 8:
      return toResult(b[8]);
    case 1:
    case 2:
    case 3:
    case 4:
    case 7: {
      const current = b[step as 1 | 2 | 3 | 4 | 7];
      if (!hit && !retried) return toResult(current, { retry: true });
      const next = (step + 1) as 2 | 3 | 4 | 5 | 8;
      return toResult(b[next]);
    }
    default:
      return toResult(b[8]);
  }
}

/** Every fixed line, for the TTS bank build. */
export function collectPhonicsLockedBankLines(): string[] {
  const lines = new Set<string>();
  for (const spec of PHONICS_LOCKED_SPECS) {
    for (const beat of Object.values(beats(spec)) as Beat[]) {
      lines.add(beat.text);
      if (beat.retryText) lines.add(beat.retryText);
    }
  }
  return [...lines].sort((a, b) => a.localeCompare(b));
}
