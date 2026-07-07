export interface IntroOpening {
  textEn: string;
  textTh: string;
}

export const INTRO_TURN1_OPENING: IntroOpening = {
  textEn:
    "ยินดีต้อนรับสู่ Banana English ครับ! ผม 'ครูพี่บี'..  " +
    'กล้วยหอมที่จะชวนคุณมาฝึกภาษาอังกฤษให้กลายเป็นเรื่องกล้วยๆ เองครับ! ' +
    'ไม่ต้องกลัวพูดผิดนะ คุยกับผมสบายๆ เหมือนเพื่อนร่วมห้องกันครับ... ' +
    'ก่อนอื่นเลย... What is your name? ' +
    'บอกชื่อเป็นภาษาอังกฤษสั้นๆ ให้ผมฟังหน่อยครับ!',
  textTh:
    'ยินดีต้อนรับ! ผมครูพี่บี มาคุยสบายๆ กันนะครับ ไม่ต้องกลัวพูดผิด ' +
    'บอกชื่อเป็นภาษาอังกฤษสั้นๆ ได้เลย!',
};

export type IntroTurn2Case = 'named' | 'fallback';

const TURN2_FALLBACK: IntroOpening = {
  textEn:
    'ยินดีที่ได้รู้จักนะครับ! เรื่องชื่อไว้บอกผมทีหลังก็ได้ สบายๆ ครับ... ' +
    'What do you like to do in your free time? ' +
    'ปกติชอบทำอะไรในเวลาว่างครับ?',
  textTh:
    'ยินดีที่ได้รู้จักครับ! บอกชื่อทีหลังก็ได้ มาเล่าเรื่องงานอดิเรกกันต่อเลย',
};

function sanitizeName(raw: string): string {
  return raw
    .replace(/[.!?,]+$/, '')
    .trim()
    .split(/\s+/)[0];
}

