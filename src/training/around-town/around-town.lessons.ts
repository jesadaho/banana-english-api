import {
  aroundTownRoleplayIntroSpeech,
  computeThreeTierChoiceProgress,
  createBoardChoiceScorer,
  SMART_SHOPPER_BOARDS,
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
  if (expected && (t === expected || t.includes(expected) || expected.includes(t))) {
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

// ─── Shopping (4) ───────────────────────────────────────────────────────────

const SHOPPING_VOCAB_OPTIONS = [
  { emoji: '👕', label: 'shirt', speak: 'shirt' },
  { emoji: '👖', label: 'pants', speak: 'pants' },
  { emoji: '👟', label: 'shoes', speak: 'shoes' },
  { emoji: '🧢', label: 'cap', speak: 'cap' },
];

const SHOPPING_LOOKING_FOR_OPTIONS = [
  { emoji: '👕', label: 'shirt', speak: "I'm looking for a shirt." },
  { emoji: '👖', label: 'pants', speak: "I'm looking for pants." },
  { emoji: '👟', label: 'shoes', speak: "I'm looking for shoes." },
  { emoji: '🧢', label: 'cap', speak: "I'm looking for a cap." },
];

const SHOPPING_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: '',
      expectedSpeech: 'shirt',
      options: SHOPPING_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "เสื้อ" คือ shirt ครับ',
    'What about pants?',
  ),
  2: withHints(
    {
      textEn: 'เยี่ยมเลยครับ! "กางเกง" ล่ะครับ?',
      advanceQuestionEn: 'What about pants?',
      stem: '',
      expectedSpeech: 'pants',
      options: SHOPPING_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "กางเกง" คือ pants ครับ',
    "I'm looking for a shirt.",
  ),
  3: withHints(
    {
      textEn:
        'เยี่ยมเลยครับ! ถ้าจะบอกว่ากำลังหาเสื้ออยู่ ให้พูดว่า I\'m looking for a shirt. ไหนลองบอกหน่อยครับว่าคุณกำลังหาอะไรอยู่ 😊',
      advanceQuestionEn: "What are you looking for?",
      stem: "I'm looking for a...",
      expectedSpeech: "I'm looking for a shirt.",
      options: SHOPPING_LOOKING_FOR_OPTIONS.map((o) => ({ ...o })),
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'm looking for a... ครับ",
    'How much is this?',
  ),
  4: withHints(
    {
      textEn:
        'เยี่ยมเลยครับ! ต่อมาเรามาฝึกถามราคากันครับ ถ้าจะถามว่า "ราคาเท่าไหร่" ให้พูดว่า How much is this? ไหนลองถามราคาเสื้อตัวนี้ดูหน่อยครับ',
      advanceQuestionEn: 'How much is this?',
      stem: '',
      expectedSpeech: 'How much is this?',
      options: [
        { emoji: '👕', label: 'shirt', speak: 'How much is this?' },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง How much is... ครับ',
  ),
};

export function shoppingBoardForStep(step: number): ForcedGuidedBoard | null {
  return SHOPPING_BOARDS[step] ?? null;
}

export const scoreShoppingStep = makeScorer(shoppingBoardForStep);
export const shoppingLessonProgress = makeProgress(4, scoreShoppingStep);

export function shoppingOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}วันนี้เราจะไปซื้อเสื้อผ้ากันครับ 👕 มาเรียนประโยคที่ใช้บ่อยที่สุดในร้านค้ากันครับ! "เสื้อ" ในภาษาอังกฤษเรียกว่าอะไรนะครับ?`;
}

// ─── Restaurant (4) ─────────────────────────────────────────────────────────

const RESTAURANT_VOCAB_OPTIONS = [
  { emoji: '🍗', label: 'chicken', speak: 'chicken' },
  { emoji: '🍚', label: 'rice', speak: 'rice' },
  { emoji: '🥤', label: 'water', speak: 'water' },
  { emoji: '🍕', label: 'pizza', speak: 'pizza' },
];

const RESTAURANT_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: '',
      expectedSpeech: 'chicken',
      options: RESTAURANT_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "ไก่" คือ chicken ครับ',
    'What about rice?',
  ),
  2: withHints(
    {
      textEn: 'เยี่ยมเลยครับ! "ข้าว" ล่ะครับ?',
      advanceQuestionEn: 'What about rice?',
      stem: '',
      expectedSpeech: 'rice',
      options: RESTAURANT_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "ข้าว" คือ rice ครับ',
    "I'd like rice.",
  ),
  3: withHints(
    {
      textEn:
        "เยี่ยมเลยครับ! ถ้าจะสั่งอาหาร ให้พูดว่า I'd like chicken. ไหนลองฝึกสั่งอาหารตามภาพดูนะครับ? 😊",
      advanceQuestionEn: "How do you say I'd like rice?",
      stem: "I'd like...",
      expectedSpeech: "I'd like rice.",
      options: [
        { emoji: '🍚', label: 'rice', speak: "I'd like rice." },
      ],
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'd like... ครับ",
    'What do you recommend?',
  ),
  4: withHints(
    {
      textEn:
        'เยี่ยมเลยครับ! ถ้าไม่รู้จะสั่งอะไร สามารถถามพนักงานว่า What do you recommend? ลองพูดตามนะครับ',
      advanceQuestionEn: 'What do you recommend?',
      stem: '',
      expectedSpeech: 'What do you recommend?',
      options: [
        {
          emoji: '🍽️',
          label: 'recommend',
          speak: 'What do you recommend?',
        },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง What do you... ครับ',
  ),
};

export function restaurantBoardForStep(step: number): ForcedGuidedBoard | null {
  return RESTAURANT_BOARDS[step] ?? null;
}

export const scoreRestaurantStep = makeScorer(restaurantBoardForStep);
export const restaurantLessonProgress = makeProgress(4, scoreRestaurantStep);

export function restaurantOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}วันนี้เราจะไปร้านอาหารกันครับ 🍽️ มาเรียนประโยคที่ใช้บ่อยเวลาไปทานอาหารกันครับ! "ไก่" ในภาษาอังกฤษเรียกว่าอะไรนะครับ?`;
}

// ─── Coffee (4) ─────────────────────────────────────────────────────────────

const COFFEE_VOCAB_OPTIONS = [
  { emoji: '☕', label: 'coffee', speak: 'coffee' },
  { emoji: '🍵', label: 'tea', speak: 'tea' },
  { emoji: '🥛', label: 'milk', speak: 'milk' },
  { emoji: '🍰', label: 'cake', speak: 'cake' },
];

const COFFEE_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: '',
      expectedSpeech: 'coffee',
      options: COFFEE_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "กาแฟ" คือ coffee ครับ',
    'What about tea?',
  ),
  2: withHints(
    {
      textEn: 'เยี่ยมเลยครับ! "ชา" ล่ะครับ?',
      advanceQuestionEn: 'What about tea?',
      stem: '',
      expectedSpeech: 'tea',
      options: COFFEE_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "ชา" คือ tea ครับ',
    'Can I get tea?',
  ),
  3: withHints(
    {
      textEn:
        'เยี่ยมเลยครับ! ถ้าจะสั่งกาแฟ ให้พูดว่า Can I get a coffee? ไหนลองสั่งเครื่องดื่มดูครับ 😊',
      advanceQuestionEn: 'Can I get tea?',
      stem: 'Can I get...',
      expectedSpeech: 'Can I get tea.',
      options: [
        { emoji: '🍵', label: 'tea', speak: 'Can I get tea?' },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง Can I get... ครับ',
    'Can I get cake?',
  ),
  4: withHints(
    {
      textEn: 'เยี่ยมเลยครับ! แล้วลองสั่งเค้กดูครับ 😊',
      advanceQuestionEn: 'Can I get cake?',
      stem: 'Can I get...',
      expectedSpeech: 'Can I get cake.',
      options: [
        { emoji: '🍰', label: 'cake', speak: 'Can I get cake?' },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง Can I get... ครับ',
  ),
};

export function coffeeBoardForStep(step: number): ForcedGuidedBoard | null {
  return COFFEE_BOARDS[step] ?? null;
}

export const scoreCoffeeStep = makeScorer(coffeeBoardForStep);
export const coffeeLessonProgress = makeProgress(4, scoreCoffeeStep);

export function coffeeOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}เช้า ๆ แบบนี้ รับกาแฟสักแก้วไหมครับ? ☕ วันนี้มาฝึกสั่งกาแฟแก้วโปรดเป็นภาษาอังกฤษกันครับ! "กาแฟ" ในภาษาอังกฤษเรียกว่าอะไรนะครับ?`;
}

// ─── Convenience / Explore the City (4) ─────────────────────────────────────

const CONVENIENCE_LOOKING_OPTIONS = [
  {
    emoji: '🏛️',
    label: 'museum',
    speak: "I'm looking for the museum.",
  },
  { emoji: '🌳', label: 'park', speak: "I'm looking for the park." },
  {
    emoji: '🛕',
    label: 'temple',
    speak: "I'm looking for the temple.",
  },
  { emoji: '🗺️', label: 'map', speak: "I'm looking for the map." },
];

const CONVENIENCE_LANDMARK_OPTIONS = [
  { emoji: '🕰️', label: 'Big Ben', speak: 'Where is Big Ben?' },
  {
    emoji: '🎡',
    label: 'London Eye',
    speak: 'Where is the London Eye?',
  },
  {
    emoji: '🌉',
    label: 'Tower Bridge',
    speak: 'Where is Tower Bridge?',
  },
];

const CONVENIENCE_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: "I'm looking for the...",
      expectedSpeech: "I'm looking for the museum.",
      options: [
        {
          emoji: '🏛️',
          label: 'museum',
          speak: "I'm looking for the museum.",
        },
      ],
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'm looking for the... ครับ",
    "I'm looking for the park.",
  ),
  2: withHints(
    {
      textEn: 'แล้วตอนนี้คุณกำลังหาที่ไหนอยู่ครับ? 😊',
      advanceQuestionEn: "What are you looking for?",
      stem: "I'm looking for the...",
      expectedSpeech: "I'm looking for the park.",
      options: CONVENIENCE_LOOKING_OPTIONS.map((o) => ({ ...o })),
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'm looking for the... ครับ",
    'Where is the museum?',
  ),
  3: withHints(
    {
      textEn:
        'เยี่ยมเลยครับ! ถ้าจะถามทางตรง ๆ ให้พูดว่า Where is the museum? ลองพูดตามนะครับ',
      advanceQuestionEn: 'Where is the museum?',
      stem: 'Where is the...',
      expectedSpeech: 'Where is the museum?',
      options: [
        {
          emoji: '🏛️',
          label: 'museum',
          speak: 'Where is the museum?',
        },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง Where is the... ครับ',
    'Where is Big Ben?',
  ),
  4: withHints(
    {
      textEn: 'ไหนลองถามหาสถานที่ดูครับ 😊',
      advanceQuestionEn: 'Where is Big Ben?',
      stem: 'Where is...',
      expectedSpeech: 'Where is Big Ben?',
      options: CONVENIENCE_LANDMARK_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ ลองใช้โครง Where is... ครับ',
  ),
};

export function convenienceBoardForStep(
  step: number,
): ForcedGuidedBoard | null {
  return CONVENIENCE_BOARDS[step] ?? null;
}

export const scoreConvenienceStep = makeScorer(convenienceBoardForStep);
export const convenienceLessonProgress = makeProgress(
  4,
  scoreConvenienceStep,
);

export function convenienceOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}วันนี้เราจะออกไปเดินเที่ยวในเมืองกันครับ! 🗺️ มาฝึกถามหาสถานที่เป็นภาษาอังกฤษกันครับ!\nคุณเพิ่งมาถึง London 🇬🇧 แต่หลงทางซะแล้ว 😅\nคุณอยากไปพิพิธภัณฑ์ คุณจะบอกคนท้องถิ่นว่าอย่างไรครับ?`;
}

// ─── Transport (4) ──────────────────────────────────────────────────────────

const TRANSPORT_CITY_OPTIONS = [
  { emoji: '🏙️', label: 'London', speak: "I'm going to London." },
  { emoji: '🗼', label: 'Paris', speak: "I'm going to Paris." },
  { emoji: '🏯', label: 'Tokyo', speak: "I'm going to Tokyo." },
  {
    emoji: '🗽',
    label: 'New York',
    speak: "I'm going to New York.",
  },
];

const TRANSPORT_MODE_OPTIONS = [
  { emoji: '🚆', label: 'Train', speak: "I'm taking the train." },
  { emoji: '🚌', label: 'Bus', speak: "I'm taking the bus." },
  { emoji: '🚕', label: 'Taxi', speak: "I'm taking the taxi." },
  { emoji: '✈️', label: 'Plane', speak: "I'm taking the plane." },
];

const TRANSPORT_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: "I'm going to...",
      expectedSpeech: "I'm going to London.",
      options: TRANSPORT_CITY_OPTIONS.map((o) => ({ ...o })),
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'm going to... ครับ",
    "I'm going to Paris.",
  ),
  2: withHints(
    {
      textEn:
        'เยี่ยมเลยครับ! 👍 ต่อไปลองบอกว่ากำลังจะไปเมืองนี้ดูครับ... พูดว่าไงดี?',
      advanceQuestionEn: "I'm going to Paris.",
      stem: "I'm going to...",
      expectedSpeech: "I'm going to Paris.",
      options: TRANSPORT_CITY_OPTIONS.map((o) => ({ ...o })),
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'm going to... ครับ",
    "I'm taking the train.",
  ),
  3: withHints(
    {
      textEn:
        "ต่อไป ถ้าจะบอกว่าเดินทางไปด้วยอะไร ให้พูดว่า I'm taking the... แล้วตามด้วยยานพาหนะครับ เลือกวิธีเดินทางที่คุณชอบ แล้วลองบอกหน่อยครับ",
      advanceQuestionEn: "How are you traveling?",
      stem: "I'm taking the...",
      expectedSpeech: "I'm taking the train.",
      options: TRANSPORT_MODE_OPTIONS.map((o) => ({ ...o })),
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'm taking the... ครับ",
    "I'm taking the bus.",
  ),
  4: withHints(
    {
      textEn: 'อีกข้อนะครับ... ลองบอกว่าจะนั่งรถบัสดูครับ!',
      advanceQuestionEn: "I'm taking the bus.",
      stem: "I'm taking the...",
      expectedSpeech: "I'm taking the bus.",
      options: TRANSPORT_MODE_OPTIONS.map((o) => ({ ...o })),
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'm taking the... ครับ",
  ),
};

export function transportBoardForStep(step: number): ForcedGuidedBoard | null {
  return TRANSPORT_BOARDS[step] ?? null;
}

export const scoreTransportStep = makeScorer(transportBoardForStep);
export const transportLessonProgress = makeProgress(4, scoreTransportStep);

export function transportOpeningText(learnerFirstName: string): string {
  const name = learnerFirstName.trim();
  const greet = name ? `สวัสดีครับคุณ ${name}! ` : 'สวัสดีครับ! ';
  return `${greet}วันนี้เราจะออกเดินทางกันครับ! 🚆\nเลือกเมืองที่คุณอยากไป แล้วลองบอกครูพี่บีหน่อยครับ... Where are you going?`;
}

// ─── Smart Shopper (7) ──────────────────────────────────────────────────────

const SMART_SHOPPER_HINTS: Record<number, string> = {
  1: "ยังไม่ตรงครับ ลองใช้โครง Which one is... ครับ",
  2: "ยังไม่ตรงครับ ลองใช้โครง This one is... ครับ",
  3: "ยังไม่ตรงครับ ลองใช้โครง I'll take... ครับ",
  4: 'ยังไม่ตรงครับ ลองใช้โครง The blue one is... ครับ',
  5: 'ยังไม่ตรงครับ ลองใช้โครง The big one is... ครับ',
  6: 'ยังไม่ตรงครับ ลองใช้โครง Sandwich B is... ครับ',
  7: "ยังไม่ตรงครับ ลองใช้โครง I'll take... ครับ",
};

const SMART_SHOPPER_ADVANCE: Record<number, string | undefined> = {
  1: 'This one is bigger.',
  2: "I'll take this one.",
  3: 'Which one is cheaper?',
  4: 'Which one is bigger?',
  5: 'Which one is better?',
  6: 'So, which one do you want?',
  7: undefined,
};

export function smartShopperBoardForStep(
  step: number,
): ForcedGuidedBoard | null {
  const raw = SMART_SHOPPER_BOARDS[step];
  if (!raw) return null;
  return withHints(
    {
      textEn: step === 1 ? '' : raw.textEn,
      stem: raw.stem,
      expectedSpeech: raw.expectedSpeech,
      options: raw.options.map((o) => ({ ...o })),
    },
    SMART_SHOPPER_HINTS[step] ?? 'ยังไม่ตรงครับ ลองเลือกคำตอบบนจอครับ',
    SMART_SHOPPER_ADVANCE[step],
  );
}

function matchesSmartShopperLoose(step: number, text: string): boolean {
  const t = normalizeSpeech(text);
  if (!t) return false;
  switch (step) {
    case 1:
      return /\bwhich one is\b/.test(t) && /\b(cheaper|bigger|better)\b/.test(t);
    case 2:
      return /\bthis one is\b/.test(t) && /\b(cheaper|bigger|better)\b/.test(t);
    case 3:
      return (
        /\bi(?:'ll| will) take\b/.test(t) &&
        (/\bthis one\b/.test(t) ||
          /\bthe cheaper one\b/.test(t) ||
          /\bthe bigger one\b/.test(t)) &&
        !/\bblue\b/.test(t) &&
        !/\bsandwich\b/.test(t)
      );
    case 4:
      return (
        (/\bblue one is cheaper\b/.test(t) || /\bblue is cheaper\b/.test(t)) &&
        !/\bmore expensive\b/.test(t)
      );
    case 5:
      return /\bbig one is bigger\b/.test(t);
    case 6:
      return /\bsandwich b is better\b/.test(t) || /\bb is better\b/.test(t);
    case 7:
      return (
        /\bi(?:'ll| will) take\b/.test(t) &&
        (/\bblue\b/.test(t) ||
          /\bbig one\b/.test(t) ||
          /\bbig water\b/.test(t) ||
          /\bsandwich\b/.test(t))
      );
    default:
      return anyOptionLoose(smartShopperBoardForStep(step), text);
  }
}

export const scoreSmartShopperStep = makeScorer(
  smartShopperBoardForStep,
  matchesSmartShopperLoose,
);
export const smartShopperLessonProgress = makeProgress(
  7,
  scoreSmartShopperStep,
);

export function smartShopperOpeningText(learnerFirstName: string): string {
  const greet = greetName(learnerFirstName);
  const hook =
    'เข้าเซเว่นเลือกของไม่ถูก... อันไหนคุ้มกว่า ถอดรหัสเปรียบเทียบใน 3 นาทีกันครับ!';
  const board1 = SMART_SHOPPER_BOARDS[1]?.textEn?.trim() ?? '';
  return `${greet}${hook}\n\n${board1}`;
}

// ─── Hotel (5) ──────────────────────────────────────────────────────────────

const HOTEL_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: '',
      expectedSpeech: 'I have a reservation.',
      options: [
        {
          emoji: '🏨',
          label: 'reservation',
          speak: 'I have a reservation.',
        },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง I have a... ครับ',
    "I'd like to check in.",
  ),
  2: withHints(
    {
      textEn:
        "เยี่ยมเลยครับ! คราวนี้ถ้าจะบอกว่า ขอเช็กอินครับ... ลองพูดว่าไงดีครับ?",
      advanceQuestionEn: "I'd like to check in.",
      stem: '',
      expectedSpeech: "I'd like to check in.",
      options: [
        {
          emoji: '🔑',
          label: 'check in',
          speak: "I'd like to check in.",
        },
      ],
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'd like to... ครับ",
    'Here is my passport.',
  ),
  3: withHints(
    {
      textEn: 'ถ้าจะยื่นเอกสาร นี่พาสปอร์ตของฉัน... ลองพูดสิครับ',
      advanceQuestionEn: 'Here is my passport.',
      stem: '',
      expectedSpeech: 'Here is my passport.',
      options: [
        {
          emoji: '🛂',
          label: 'passport',
          speak: 'Here is my passport.',
        },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง Here is my... ครับ',
    'What time is breakfast?',
  ),
  4: withHints(
    {
      textEn:
        'คราวนี้ลองถามเรื่องอาหารเช้า... โดยพูดว่า What time is breakfast? ... ลองเลยครับ',
      advanceQuestionEn: 'What time is breakfast?',
      stem: '',
      expectedSpeech: 'What time is breakfast?',
      options: [
        {
          emoji: '🍳',
          label: 'breakfast',
          speak: 'What time is breakfast?',
        },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง What time is... ครับ',
    'Where is my room?',
  ),
  5: withHints(
    {
      textEn: 'คราวนี้ลองถามเองดูครับ เรื่องห้อง พูดว่าไงดี?',
      advanceQuestionEn: 'Where is my room?',
      stem: '',
      expectedSpeech: 'Where is my room?',
      options: [
        { emoji: '🛏️', label: 'room', speak: 'Where is my room?' },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง Where is my... ครับ',
  ),
};

export function hotelBoardForStep(step: number): ForcedGuidedBoard | null {
  return HOTEL_BOARDS[step] ?? null;
}

export const scoreHotelStep = makeScorer(hotelBoardForStep);
export const hotelLessonProgress = makeProgress(5, scoreHotelStep);

export function hotelOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}ถึงโรงแรมแล้วครับ! วันนี้มาฝึกเช็กอินแบบสั้นๆ กันครับ ถ้าจะบอกพนักงานต้อนรับว่า จองห้องไว้ ให้พูดว่า... I have a reservation. ... ลองพูดดูครับ`;
}

// ─── Airport (4) ────────────────────────────────────────────────────────────

const AIRPORT_VOCAB_OPTIONS = [
  { emoji: '🛂', label: 'passport', speak: 'passport' },
  { emoji: '✈️', label: 'flight', speak: 'flight' },
  {
    emoji: '🎫',
    label: 'boarding pass',
    speak: 'boarding pass',
  },
  { emoji: '🧳', label: 'baggage', speak: 'baggage' },
];

const AIRPORT_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: '',
      expectedSpeech: 'passport',
      options: AIRPORT_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "พาสปอร์ต" คือ passport ครับ',
    'What about flight?',
  ),
  2: withHints(
    {
      textEn: 'เยี่ยมเลยครับ! "เที่ยวบิน" ล่ะครับ?',
      advanceQuestionEn: 'What about flight?',
      stem: '',
      expectedSpeech: 'flight',
      options: AIRPORT_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "เที่ยวบิน" คือ flight ครับ',
    "I'd like to check in.",
  ),
  3: withHints(
    {
      textEn:
        "เยี่ยมเลยครับ! ถ้าจะบอกพนักงานว่า ขอเช็กอินครับ ให้พูดว่า I'd like to check in. ไหนลองพูดขอเช็กอินดูนะครับ? 😊",
      advanceQuestionEn: "I'd like to check in.",
      stem: '',
      expectedSpeech: "I'd like to check in.",
      options: [
        {
          emoji: '✈️',
          label: 'check in',
          speak: "I'd like to check in.",
        },
      ],
    },
    "ยังไม่ตรงครับ ลองใช้โครง I'd like to... ครับ",
    'Here is my passport.',
  ),
  4: withHints(
    {
      textEn: 'คราวนี้ยื่นพาสปอร์ตสิครับ',
      advanceQuestionEn: 'Here is my passport.',
      stem: '',
      expectedSpeech: 'Here is my passport.',
      options: [
        {
          emoji: '🛂',
          label: 'passport',
          speak: 'Here is my passport.',
        },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง Here is my... ครับ',
  ),
};

export function airportBoardForStep(step: number): ForcedGuidedBoard | null {
  return AIRPORT_BOARDS[step] ?? null;
}

export const scoreAirportStep = makeScorer(airportBoardForStep);
export const airportLessonProgress = makeProgress(4, scoreAirportStep);

export function airportOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}ถึงสนามบินแล้วครับ ✈️ วันนี้มาฝึกเช็กอินและยื่นเอกสารแบบสั้นๆ กันครับ! "พาสปอร์ต" ในภาษาอังกฤษเรียกว่าอะไรนะครับ?`;
}

// ─── Pharmacy (4) ───────────────────────────────────────────────────────────

const PHARMACY_VOCAB_OPTIONS = [
  { emoji: '🤕', label: 'headache', speak: 'headache' },
  { emoji: '🤒', label: 'fever', speak: 'fever' },
  { emoji: '💊', label: 'medicine', speak: 'medicine' },
  { emoji: '🏪', label: 'pharmacy', speak: 'pharmacy' },
];

const PHARMACY_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: '',
      expectedSpeech: 'headache',
      options: PHARMACY_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "ปวดหัว" คือ headache ครับ',
    'What about fever?',
  ),
  2: withHints(
    {
      textEn: 'เยี่ยมเลยครับ! "ไข้" ล่ะครับ?',
      advanceQuestionEn: 'What about fever?',
      stem: '',
      expectedSpeech: 'fever',
      options: PHARMACY_VOCAB_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ คำว่า "ไข้" คือ fever ครับ',
    'I have a fever.',
  ),
  3: withHints(
    {
      textEn:
        'เยี่ยมเลยครับ! ถ้าจะบอกเภสัชกรว่า ปวดหัว ให้พูดว่า I have a headache. ไหนลองบอกอาการตามภาพดูนะครับ? 😊',
      advanceQuestionEn: 'I have a fever.',
      stem: 'I have a...',
      expectedSpeech: 'I have a fever.',
      options: [
        { emoji: '🤒', label: 'fever', speak: 'I have a fever.' },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง I have a... ครับ',
    'Can you help me?',
  ),
  4: withHints(
    {
      textEn: 'คราวนี้ขอความช่วยเหลือสิครับ',
      advanceQuestionEn: 'Can you help me?',
      stem: '',
      expectedSpeech: 'Can you help me?',
      options: [
        { emoji: '🆘', label: 'help', speak: 'Can you help me?' },
      ],
    },
    'ยังไม่ตรงครับ ลองใช้โครง Can you... ครับ',
  ),
};

export function pharmacyBoardForStep(step: number): ForcedGuidedBoard | null {
  return PHARMACY_BOARDS[step] ?? null;
}

export const scorePharmacyStep = makeScorer(pharmacyBoardForStep);
export const pharmacyLessonProgress = makeProgress(4, scorePharmacyStep);

export function pharmacyOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}รู้สึกไม่สบายไหมครับ? 💊 วันนี้มาฝึกคุยที่ร้านขายยาแบบสั้นๆ กันครับ! "ปวดหัว" ในภาษาอังกฤษเรียกว่าอะไรนะครับ?`;
}

// ─── Survival (3) ───────────────────────────────────────────────────────────

const SURVIVAL_LOST_OPTIONS = [
  { emoji: '🧳', label: 'bag', speak: "I can't find my bag." },
  { emoji: '📱', label: 'phone', speak: "I can't find my phone." },
  {
    emoji: '👛',
    label: 'wallet',
    speak: "I can't find my wallet.",
  },
];

const SURVIVAL_HELP_OPTIONS = [
  { emoji: '🆘', label: 'help me', speak: 'Can you help me?' },
  { emoji: '📍', label: 'show me', speak: 'Can you show me?' },
];

const SURVIVAL_SPEAK_OPTIONS = [
  {
    emoji: '🐢',
    label: 'slowly',
    speak: 'Can you speak slowly?',
  },
  { emoji: '🔁', label: 'again', speak: 'Can you speak again?' },
];

const SURVIVAL_BOARDS: Record<number, ForcedGuidedBoard> = {
  1: withHints(
    {
      textEn: '',
      stem: "I can't find my...",
      expectedSpeech: "I can't find my bag.",
      options: SURVIVAL_LOST_OPTIONS.map((o) => ({ ...o })),
    },
    "ยังไม่ตรงครับ ลองใช้โครง I can't find my... ครับ",
    'Can you help me?',
  ),
  2: withHints(
    {
      textEn:
        "Can you help me? พอเกิดเรื่องขึ้น ขอให้คนอื่นช่วยด้วยประโยคนี้ครับ",
      advanceQuestionEn: 'Can you help me?',
      stem: 'Can you ______?',
      expectedSpeech: 'Can you help me?',
      options: SURVIVAL_HELP_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ ลองใช้โครง Can you... ครับ',
    'Can you speak slowly?',
  ),
  3: withHints(
    {
      textEn:
        'Can you speak slowly? ถ้าฟังฝรั่งพูดไม่ทัน ลองขอให้เขาปรับวิธีพูดดูครับ',
      advanceQuestionEn: 'Can you speak slowly?',
      stem: 'Can you speak ______?',
      expectedSpeech: 'Can you speak slowly?',
      options: SURVIVAL_SPEAK_OPTIONS.map((o) => ({ ...o })),
    },
    'ยังไม่ตรงครับ ลองใช้โครง Can you speak... ครับ',
  ),
};

export function survivalBoardForStep(step: number): ForcedGuidedBoard | null {
  return SURVIVAL_BOARDS[step] ?? null;
}

export const scoreSurvivalStep = makeScorer(survivalBoardForStep);
export const survivalLessonProgress = makeProgress(3, scoreSurvivalStep);

export function survivalOpeningText(learnerFirstName: string): string {
  return `${greetName(learnerFirstName)}เกิดเรื่องฉุกเฉินขึ้นมา... จะพูดเอาตัวรอดได้ยังไง? มาเก็บประโยคเอาชีวิตรอดกันครับ!\nI can't find my bag. บอกปัญหาก่อนครับ... สมมติว่า 'ฉันหาของไม่เจอ' ให้พูดว่า 'I can't find my...' แล้วเลือกของบนจอได้เลยครับ`;
}
