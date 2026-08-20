import {
  aroundTownRoleplayIntroSpeech,
  computeThreeTierChoiceProgress,
  createBoardChoiceScorer,
  type ChoiceStepTier,
  type ForcedGuidedBoard,
} from '../../lessons/lessons.data';
import type { ScriptTurnResult } from '../scripts/types';
import { buildOpeningFromBoard } from '../scripts/choice-lesson.script';

export { buildOpeningFromBoard };

function normalizeSpeech(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

/** Soft-accept any board option speak / label (near tier). */
function anyOptionLoose(
  board: ForcedGuidedBoard | null,
  text: string,
): boolean {
  if (!board) return false;
  const t = normalizeSpeech(text);
  if (!t) return false;
  for (const opt of board.options) {
    const speak = normalizeSpeech(opt.speak);
    const label = normalizeSpeech(opt.label);
    if (speak && (t === speak || t.includes(speak) || speak.includes(t))) {
      return true;
    }
    if (label && t === label) return true;
  }
  const expected = normalizeSpeech(board.expectedSpeech);
  if (
    expected &&
    (t === expected || t.includes(expected) || expected.includes(t))
  ) {
    return true;
  }
  return false;
}

function makeScorer(
  boardForStep: (step: number) => ForcedGuidedBoard | null,
  loose?: (step: number, text: string) => boolean,
): (step: number, text: string) => ChoiceStepTier {
  return createBoardChoiceScorer(
    normalizeSpeech,
    boardForStep,
    loose ?? ((step, text) => anyOptionLoose(boardForStep(step), text)),
  );
}

function makeProgress(
  maxStep: number,
  scoreStep: (step: number, text: string) => ChoiceStepTier,
): (history: Array<{ speaker: string; textEn?: string }>) => number {
  return (history) =>
    computeThreeTierChoiceProgress(history, maxStep, scoreStep);
}

function withHints(
  board: ForcedGuidedBoard,
  incorrectHintTh: string,
  advanceQuestionEn?: string,
): ForcedGuidedBoard {
  return {
    ...board,
    incorrectHintTh,
    ...(advanceQuestionEn ? { advanceQuestionEn } : {}),
  };
}

export function roleplayAfterTeaching(lessonId: string): ScriptTurnResult | null {
  const intro = aroundTownRoleplayIntroSpeech(lessonId, 'thai');
  if (!intro) return null;
  return {
    textEn: intro.textEn,
    textTh: '',
    isLessonComplete: false,
    expectsUserSpeech: false,
    roleplayIntro: intro.roleplayIntro,
  };
}

function greetName(learnerFirstName: string): string {
  const name = learnerFirstName.trim();
  return name ? `สวัสดีครับ ${name}! ` : 'สวัสดีครับ! ';
}

function celebrateText(
  learnerFirstName: string,
  skillLine: string,
  nextHint: string,
): string {
  const name = learnerFirstName.trim() || 'เพื่อน';
  return `เยี่ยมเลยครับ! 👏 ${name} ${skillLine} — เก่งมากครับ! 🍌\n\nต่อไปลองบท ${nextHint} กันนะครับ!`;
}

function singleSpeak(
  speak: string,
  emoji: string,
  label: string,
): ForcedGuidedBoard['options'] {
  return [{ emoji, label, speak }];
}

function structureHint(frame: string): string {
  return `ยังไม่ตรงครับ ลองใช้โครง ${frame} ครับ`;
}

// ─── Pattern lesson factory (tell1/2/3 + ask1/ask2) ─────────────────────────

type PatternStepSpec = {
  expected: string;
  textEn: string;
  emoji: string;
  label: string;
  hintFrame: string;
  stem?: string;
};

type PatternLessonSpec = {
  hookTh: string;
  step1CueTh: string;
  tell1: PatternStepSpec;
  tell2: PatternStepSpec;
  tell3: PatternStepSpec;
  ask1: PatternStepSpec;
  ask2: PatternStepSpec;
  skillLine: string;
  nextHint: string;
};

type PatternLessonBundle = {
  boardForStep: (step: number) => ForcedGuidedBoard | null;
  scoreStep: (step: number, text: string) => ChoiceStepTier;
  lessonProgress: (
    history: Array<{ speaker: string; textEn?: string }>,
  ) => number;
  openingText: (learnerFirstName: string) => string;
  celebrate: (learnerFirstName: string) => string;
  maxStep: 5;
};

function buildPatternBoards(
  spec: PatternLessonSpec,
): Record<number, ForcedGuidedBoard> {
  const steps: PatternStepSpec[] = [
    spec.tell1,
    spec.tell2,
    spec.tell3,
    spec.ask1,
    spec.ask2,
  ];
  const boards: Record<number, ForcedGuidedBoard> = {};
  for (let i = 0; i < steps.length; i++) {
    const step = i + 1;
    const s = steps[i]!;
    const next = steps[i + 1];
    boards[step] = withHints(
      {
        textEn: step === 1 ? '' : s.textEn,
        stem: s.stem ?? '',
        expectedSpeech: s.expected,
        options: singleSpeak(s.expected, s.emoji, s.label),
      },
      structureHint(s.hintFrame),
      next?.expected,
    );
  }
  return boards;
}

function makePatternLesson(spec: PatternLessonSpec): PatternLessonBundle {
  const boards = buildPatternBoards(spec);
  const boardForStep = (step: number): ForcedGuidedBoard | null =>
    boards[step] ?? null;
  const scoreStep = makeScorer(boardForStep);
  return {
    maxStep: 5,
    boardForStep,
    scoreStep,
    lessonProgress: makeProgress(5, scoreStep),
    openingText(learnerFirstName: string): string {
      return `${greetName(learnerFirstName)}${spec.hookTh}\n\n${spec.step1CueTh}`;
    },
    celebrate: (name) => celebrateText(name, spec.skillLine, spec.nextHint),
  };
}

// ─── Yesterday (5) ──────────────────────────────────────────────────────────

const YESTERDAY_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: '',
      expectedSpeech: 'I ate breakfast this morning.',
      options: singleSpeak(
        'I ate breakfast this morning.',
        '🍳',
        'this morning',
      ),
    },
    structureHint('I ate... this morning'),
    'I ate breakfast yesterday.',
  ),
  2: withHints(
    {
      textEn:
        "คราวนี้ลองเปลี่ยนเป็น 'ฉันกินข้าวเช้าเมื่อวาน' ดูครับ พูดว่าไงดี?",
      stem: '',
      expectedSpeech: 'I ate breakfast yesterday.',
      options: singleSpeak(
        'I ate breakfast yesterday.',
        '🍳',
        'yesterday',
      ),
    },
    structureHint('I ate... yesterday'),
    'I went to work yesterday.',
  ),
  3: withHints(
    {
      textEn:
        "สลับกิจกรรมบ้าง... 'เมื่อวานฉันไปทำงานมา' พูดว่าไงดี?",
      stem: '',
      expectedSpeech: 'I went to work yesterday.',
      options: singleSpeak('I went to work yesterday.', '💼', 'work'),
    },
    structureHint('I went to...'),
    'What did you do yesterday?',
  ),
  4: withHints(
    {
      textEn:
        'เยี่ยมเลยครับ! คราวนี้ลองถามเพื่อนว่าเมื่อวานทำอะไรบ้าง ให้พูดว่า What did you do yesterday? ครับ',
      stem: '',
      expectedSpeech: 'What did you do yesterday?',
      options: singleSpeak(
        'What did you do yesterday?',
        '❓',
        'what did you do',
      ),
    },
    structureHint('What did you...'),
    'Did you eat breakfast yesterday?',
  ),
  5: withHints(
    {
      textEn:
        "คราวนี้ลองถามเองดูครับ เกี่ยวกับการกินข้าวเช้าเมื่อวานน่ะ พูดว่าไงดี?",
      stem: '',
      expectedSpeech: 'Did you eat breakfast yesterday?',
      options: singleSpeak(
        'Did you eat breakfast yesterday?',
        '🍳',
        'breakfast?',
      ),
    },
    structureHint('Did you...'),
  ),
};