export function extractUserName(userText: string): string | null {
  const text = userText.trim();
  if (text.length === 0 || text.length < 3) return null;

  const lower = text.toLowerCase();
  if (/^(hi|hello|hey|สวัสดี|หวัดดี)[\s!.?,]*$/.test(lower)) {
    return null;
  }

  const patterns = [
    /(?:my name is|i'?m|i am|call me|name'?s|this is)\s+([a-zA-Z][\w'-]*)/i,
    /^([a-zA-Z][a-zA-Z'-]{1,30})$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = sanitizeName(match[1]);
      if (name.length >= 2) return name;
    }
  }

  const words = text.split(/\s+/);
  if (words.length <= 3) {
    const candidate = sanitizeName(words[0]);
    if (/^[a-zA-Z]/.test(candidate) && candidate.length >= 2) {
      return candidate;
    }
  }

  return null;
}

export function classifyTurn2Case(userText: string): IntroTurn2Case {
  return extractUserName(userText) ? 'named' : 'fallback';
}

export function getTurn2Script(userText: string): IntroOpening {
  const userName = extractUserName(userText);
  if (userName) {
    return {
      textEn:
        `ว้าว ยินดีที่ได้รู้จักครับคุณ ${userName}! ` +
        'Nice to meet you. มาลุยกันต่อเลย... ' +
        'What do you like to do in your free time? ' +
        'ปกติชอบทำอะไรในเวลาว่างครับ?',
      textTh: `ยินดีที่ได้รู้จักครับคุณ${userName}! มาเล่าเรื่องชอบทำอะไรตอนว่างๆ กันต่อเลย`,
    };
  }

  return TURN2_FALLBACK;
}

export type IntroTurn3Case = 'active' | 'fallback' | 'silent';

const TURN3_HOBBY_PATTERN =
  /\b(like|love|enjoy|play|playing|watch|watching|read|reading|go|going|listen|listening|cook|cooking|game|gaming|swim|swimming|run|running|draw|drawing|paint|painting|hike|hiking|sing|singing|dance|dancing|football|soccer|basketball|tennis|gym|yoga|movie|movies|music|travel|shop|shopping|bike|biking|exercise|hobby|hobbies|free time)\b/;

const TURN3_OFF_TOPIC_PATTERN =
  /\b(hello|hi|hey|sleep|sleeping|nothing|rest|resting|relax|chill|nap|ok|okay|yes|no|fine|good|thanks|thank you)\b/;

const TURN3_ACTIVE_MIN_LENGTH = 20;

function hasTurn3HobbySignal(text: string): boolean {
  return (
    TURN3_HOBBY_PATTERN.test(text) ||
    text.includes('ชอบ') ||
    text.includes('เล่น')
  );
}

function isTurn3SilentAnswer(text: string): boolean {
  return text.length === 0 || text.length < 3;
}

function isTurn3OffTopicAnswer(text: string): boolean {
  if (
    /^(hi|hello|hey|sleep|sleeping|nothing|rest|resting|relax|ok|yes|no)[\s!.?,]*$/.test(
      text,
    )
  ) {
    return true;
  }

  if (
    text.length < TURN3_ACTIVE_MIN_LENGTH &&
    (TURN3_OFF_TOPIC_PATTERN.test(text) ||
      text.includes('สวัสดี') ||
      text.includes('พัก') ||
      text.includes('นอน') ||
      text.includes('ไม่ทำอะไร'))
  ) {
    return true;
  }

  return false;
}

export function classifyTurn3Case(userText: string): IntroTurn3Case {
  const text = userText.toLowerCase().trim();

  if (isTurn3SilentAnswer(text)) {
    return 'silent';
  }

  if (hasTurn3HobbySignal(text)) {
    return 'active';
  }

  if (isTurn3OffTopicAnswer(text)) {
    return 'fallback';
  }

  if (text.length >= TURN3_ACTIVE_MIN_LENGTH) {
    return 'active';
  }

  return 'fallback';
}

export function getTurn3Script(userText: string): IntroOpening {
  return getTurn3ScriptForCase(classifyTurn3Case(userText));
}

export function getTurn3ScriptForCase(turnCase: IntroTurn3Case): IntroOpening {
  switch (turnCase) {
    case 'active':
      return {
        textEn:
          'ว้าว! That sounds like a lot of fun and very relaxing. ' +
          'การได้ทำสิ่งที่ชอบในเวลาว่างเนี่ยแหละคือวิธีเติมพลังที่ดีที่สุด! ' +
          'You did an amazing job sharing that in English. ยอดเยี่ยมมากครับ!',
        textTh: 'เก่งมากที่เล่าเป็นภาษาอังกฤษได้! ทำสิ่งที่ชอบคือการเติมพลังที่ดีที่สุด',
      };
    case 'fallback':
      return {
        textEn:
          'เข้าใจเลยครับ! วันเหนื่อยๆ just resting or doing nothing is the best. ' +
          'ไม่ต้องกังวลนะครับ We can practice together bit by bit every day. ' +
          'ค่อยๆ ฝึกพูดเรื่องใกล้ตัวไปทีละนิดกับผม แป๊บเดียวก็เก่งขึ้นแล้วครับ!',
        textTh: 'เข้าใจครับ ค่อยๆ ฝึกไปด้วยกันทุกวันก็เก่งขึ้นแน่นอน',
      };
    case 'silent':
      return {
        textEn:
          'ไม่เป็นไรเลยครับ แค่คุณเปิดใจลองกดเข้ามาฟังผมในวันนี้ That is already a great first step! ' +
          'การฝึกภาษาอังกฤษมันเริ่มจากจุดนี้แหละครับ Nice and easy! สบายๆ ครับผม',
        textTh: 'ไม่เป็นไรครับ แค่ลองมาคุยก็ถือว่ายอดเยี่ยมแล้ว!',
      };
  }
}

export function introReplyInstruction(userTurnCount: number): string {
  if (userTurnCount === 1) {
    return (
      'This is Turn 2 of the Banana English introduction script. ' +
      'The learner just responded to the name question. ' +
      'Greet them by name if they shared one, then ask about hobbies and free time warmly. ' +
      'textEn: mix Thai support with English question about free time. ' +
      'textTh: brief Thai encouragement.'
    );
  }

  if (userTurnCount === 2) {
    return (
      'This is Turn 3 (final intro turn). ' +
      'The learner shared hobbies/free-time interests. ' +
      'Give a warm closing line mixing Thai and English. No more questions.'
    );
  }

  return (
    'Continue the introduction warmly as Teacher B. ' +
    'Keep replies short and encouraging. Mix Thai support in textTh.'
  );
}

export const INTRO_TOPIC_CONTEXT =
  'Banana English onboarding introduction session (3-turn script). ' +
  'Turn 1: welcome + name. Turn 2: greet by name + hobbies/lifestyle. Turn 3: warm closing. ' +
  'You are Teacher B (ครูพี่บี), a friendly banana English teacher for Thai learners.';

export const INTRO_REPORT_PROMPT =
  'Analyze this Banana English intro session for a Thai learner. ' +
  'Return compact JSON only — no extra text. ' +
  'levelTitle: short English phrase (2-3 words). ' +
  'levelEmoji: one emoji. ' +
  'summaryTh: one short Thai sentence (max 25 words). ' +
  'Scores 0-100: pronunciation, confidence, listening.';
