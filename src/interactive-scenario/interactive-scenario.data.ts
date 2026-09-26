import type { InteractiveScenarioDef } from './interactive-scenario.types';

/** Path Finale review — whole A1 Foundations, not Chapter 16-only. */
export const FINAL_INTERVIEW_JOHN: InteractiveScenarioDef = {
  id: 'final_interview_john',
  mode: 'review',
  teacher: 'john',
  titleEn: 'Final Interview',
  titleTh: 'บททดสอบสุดท้าย กับ Teacher John',
  bananaCost: 0,
  estimatedMinutes: 8,
  softAttemptCeiling: 40,
  scenes: [
    {
      id: 'classroom',
      titleEn: 'Classroom',
      titleTh: 'ห้องเรียน',
      imageAsset: 'assets/images/learn/scenario/final_interview_john_hero.jpg',
      bannerAsset: 'assets/images/learn/scenario/final_interview_john_hero.jpg',
    },
    {
      id: 'desk',
      titleEn: 'Teacher desk',
      titleTh: 'โต๊ะครู',
      imageAsset: 'assets/images/learn/lesson_classroom_bg.png',
    },
    {
      id: 'goodbye',
      titleEn: 'See you',
      titleTh: 'บอกลา',
      imageAsset: 'assets/images/learn/lesson_classroom_bg.png',
    },
  ],
  goals: [
    {
      id: 'greet',
      labelTh: 'ทักทายครูจอห์น',
      labelEn: 'Greet Teacher John',
      meaningRubric: 'Any greeting (hi/hello/good morning/good afternoon).',
      acceptExamples: ['Hi', 'Hello', 'Good morning', 'Hi Teacher John'],
      hints: {
        intentTh: 'ทักทายสั้น ๆ',
        starterEn: 'Hello',
        modelEn: 'Hello, Teacher John!',
      },
    },
    {
      id: 'name',
      labelTh: 'บอกชื่อ (จริงหรือสมมติก็ได้)',
      labelEn: 'Say your name (real or made-up)',
      meaningRubric: 'States a name — My name is X / I am X / I\'m X.',
      acceptExamples: ['My name is Maya', "I'm Max", 'I am Ana'],
      hints: {
        intentTh: 'บอกชื่อของคุณ',
        starterEn: 'My name is…',
        modelEn: 'My name is Maya.',
      },
    },
    {
      id: 'from',
      labelTh: 'บอกว่ามาจากไหน',
      labelEn: 'Say where you are from',
      meaningRubric: 'Says origin/country/city — I am from X / I\'m from X.',
      acceptExamples: ["I'm from Thailand", 'I am from Bangkok', 'From Japan'],
      hints: {
        intentTh: 'บอกว่ามาจากที่ไหน',
        starterEn: "I'm from…",
        modelEn: "I'm from Thailand.",
      },
    },
    {
      id: 'like_or_have',
      labelTh: 'บอกสิ่งที่ชอบ หรือสิ่งที่มี',
      labelEn: 'Say something you like or have',
      meaningRubric:
        'Uses like/love/have with a simple object (food, hobby, item).',
      acceptExamples: [
        'I like coffee',
        'I love music',
        'I have a bag',
        'I like English',
      ],
      hints: {
        intentTh: 'บอกว่าชอบอะไร หรือมีอะไร',
        starterEn: 'I like…',
        modelEn: 'I like coffee.',
      },
    },
    {
      id: 'can_or_do',
      labelTh: 'บอกสิ่งที่ทำได้ หรือทำเป็นประจำ',
      labelEn: 'Say something you can do or do every day',
      meaningRubric:
        'Uses can + verb, or a simple present habit (I study / I work / I walk).',
      acceptExamples: [
        'I can swim',
        'I can cook',
        'I study English',
        'I walk every day',
      ],
      hints: {
        intentTh: 'บอกว่าทำอะไรได้ หรือทำอะไรบ่อย ๆ',
        starterEn: 'I can…',
        modelEn: 'I can swim.',
      },
    },
    {
      id: 'ask_back',
      labelTh: 'ถามครูจอห์นกลับหนึ่งคำถาม',
      labelEn: 'Ask Teacher John one question',
      meaningRubric:
        'Asks a simple A1 question (How are you? / What is your name? / Do you like…? / Where are you from?). No Why/Because.',
      acceptExamples: [
        'How are you?',
        'What is your name?',
        'Do you like coffee?',
        'Where are you from?',
      ],
      hints: {
        intentTh: 'ถามกลับสั้น ๆ',
        starterEn: 'How are you?',
        modelEn: 'How are you today?',
      },
    },
    {
      id: 'goodbye',
      labelTh: 'บอกลาสุภาพ',
      labelEn: 'Say goodbye politely',
      meaningRubric: 'Any polite close — bye / see you / thank you / goodbye.',
      acceptExamples: [
        'Goodbye',
        'See you',
        'See you tomorrow',
        'Thank you. Bye!',
      ],
      hints: {
        intentTh: 'บอกลา',
        starterEn: 'See you',
        modelEn: 'See you tomorrow!',
      },
    },
  ],
  beats: [
    {
      id: 'open',
      sceneId: 'classroom',
      visualLayout: 'beside_teacher',
      focusGoalIds: ['greet'],
      npcBriefEn: 'Greet the learner and invite a hello.',
      promptEn: 'Hi! I am Teacher John. Hello!',
      promptTh: 'สวัสดี! ผมครูจอห์น ทักทายหน่อยนะครับ',
    },
    {
      id: 'intro_name',
      sceneId: 'classroom',
      visualLayout: 'beside_teacher',
      focusGoalIds: ['name'],
      npcBriefEn: 'Ask for their name; accept fictional names.',
      promptEn: 'Nice to meet you. What is your name?',
      promptTh: 'ยินดีที่ได้รู้จัก ชื่ออะไรครับ? (จริงหรือสมมติก็ได้)',
    },
    {
      id: 'intro_from',
      sceneId: 'desk',
      visualLayout: 'beside_teacher',
      focusGoalIds: ['from'],
      npcBriefEn: 'Ask where they are from.',
      promptEn: 'Where are you from?',
      promptTh: 'คุณมาจากที่ไหนครับ?',
    },
    {
      id: 'like_have',
      sceneId: 'desk',
      visualLayout: 'focus_image',
      focusGoalIds: ['like_or_have'],
      npcBriefEn: 'Ask about likes or things they have.',
      promptEn: 'What do you like? Or what do you have?',
      promptTh: 'คุณชอบอะไร หรือมีอะไรบ้างครับ?',
    },
    {
      id: 'can_do',
      sceneId: 'desk',
      visualLayout: 'beside_teacher',
      focusGoalIds: ['can_or_do'],
      npcBriefEn: 'Ask what they can do or do every day.',
      promptEn: 'What can you do? Or what do you do every day?',
      promptTh: 'คุณทำอะไรได้บ้าง หรือทำอะไรเป็นประจำครับ?',
    },
    {
      id: 'learner_ask',
      sceneId: 'classroom',
      visualLayout: 'beside_teacher',
      focusGoalIds: ['ask_back'],
      npcBriefEn: 'Invite one simple question from the learner.',
      promptEn: 'Your turn! Ask me one question.',
      promptTh: 'ถึงตาคุณแล้ว ถามผมหนึ่งคำถามได้เลยครับ',
      learnerMayAsk: true,
    },
    {
      id: 'close',
      sceneId: 'goodbye',
      visualLayout: 'beside_teacher',
      focusGoalIds: ['goodbye'],
      npcBriefEn: 'Close warmly and wait for goodbye.',
      promptEn: 'Great job today. See you!',
      promptTh: 'เก่งมากวันนี้ บอกลากันหน่อยนะครับ',
    },
  ],
  openingEn: 'Hi! I am Teacher John. Hello!',
  openingTh: 'สวัสดี! ผมครูจอห์น ทักทายหน่อยนะครับ',
  completionEn: 'Wonderful! You finished the Final Interview. See you next time!',
  completionTh: 'เยี่ยมมาก! คุณผ่านสัมภาษณ์จบเส้นทางแล้ว แล้วเจอกันใหม่นะครับ',
};

const BY_ID = new Map<string, InteractiveScenarioDef>([
  [FINAL_INTERVIEW_JOHN.id, FINAL_INTERVIEW_JOHN],
]);

export function getInteractiveScenario(
  id: string,
): InteractiveScenarioDef | undefined {
  return BY_ID.get(id.trim());
}

export function listInteractiveScenarioIds(): string[] {
  return [...BY_ID.keys()];
}
