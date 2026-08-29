export interface IntroOpening {
  textEn: string;
  textTh: string;
}

export const INTRO_TURN1_OPENING: IntroOpening = {
  textEn:
    'ยินดีต้อนรับสู่ Banana English ครับ! 🍌 ผม "ครูพี่บี" ' +
    'กล้วยหอมที่จะช่วยให้คุณพูดภาษาอังกฤษได้อย่างมั่นใจ ' +
    'ไม่ต้องกลัวพูดผิดนะครับ คุยกับผมสบายๆ เหมือนเพื่อนกัน ' +
    'มาลองเริ่มคำแรกกันเลย... พูดตามผมนะ... Hello! 👋',
  textTh:
    'ยินดีต้อนรับ! ผมครูพี่บี กล้วยหอมที่จะช่วยให้คุณพูดอังกฤษได้อย่างมั่นใจ ' +
    'คุยสบายๆ เหมือนเพื่อนกัน ลองพูดตามผมนะครับ Hello!',
};

/** After Turn 1: praise + ask name. */
const TURN2: IntroOpening = {
  textEn:
    'เยี่ยมมากครับ! สำเนียงฟังดูดีเลย... ' +
    'บอกชื่อคุณสั้นๆ ให้ผมรู้จักหน่อยครับ... What is your name?',
  textTh: 'เยี่ยมมากครับ! บอกชื่อสั้นๆ ให้ผมรู้จักหน่อยครับ',
};

/** Final onboard line after the name turn. */
export type IntroTurn3Case = 'named' | 'fallback' | 'silent';

const TURN3_FALLBACK: IntroOpening = {
  textEn:
    'ยินดีที่ได้รู้จักนะครับ! เรื่องชื่อไว้บอกผมทีหลังก็ได้ สบายๆ ครับ... ' +
    'ก้าวแรกสำเร็จแล้ว พร้อมเปลี่ยนภาษาอังกฤษให้เป็นเรื่องกล้วยๆ แล้ว ' +
    'ไปลุยกันเลย!',
  textTh:
    'ยินดีที่ได้รู้จักครับ! บอกชื่อทีหลังก็ได้ ก้าวแรกสำเร็จแล้ว ไปลุยกันเลย!',
};

const TURN3_SILENT: IntroOpening = {
  textEn:
    'ไม่เป็นไรเลยครับ แค่คุณเปิดใจลองกดเข้ามาฟังผมในวันนี้ ' +
    'That is already a great first step! ' +
    'การฝึกภาษาอังกฤษมันเริ่มจากจุดนี้แหละครับ Nice and easy! ' +
    'ไปลุยกันเลยครับผม',
  textTh: 'ไม่เป็นไรครับ แค่ลองมาคุยก็ถือว่ายอดเยี่ยมแล้ว! ไปลุยกันเลย!',
};

function sanitizeName(raw: string): string {
  return raw
    .replace(/[“”"]/g, '')
    .replace(/[.!?,…]+$/g, '')
    .trim()
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z]/.test(w))
    .slice(0, 4)
    .join(' ');
}

export function matchesHello(userText: string): boolean {
  const text = userText.trim();
  if (text.length === 0) return false;
  const lower = text.toLowerCase();
  if (/\b(hello|hi|hey)\b/.test(lower)) return true;
  if (lower.includes('สวัสดี') || lower.includes('หวัดดี')) return true;
  return false;
}