export function yesterdayBoardForStep(step: number): ForcedGuidedBoard | null {
  return YESTERDAY_BOARDS[step] ?? null;
}

export const scoreYesterdayStep = makeScorer(yesterdayBoardForStep);
export const yesterdayLessonProgress = makeProgress(5, scoreYesterdayStep);

export function yesterdayOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}เมื่อวานทำอะไรมาบ้างครับ? บางคนไปทำงาน บางคนได้พักผ่อนอยู่บ้าน... วันนี้มาฝึกเล่าเรื่อง 'เมื่อวาน' เป็นภาษาอังกฤษแบบชิลๆ กันครับ!\n\nถ้าจะบอกเพื่อนต่างชาติว่า 「เมื่อเช้าฉันกินข้าวเช้ามานะ」 จะพูดอย่างไรครับ?`;
}

export function yesterdayCelebrate(learnerFirstName: string): string {
  return celebrateText(
    learnerFirstName,
    'วันนี้คุณเล่าและถามเรื่องเมื่อวานด้วย Past Simple ได้แล้ว',
    'Last Weekend',
  );
}

// ─── Pattern lessons ────────────────────────────────────────────────────────

export const LAST_WEEKEND = makePatternLesson({
  hookTh:
    'สุดสัปดาห์ที่ผ่านมาได้ทำอะไรบ้างครับ? บางคนไปเที่ยว บางคนพักผ่อนอยู่บ้าน... วันนี้มาลองเล่าเรื่องสุดสัปดาห์เป็นภาษาอังกฤษกันครับ!',
  step1CueTh:
    "ถ้าจะบอกว่า 'สุดสัปดาห์ที่แล้วฉันไปชายหาด' พูดว่าไงดีครับ?",
  tell1: {
    expected: 'I went to the beach.',
    textEn: '',
    emoji: '🏖️',
    label: 'beach',
    hintFrame: 'I went to the...',
  },
  tell2: {
    expected: 'I went shopping.',
    textEn: "คราวนี้ลองบอกว่า 'ฉันไปช้อปปิ้ง' ดูครับ พูดว่าไงดี?",
    emoji: '🛍️',
    label: 'shopping',
    hintFrame: 'I went...',
  },
  tell3: {
    expected: 'I had fun.',
    textEn: "แล้วบอกว่า 'ฉันสนุกมาก' ล่ะครับ?",
    emoji: '😄',
    label: 'had fun',
    hintFrame: 'I had...',
  },
  ask1: {
    expected: 'What did you do last weekend?',
    textEn:
      'เยี่ยมเลยครับ! คราวนี้ลองถามเพื่อนว่าสุดสัปดาห์ทำอะไร ให้พูดว่า What did you do last weekend? ครับ',
    emoji: '❓',
    label: 'what did you do',
    hintFrame: 'What did you...',
  },
  ask2: {
    expected: 'Did you have fun?',
    textEn: 'คราวนี้ลองถามเองดูครับ ว่าสนุกไหม พูดว่าไงดี?',
    emoji: '🎉',
    label: 'have fun?',
    hintFrame: 'Did you...',
  },
  skillLine: 'วันนี้คุณเล่าและถามเรื่องสุดสัปดาห์ที่แล้วได้แล้ว',
  nextHint: 'Vacation',
});

export const VACATION = makePatternLesson({
  hookTh:
    'เคยไปเที่ยวที่ไหนมาบ้างครับ? วันนี้มาลองเล่าทริปที่ประทับใจเป็นภาษาอังกฤษกันครับ!',
  step1CueTh: "ถ้าจะบอกว่า 'ฉันไปญี่ปุ่น' พูดว่าไงดีครับ?",
  tell1: {
    expected: 'I went to Japan.',
    textEn: '',
    emoji: '🇯🇵',
    label: 'Japan',
    hintFrame: 'I went to...',
  },
  tell2: {
    expected: 'I went to Korea.',
    textEn: "คราวนี้ลองบอกว่า 'ฉันไปเกาหลี' ดูครับ พูดว่าไงดี?",
    emoji: '🇰🇷',
    label: 'Korea',
    hintFrame: 'I went to...',
  },
  tell3: {
    expected: 'I stayed at a hotel.',
    textEn: "แล้วบอกว่า 'ฉันพักที่โรงแรม' ล่ะครับ?",
    emoji: '🏨',
    label: 'hotel',
    hintFrame: 'I stayed at...',
  },
  ask1: {
    expected: 'Where did you go on vacation?',
    textEn:
      'เยี่ยมเลยครับ! คราวนี้ลองถามว่าไปเที่ยวที่ไหน ให้พูดว่า Where did you go on vacation? ครับ',
    emoji: '✈️',
    label: 'where',
    hintFrame: 'Where did you...',
  },
  ask2: {
    expected: 'Did you take many photos?',
    textEn: 'คราวนี้ลองถามเองดูครับ ว่าถ่ายรูปเยอะไหม พูดว่าไงดี?',
    emoji: '📸',
    label: 'photos?',
    hintFrame: 'Did you...',
  },
  skillLine: 'วันนี้คุณเล่าและถามเรื่องท่องเที่ยวในอดีตได้แล้ว',
  nextHint: 'Birthday',
});

export const BIRTHDAY = makePatternLesson({
  hookTh:
    'วันเกิดครั้งล่าสุดเป็นยังไงบ้างครับ? ได้เค้ก ได้ของขวัญ หรือได้ฉลองกับใครบ้าง? วันนี้มาลองเล่าเรื่องวันเกิดกันครับ!',
  step1CueTh: "ถ้าจะบอกว่า 'ฉันจัดงานวันเกิด' พูดว่าไงดีครับ?",
  tell1: {
    expected: 'I had a birthday party.',
    textEn: '',
    emoji: '🎉',
    label: 'party',
    hintFrame: 'I had a...',
  },
  tell2: {
    expected: 'I got a gift.',
    textEn: "คราวนี้ลองบอกว่า 'ฉันได้ของขวัญ' ดูครับ พูดว่าไงดี?",
    emoji: '🎁',
    label: 'gift',
    hintFrame: 'I got a...',
  },
  tell3: {
    expected: 'We ate cake together.',
    textEn: "แล้วบอกว่า 'เรากินเค้กด้วยกัน' ล่ะครับ?",
    emoji: '🍰',
    label: 'cake',
    hintFrame: 'We ate...',
  },
  ask1: {
    expected: 'How was your birthday?',
    textEn:
      'เยี่ยมเลยครับ! คราวนี้ลองถามว่าวันเกิดเป็นยังไง ให้พูดว่า How was your birthday? ครับ',
    emoji: '🎂',
    label: 'how was',
    hintFrame: 'How was...',
  },
  ask2: {
    expected: 'Did you get a gift?',
    textEn: 'คราวนี้ลองถามเองดูครับ ว่าได้ของขวัญไหม พูดว่าไงดี?',
    emoji: '🎁',
    label: 'gift?',
    hintFrame: 'Did you...',
  },
  skillLine: 'วันนี้คุณเล่าและถามเรื่องวันเกิดได้แล้ว',
  nextHint: 'School Memories',
});

export const SCHOOL = makePatternLesson({
  hookTh:
    'คิดถึงสมัยเรียนกันไหมครับ? วันนี้มาลองเล่าความทรงจำในโรงเรียนเป็นภาษาอังกฤษกันครับ!',
  step1CueTh: "ถ้าจะบอกว่า 'ฉันเรียนภาษาอังกฤษ' พูดว่าไงดีครับ?",
  tell1: {
    expected: 'I studied English.',
    textEn: '',
    emoji: '📚',
    label: 'studied',
    hintFrame: 'I studied...',
  },
  tell2: {
    expected: 'I played football.',
    textEn: "คราวนี้ลองบอกว่า 'ฉันเล่นฟุตบอล' ดูครับ พูดว่าไงดี?",
    emoji: '⚽',
    label: 'football',
    hintFrame: 'I played...',
  },
  tell3: {
    expected: "I didn't like homework.",
    textEn: "แล้วบอกว่า 'ฉันไม่ชอบการบ้าน' ล่ะครับ?",
    emoji: '📝',
    label: "didn't like",
    hintFrame: "I didn't like...",
  },
  ask1: {
    expected: 'What did you do at school?',
    textEn:
      'เยี่ยมเลยครับ! คราวนี้ลองถามว่าที่โรงเรียนทำอะไร ให้พูดว่า What did you do at school? ครับ',
    emoji: '🏫',
    label: 'what did you do',
    hintFrame: 'What did you...',
  },
  ask2: {
    expected: 'Did you like homework?',
    textEn: 'คราวนี้ลองถามเองดูครับ ว่าชอบการบ้านไหม พูดว่าไงดี?',
    emoji: '📝',
    label: 'homework?',
    hintFrame: 'Did you...',
  },
  skillLine: 'วันนี้คุณเล่าและถามความทรงจำโรงเรียนได้แล้ว',
  nextHint: 'Funny Story',
});

export const FUNNY = makePatternLesson({
  hookTh:
    'เคยมีเรื่องฮาๆ ที่ยังจำได้ไหมครับ? วันนี้มาลองเล่าเรื่องสนุกๆ เป็นภาษาอังกฤษกันครับ!',
  step1CueTh: "ถ้าจะบอกว่า 'ก่อนอื่น ฉันลืมกระเป๋า' พูดว่าไงดีครับ?",
  tell1: {
    expected: 'First, I forgot my bag.',
    textEn: '',
    emoji: '🎒',
    label: 'forgot bag',
    hintFrame: 'First, I...',
  },
  tell2: {
    expected: 'Then, I lost my phone.',
    textEn: "คราวนี้ลองบอกว่า 'แล้วก็ทำโทรศัพท์หาย' ดูครับ พูดว่าไงดี?",
    emoji: '📱',
    label: 'lost phone',
    hintFrame: 'Then, I...',
  },
  tell3: {
    expected: 'Everyone laughed.',
    textEn: "แล้วบอกว่า 'ทุกคนหัวเราะ' ล่ะครับ?",
    emoji: '😂',
    label: 'laughed',
    hintFrame: 'Everyone...',
  },
  ask1: {
    expected: 'What happened first?',
    textEn:
      'เยี่ยมเลยครับ! คราวนี้ลองถามว่าเกิดอะไรขึ้นก่อน ให้พูดว่า What happened first? ครับ',
    emoji: '1️⃣',
    label: 'first?',
    hintFrame: 'What happened...',
  },
  ask2: {
    expected: 'What happened next?',
    textEn: 'คราวนี้ลองถามเองดูครับ ว่าเกิดอะไรต่อ พูดว่าไงดี?',
    emoji: '2️⃣',
    label: 'next?',
    hintFrame: 'What happened...',
  },
  skillLine: 'วันนี้คุณเล่าเรื่องตลกด้วย First / Then ได้แล้ว',
  nextHint: 'Bad Day',
});

export const BAD_DAY = makePatternLesson({
  hookTh:
    'ทุกคนเคยมีวันที่ไม่ค่อยดีใช่ไหมครับ? วันนี้มาลองเล่าเรื่องวันที่แย่ๆ เป็นภาษาอังกฤษกันครับ!',
  step1CueTh: "ถ้าจะบอกว่า 'ฉันมาสายเพราะรถติด' พูดว่าไงดีครับ?",
  tell1: {
    expected: 'I was late because of traffic.',
    textEn: '',
    emoji: '🚗',
    label: 'late',
    hintFrame: 'I was late because...',
  },
  tell2: {
    expected: 'It rained, so I took the bus.',
    textEn: "คราวนี้ลองบอกว่า 'ฝนตก เลยขึ้นรถเมล์' ดูครับ พูดว่าไงดี?",
    emoji: '🚌',
    label: 'bus',
    hintFrame: 'It rained, so...',
  },
  tell3: {
    expected: 'I was tired because of the rain.',
    textEn: "แล้วบอกว่า 'ฉันเหนื่อยเพราะฝน' ล่ะครับ?",
    emoji: '😫',
    label: 'tired',
    hintFrame: 'I was tired because...',
  },
  ask1: {
    expected: 'What happened?',
    textEn:
      'เยี่ยมเลยครับ! คราวนี้ลองถามว่าเกิดอะไรขึ้น ให้พูดว่า What happened? ครับ',
    emoji: '❓',
    label: 'what happened',
    hintFrame: 'What happened...',
  },
  ask2: {
    expected: 'Did you have an umbrella?',
    textEn: 'คราวนี้ลองถามเองดูครับ ว่ามีร่มไหม พูดว่าไงดี?',
    emoji: '☂️',
    label: 'umbrella?',
    hintFrame: 'Did you...',
  },
  skillLine: 'วันนี้คุณเล่าวันที่แย่ด้วย because / so ได้แล้ว',
  nextHint: 'First Time',
});

export const FIRST_TIME = makePatternLesson({
  hookTh:
    'จำครั้งแรกที่ลองทำอะไรใหม่ๆ ได้ไหมครับ? วันนี้มาลองเล่า First Time ของคุณกันครับ!',
  step1CueTh: "ถ้าจะบอกว่า 'เป็นครั้งแรกของฉัน' พูดว่าไงดีครับ?",
  tell1: {
    expected: 'It was my first time.',
    textEn: '',
    emoji: '✨',
    label: 'first time',
    hintFrame: 'It was my...',
  },
  tell2: {
    expected: 'It was my first time on an airplane.',
    textEn:
      "คราวนี้ลองบอกว่า 'เป็นครั้งแรกที่ขึ้นเครื่องบิน' ดูครับ พูดว่าไงดี?",
    emoji: '✈️',
    label: 'airplane',
    hintFrame: 'It was my first time on...',
  },
  tell3: {
    expected: 'I was excited.',
    textEn: "แล้วบอกว่า 'ฉันตื่นเต้น' ล่ะครับ?",
    emoji: '🤩',
    label: 'excited',
    hintFrame: 'I was...',
  },
  ask1: {
    expected: 'Was it your first time?',
    textEn:
      'เยี่ยมเลยครับ! คราวนี้ลองถามว่าเป็นครั้งแรกไหม ให้พูดว่า Was it your first time? ครับ',
    emoji: '❓',
    label: 'first time?',
    hintFrame: 'Was it...',
  },
  ask2: {
    expected: 'Did you enjoy it?',
    textEn: 'คราวนี้ลองถามเองดูครับ ว่าสนุกไหม พูดว่าไงดี?',
    emoji: '😊',
    label: 'enjoy?',
    hintFrame: 'Did you...',
  },
  skillLine: 'วันนี้คุณเล่าและถามประสบการณ์ครั้งแรกได้แล้ว',
  nextHint: 'Favorite Memory',
});

export const FAVORITE = makePatternLesson({
  hookTh:
    'ถ้าให้นึกถึงความทรงจำที่ชอบที่สุด คุณจะนึกถึงเรื่องอะไรครับ? วันนี้มาลองเล่าให้ AI ฟังกันครับ!',
  step1CueTh:
    "ถ้าจะบอกว่า 'ความทรงจำโปรดคือทริปครอบครัว' พูดว่าไงดีครับ?",
  tell1: {
    expected: 'My favorite memory was our family trip.',
    textEn: '',
    emoji: '👨‍👩‍👧‍👦',
    label: 'family trip',
    hintFrame: 'My favorite memory was...',
  },
  tell2: {
    expected: 'My favorite memory was our holiday.',
    textEn:
      "คราวนี้ลองบอกว่า 'ความทรงจำโปรดคือวันหยุด' ดูครับ พูดว่าไงดี?",
    emoji: '🌴',
    label: 'holiday',
    hintFrame: 'My favorite memory was...',
  },
  tell3: {
    expected: 'We were happy because we were together.',
    textEn:
      "แล้วบอกว่า 'เรามีความสุขเพราะได้อยู่ด้วยกัน' ล่ะครับ?",
    emoji: '💛',
    label: 'happy',
    hintFrame: 'We were happy because...',
  },
  ask1: {
    expected: "What's your favorite memory?",
    textEn:
      "เยี่ยมเลยครับ! คราวนี้ลองถามว่าความทรงจำโปรดคืออะไร ให้พูดว่า What's your favorite memory? ครับ",
    emoji: '💭',
    label: 'favorite?',
    hintFrame: "What's your...",
  },
  ask2: {
    expected: 'Why was it special?',
    textEn: 'คราวนี้ลองถามเองดูครับ ว่าทำไมถึงพิเศษ พูดว่าไงดี?',
    emoji: '✨',
    label: 'why special?',
    hintFrame: 'Why was...',
  },
  skillLine: 'วันนี้คุณเล่าและถามความทรงจำโปรดได้แล้ว',
  nextHint: 'Last Night',
});

export const {
  boardForStep: lastWeekendBoardForStep,
  scoreStep: scoreLastWeekendStep,
  lessonProgress: lastWeekendLessonProgress,
  openingText: lastWeekendOpeningText,
  celebrate: lastWeekendCelebrate,
} = LAST_WEEKEND;

export const {
  boardForStep: vacationBoardForStep,
  scoreStep: scoreVacationStep,
  lessonProgress: vacationLessonProgress,
  openingText: vacationOpeningText,
  celebrate: vacationCelebrate,
} = VACATION;

export const {
  boardForStep: birthdayBoardForStep,
  scoreStep: scoreBirthdayStep,
  lessonProgress: birthdayLessonProgress,
  openingText: birthdayOpeningText,
  celebrate: birthdayCelebrate,
} = BIRTHDAY;

export const {
  boardForStep: schoolBoardForStep,
  scoreStep: scoreSchoolStep,
  lessonProgress: schoolLessonProgress,
  openingText: schoolOpeningText,
  celebrate: schoolCelebrate,
} = SCHOOL;

export const {
  boardForStep: funnyBoardForStep,
  scoreStep: scoreFunnyStep,
  lessonProgress: funnyLessonProgress,
  openingText: funnyOpeningText,
  celebrate: funnyCelebrate,
} = FUNNY;

export const {
  boardForStep: badDayBoardForStep,
  scoreStep: scoreBadDayStep,
  lessonProgress: badDayLessonProgress,
  openingText: badDayOpeningText,
  celebrate: badDayCelebrate,
} = BAD_DAY;

export const {
  boardForStep: firstTimeBoardForStep,
  scoreStep: scoreFirstTimeStep,
  lessonProgress: firstTimeLessonProgress,
  openingText: firstTimeOpeningText,
  celebrate: firstTimeCelebrate,
} = FIRST_TIME;

export const {
  boardForStep: favoriteBoardForStep,
  scoreStep: scoreFavoriteStep,
  lessonProgress: favoriteLessonProgress,
  openingText: favoriteOpeningText,
  celebrate: favoriteCelebrate,
} = FAVORITE;

// ─── Last Night (6) → roleplay ──────────────────────────────────────────────

const LAST_NIGHT_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: 'I was...',
      expectedSpeech: 'I was watching TV.',
      options: [
        { emoji: '📺', label: 'watching TV', speak: 'I was watching TV.' },
        { emoji: '🍳', label: 'cooking', speak: 'I was cooking.' },
        { emoji: '😴', label: 'sleeping', speak: 'I was sleeping.' },
      ],
    },
    structureHint('I was...'),
    'He was cooking.',
  ),
  2: withHints(
    {
      textEn: "แล้วถ้าพูดถึงเพื่อนว่า 'เขากำลังทำอาหาร' ล่ะครับ?",
      stem: 'He was...',
      expectedSpeech: 'He was cooking.',
      options: [
        { emoji: '🍳', label: 'cooking', speak: 'He was cooking.' },
        {
          emoji: '📱',
          label: 'using his phone',
          speak: 'He was using his phone.',
        },
      ],
    },
    structureHint('He was...'),
    'She was reading.',
  ),
  3: withHints(
    {
      textEn: 'He / She ก็ใช้ was เหมือนกันครับ',
      stem: 'She was...',
      expectedSpeech: 'She was reading.',
      options: [
        { emoji: '📖', label: 'reading', speak: 'She was reading.' },
        { emoji: '💻', label: 'working', speak: 'She was working.' },
      ],
    },
    structureHint('She was...'),
    'They were playing games.',
  ),
  4: withHints(
    {
      textEn:
        'ถ้ามีหลายคนกำลังทำอะไรอยู่ เราใช้ were ครับ I / He / She → was · You / We / They → were',
      stem: 'They were...',
      expectedSpeech: 'They were playing games.',
      options: [
        {
          emoji: '🎮',
          label: 'playing games',
          speak: 'They were playing games.',
        },
        { emoji: '🍽️', label: 'eating', speak: 'They were eating.' },
        { emoji: '🗣️', label: 'talking', speak: 'They were talking.' },
      ],
    },
    structureHint('They were...'),
    'I was watching TV when my friend called.',
  ),
  5: withHints(
    {
      textEn:
        'ทีนี้เพิ่มความสนุกครับ... ระหว่างที่กำลังทำอะไรอยู่ มีบางอย่างเกิดขึ้น! สิ่งที่กำลังเกิดอยู่ใช้ was/were + ing ส่วนเหตุการณ์ที่เข้ามาแทรกใช้กริยาอดีตครับ',
      stem: 'I was ___ when...',
      expectedSpeech: 'I was watching TV when my friend called.',
      options: [
        {
          emoji: '📺📞',
          label: 'TV + call',
          speak: 'I was watching TV when my friend called.',
        },
        {
          emoji: '🍳⚡',
          label: 'cook + lights',
          speak: 'I was cooking when the lights went out.',
        },
      ],
    },
    structureHint('I was ... when...'),
    'I was cooking when the lights went out.',
  ),
  6: withHints(
    {
      textEn:
        'ลองอีกประโยคครับ — I was ___ when… แล้วมีเหตุการณ์แทรกเข้ามา',
      stem: 'I was ___ when...',
      expectedSpeech: 'I was cooking when the lights went out.',
      options: [
        {
          emoji: '🍳⚡',
          label: 'cook + lights',
          speak: 'I was cooking when the lights went out.',
        },
        {
          emoji: '📺📞',
          label: 'TV + call',
          speak: 'I was watching TV when my friend called.',
        },
      ],
    },
    structureHint('I was ... when...'),
  ),
};

export function lastNightBoardForStep(step: number): ForcedGuidedBoard | null {
  return LAST_NIGHT_BOARDS[step] ?? null;
}

export const scoreLastNightStep = makeScorer(lastNightBoardForStep);
export const lastNightLessonProgress = makeProgress(6, scoreLastNightStep);

export function lastNightOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}เมื่อคืนตอนเกิดเรื่องบางอย่างขึ้น คุณกำลังทำอะไรอยู่? วันนี้เราจะฝึกเล่าเหตุการณ์แบบนี้เป็นภาษาอังกฤษครับ!\n\nถ้าจะบอกว่า 'เมื่อคืนสองทุ่ม ฉันกำลังดูทีวี' พูดว่า I was watching TV ครับ — เลือกจากตัวเลือกบนจอได้เลยครับ`;
}