export function extractUserName(userText: string): string | null {
  let text = userText.trim();
  if (text.length === 0) return null;

  text = text.replace(/[“”"]/g, '').replace(/[.!?,…]+$/g, '').trim();
  if (text.length < 2) return null;

  const lower = text.toLowerCase();
  if (/^(hi|hello|hey|สวัสดี|หวัดดี)[\s!.?,]*$/.test(lower)) {
    return null;
  }

  const intro =
    /(?:my name is|i'?m|i am|call me|name'?s|this is)\s+(.+)$/i.exec(text);
  if (intro?.[1]) {
    const name = sanitizeName(intro[1]);
    if (name.length >= 2) return name;
  }

  const thai = /(?:ผม|ฉัน|ดิฉัน)?\s*ชื่อ\s+(.+)$/.exec(text);
  if (thai?.[1]) {
    const name = sanitizeName(thai[1]);
    if (name.length >= 2) return name;
  }

  const plain = /^([a-zA-Z][\w'-]*(?:\s+[a-zA-Z][\w'-]*){0,3})$/.exec(text);
  if (plain?.[1]) {
    const name = sanitizeName(plain[1]);
    if (name.length >= 2) return name;
  }

  const words = text.split(/\s+/);
  if (words.length <= 3) {
    const candidate = sanitizeName(words[0] ?? '');
    if (/^[a-zA-Z]/.test(candidate) && candidate.length >= 2) {
      return candidate;
    }
  }

  return null;
}

export function getTurn2Script(_userText?: string): IntroOpening {
  return TURN2;
}

export function classifyTurn3Case(userText: string): IntroTurn3Case {
  const text = userText.trim();
  if (text.length === 0 || text.length < 2) return 'silent';
  if (extractUserName(text) != null) return 'named';
  return 'fallback';
}

export function getTurn3Script(userText: string): IntroOpening {
  const turnCase = classifyTurn3Case(userText);
  const userName = extractUserName(userText);
  return getTurn3ScriptForCase(turnCase, userName);
}

export function getTurn3ScriptForCase(
  turnCase: IntroTurn3Case,
  userName?: string | null,
): IntroOpening {
  switch (turnCase) {
    case 'named': {
      const name = userName ?? 'เพื่อน';
      return {
        textEn:
          `ยินดีที่ได้รู้จักครับคุณ ${name}! ` +
          'ก้าวแรกสำเร็จแล้ว พร้อมเปลี่ยนภาษาอังกฤษให้เป็นเรื่องกล้วยๆ แล้ว ' +
          'ไปลุยกันเลย!',
        textTh: `ยินดีที่ได้รู้จักครับคุณ${name}! ก้าวแรกสำเร็จแล้ว ไปลุยกันเลย!`,
      };
    }
    case 'fallback':
      return TURN3_FALLBACK;
    case 'silent':
      return TURN3_SILENT;
  }
}

export function introReplyInstruction(userTurnCount: number): string {
  if (userTurnCount === 1) {
    return (
      'This is Turn 2 of the Banana English introduction script. ' +
      'The learner just said Hello (or attempted the warm-up). ' +
      'Praise briefly, then ask for their name: What is your name? ' +
      'textEn: mix Thai support with the English name question. ' +
      'textTh: brief Thai encouragement.'
    );
  }

  if (userTurnCount === 2) {
    return (
      'This is the final intro turn (complete & onboarded). ' +
      'The learner just shared their name (or tried to). ' +
      'Greet them by name if available, celebrate the first step, ' +
      'and close warmly inviting them to continue. No more questions.'
    );
  }

  return (
    'Continue the introduction warmly as Teacher B. ' +
    'Keep replies short and encouraging. Mix Thai support in textTh.'
  );
}

export const INTRO_TOPIC_CONTEXT =
  'Banana English onboarding introduction session (2 speaking turns + complete). ' +
  'Turn 1: welcome + ask learner to say Hello. ' +
  'Turn 2: praise + ask name. ' +
  'Complete: greet by name (or fallback) and onboard. ' +
  'You are Teacher B (ครูพี่บี), a friendly banana English teacher for Thai learners.';

export const INTRO_REPORT_PROMPT =
  'Analyze this Banana English intro session for a Thai learner. ' +
  'You are Teacher B (ครูพี่บี), a male English teacher — Thai text must use ครับ, never ค่ะ. ' +
  'Return compact JSON only — no extra text. ' +
  'levelTitle: short English phrase (2-3 words). ' +
  'levelEmoji: one emoji. ' +
  'summaryTh: one short Thai sentence (max 25 words) in Teacher B voice (ครับ). ' +
  'Scores 0-100: pronunciation, confidence, listening.';
