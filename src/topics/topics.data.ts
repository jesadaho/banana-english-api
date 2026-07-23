import type { HintOption } from '../common/api.types';

export interface Topic {
  id: string;
  titleTh: string;
  titleEn: string;
  icon: string;
}

export const TOPICS: Topic[] = [
  {
    id: 'intro',
    titleTh: 'แนะนำตัวฉบับง่าย',
    titleEn: 'Simple Self Introduction',
    icon: '👋',
  },
  {
    id: 'free_talk',
    titleTh: 'คุยกับครูพี่บี',
    titleEn: 'Free Talk with Teacher B',
    icon: '💬',
  },
  {
    id: 'coffee',
    titleTh: 'สั่งกาแฟที่คาเฟ่',
    titleEn: 'Ordering Coffee at a Cafe',
    icon: '☕',
  },
  {
    id: 'pets',
    titleTh: 'คุยเรื่องสัตว์เลี้ยง / เลี้ยงแมว',
    titleEn: 'Talking About Pets',
    icon: '🐱',
  },
];

export const TOPIC_CONTEXT: Record<string, string> = {
  intro: 'Banana English onboarding introduction — 3-turn script with Teacher B (ครูพี่บี).',
  free_talk:
    'Open freestyle conversation practice with Teacher B. There is no fixed task or checklist. ' +
    'Follow the learner’s interests, keep topics light and everyday, and help them speak English comfortably. ' +
    'Ask simple follow-up questions. Do not force a cafe/pets script.',
  coffee: 'The learner is practicing ordering coffee at a cafe in English.',
  pets: 'The learner is practicing talking about pets in English.',
};

export const BROTHER_BANANA_PERSONA = `You are Teacher B / ครูพี่บี (also known as Brother Banana), a friendly male AI English teacher for Thai learners.
- Speak in simple, encouraging English (1-2 short sentences max per reply).
- Be warm, patient, and supportive — reduce learner anxiety.
- Stay on the conversation topic.
- After your English reply, always provide a natural Thai translation in textTh.
- When writing Thai, speak as a male teacher: use ผม and end sentences with ครับ. Never use ค่ะ, คะ, or ดิฉัน.`;

/** Free Talk–only Teacher B voice (playful freestyle coach). */
export const FREE_TALK_PERSONA = `You are Teacher B / ครูพี่บี (Brother Banana) in Free Talk mode — a playful male AI English buddy for Thai learners.
Personality (always):
- Playful and light (ขี้เล่น) — smile in your tone, never stiff.
- High energy (Energy สูง) — warm enthusiasm, short punchy lines.
- Love light exclamations (ชอบอุทาน) — e.g. Nice!, โอ้โห!, Let's go! — but not every sentence.
- Gentle teasing (แซวเบาๆ) — never mean, never roast hard.
- Great at encouragement (ให้กำลังใจเก่ง) — celebrate small wins.
- Understand Thai learners (เข้าใจคนไทย) — cultural context, code-switching, Thai feelings.
- Curious (อยากรู้อยากเห็น) — ask one natural follow-up when it fits.
- Never make the learner feel tested or graded (ไม่ทำให้รู้สึกสอบ) — no quizzes, no "correct this", no score talk mid-chat.
- Fun first, teach later: default to chatting. Soft recast only as a candidate field — the server decides whether to use it.

Reply craft:
- Keep spoken replies short (1–3 short beats total).
- No emojis in textEn or textTh (never 😊 😄 etc.) — warmth comes from words only.
- Always return textEn and textTh. Thai uses masculine Teacher B voice: ผม / ครับ — never ค่ะ, คะ, or ดิฉัน.
- IMPORTANT naming: the JSON key is "textEn" for legacy reasons, but it means SPOKEN LINE (what TTS reads), NOT "English only".
- For Easy/Balanced: textEn MUST include Thai characters (ก-ฮ) AND English letters in the SAME string. Example style: "Hey! พร้อมไหมครับ? How's your day?"
- Rejected pattern: English paragraph in textEn + Thai only in textTh.
- textTh = Thai-only subtitle of the same meaning.
- Stay freestyle: follow their interests. Do not force cafe, pets, or lesson scripts.`;

export type FreeTalkLanguageLevel = 'easy' | 'balanced' | 'englishOnly';

export type FreeTalkPhase =
  | 'greeting'
  | 'ice_breaker'
  | 'discover_topic'
  | 'conversation_loop'
  | 'wrap_up';

export type FreeTalkNextAction =
  | 'explore'
  | 'expand'
  | 'relate'
  | 'teach'
  | 'encourage'
  | 'change_topic'
  | 'wrap_up';

export const FREE_TALK_LANGUAGE_LEVEL_GUIDE: Record<
  FreeTalkLanguageLevel,
  string
> = {
  easy:
    'Language level: Easy (มือใหม่).\n' +
    '- textEn (spoken): code-switch in ONE reply — mostly Thai, English about 30–40%.\n' +
    '- Interleave short English words/phrases inside Thai (do NOT put all English first then all Thai).\n' +
    '- QUESTIONS ONLY: if you ask something in English, also echo that same question briefly in Thai so they catch the meaning.\n' +
    '  Good: "Nice! What did you do yesterday? เมื่อวานทำอะไรบ้างครับ?"\n' +
    '  Also fine: "เมื่อวานทำอะไรบ้างครับ? What did you do yesterday?"\n' +
    '  Translate only the question beat — not the whole reply.\n' +
    '- Statements / teasing / praise / soft recast beats: do NOT Thai-echo the whole line; keep those light.\n' +
    '- Very short questions ("Really?", "Oh?") need no Thai echo.\n' +
    '- Soft recast + follow-up: Thai-echo only the follow-up question if there is one.\n' +
    '- Example textEn: "สวัสดีครับ Jesada! กินข้าวหรือยังครับ? Did you eat yet?"\n' +
    '- textTh: Thai-only subtitle of the same meaning (ครับ voice).\n' +
    '- Wrong: English-only textEn + Thai translation in textTh.',
  balanced:
    'Language level: Balanced (default).\n' +
    '- textEn (spoken): code-switch in ONE reply — English about 60–70%, light Thai mixed in.\n' +
    '- Lead with English, drop short Thai for warmth/clarity mid-sentence (do NOT dump full Thai only into textTh).\n' +
    '- Example textEn: "โอ้ Jesada มาแล้ว เป็นไงบ้างครับ? How are you?"\n' +
    '- textTh: Thai-only subtitle of the same meaning (ครับ voice).\n' +
    '- Wrong: English-only textEn + Thai translation in textTh (that is English Only style).',
  englishOnly:
    'Language level: English Only.\n' +
    '- textEn (spoken): English only — no Thai words in textEn.\n' +
    '- textTh: full Thai subtitle/translation for the app (do not speak Thai mid-chat).\n' +
    '- Suitable for confident learners — still warm, never exam-like.',
};

export const FREE_TALK_PHASE_GUIDE = `Conversation phases (advance naturally, do not announce phase names to the learner):
1) greeting — vary the opener every time (never the same fixed script). Warm hello by name + one natural follow-up. Feel human, not a menu. Do not explain Free Talk (they already chose it).
2) ice_breaker — easy small talk to lower anxiety.
3) discover_topic — find what they want to talk about (or recall a prior memory if natural).
4) conversation_loop — stay here most of the session. Pick nextAction:
   - explore: dig into what they just said
   - expand: help them say a bit more / richer English
   - relate: share a light related thought / tease gently
   - teach: reserved for when a soft recast is actually applied mid-chat (server may override). Prefer explore/encourage otherwise. Never lecture or label mistakes.
   - encourage: praise effort / confidence boost
   - change_topic: soft pivot when the thread is done
   - wrap_up: only when time is nearly up or they clearly want to end
5) wrap_up — thank them, one warm closing line, invite next Free Talk.

Per-turn internal reasoning (use to choose nextAction; keep replies short):
User message → Intent → Emotion → Grammar/Naturalness damage (internal) → Topic → Conversation depth → Previous memory → Next action.
Do NOT dump this reasoning into textEn/textTh. Do NOT say they were wrong.`;

/** Internal damage levels for Free Talk suggestion gate (not shown in UI). */
export type FreeTalkDamageLevel = 'none' | 'low' | 'medium' | 'high';

export type FreeTalkIssueKind = 'grammar' | 'naturalness';

export interface FreeTalkIssueLogEntry {
  userTurnIndex: number;
  kind: FreeTalkIssueKind;
  damage: 'low' | 'medium' | 'high';
  learnerText: string;
  note: string;
  suggestedMidChat: boolean;
}

export const FREE_TALK_DAMAGE_GUIDE = `Internal evaluation (every learner turn — never announce scores to the learner):
Set grammarDamage and naturalnessDamage to none|low|medium|high.

Grammar Damage — how broken is the grammar?
- high: clear tense/agreement breaks (e.g. "I go yesterday.", "He don't like coffee.", "I don't went.")
- medium: noticeable but understandable (e.g. "My friend want to buy…", "She have…")
- low: small article/plural/preposition slips
- none: fine

Naturalness Damage — grammar OK-ish but a native speaker would not say it this way?
- high: unnatural phrasing (e.g. "I'm very like it.", "Can you explain me?")
- medium: blunt/literal (e.g. "I want coffee." vs "I'd like a coffee.")
- low: slightly stiff wording
- none: natural enough

Also set:
- issueNote: short internal English note (empty if both damages are none)
- softRecastEn / softRecastTh: ONLY when grammarDamage or naturalnessDamage is medium or high.
  Soft recast = echo their meaning in correct, natural English in a chatty tone + one follow-up.
  Good: User "I go shopping yesterday." → softRecastEn: "Oh, you went shopping yesterday! What did you buy?"
  Bad: "ผิดนะ…", "That's wrong", long grammar lectures, "Correct this:"
  softRecastEn must follow the SAME language-level mix rules as textEn (Easy/Balanced code-switch; English Only = English-only).
  textEn/textTh must still be a NORMAL chat reply WITHOUT correction (server may swap in softRecast).`;

export function freeTalkSuggestionBudget(durationLimitSeconds?: number | null): {
  grammarMax: number;
  naturalnessMax: number;
} {
  const seconds = durationLimitSeconds ?? 300;
  if (seconds >= 600) {
    return { grammarMax: 3, naturalnessMax: 2 };
  }
  return { grammarMax: 2, naturalnessMax: 1 };
}

const FREE_TALK_SUGGESTION_CHANCE: Record<
  FreeTalkLanguageLevel,
  {
    grammar: { high: number; medium: number };
    naturalness: { high: number; medium: number };
  }
> = {
  easy: {
    grammar: { high: 0.3, medium: 0.15 },
    naturalness: { high: 0.1, medium: 0.05 },
  },
  balanced: {
    grammar: { high: 0.6, medium: 0.3 },
    naturalness: { high: 0.3, medium: 0.15 },
  },
  englishOnly: {
    grammar: { high: 0.9, medium: 0.45 },
    naturalness: { high: 0.6, medium: 0.3 },
  },
};

export function normalizeFreeTalkDamage(
  value?: string | null,
): FreeTalkDamageLevel {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'none';
}

function freeTalkDamageRank(damage: FreeTalkDamageLevel): number {
  switch (damage) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export interface FreeTalkSuggestionGateInput {
  languageLevel: FreeTalkLanguageLevel;
  grammarDamage: FreeTalkDamageLevel;
  naturalnessDamage: FreeTalkDamageLevel;
  grammarSuggestionsUsed: number;
  naturalnessSuggestionsUsed: number;
  grammarMax: number;
  naturalnessMax: number;
  softRecastEn?: string;
  softRecastTh?: string;
  issueNote?: string;
  learnerText: string;
  userTurnIndex: number;
  random?: () => number;
}

export interface FreeTalkSuggestionGateResult {
  applySoftRecast: boolean;
  kind: FreeTalkIssueKind | null;
  issueLogEntries: FreeTalkIssueLogEntry[];
  grammarSuggestionsUsed: number;
  naturalnessSuggestionsUsed: number;
  debug: FreeTalkSuggestionDebug;
}

export interface FreeTalkSuggestionChannelDebug {
  damage: FreeTalkDamageLevel;
  eligible: boolean;
  chance: number | null;
  roll: number | null;
  rollPassed: boolean;
  passed: boolean;
  used: number;
  max: number;
  skipReason: string | null;
}

export interface FreeTalkSuggestionDebug {
  languageLevel: FreeTalkLanguageLevel;
  grammarDamage: FreeTalkDamageLevel;
  naturalnessDamage: FreeTalkDamageLevel;
  issueNote: string;
  hasSoftRecast: boolean;
  grammar: FreeTalkSuggestionChannelDebug;
  naturalness: FreeTalkSuggestionChannelDebug;
  applied: boolean;
  appliedKind: FreeTalkIssueKind | null;
}

/** Server-side budget + chance gate (LLM only proposes softRecast candidates). */
export function applyFreeTalkSuggestionGate(
  input: FreeTalkSuggestionGateInput,
): FreeTalkSuggestionGateResult {
  const random = input.random ?? Math.random;
  const table = FREE_TALK_SUGGESTION_CHANCE[input.languageLevel];
  const note = (input.issueNote ?? '').trim();
  const hasSoftRecast = Boolean((input.softRecastEn ?? '').trim());

  const candidates: Array<{
    kind: FreeTalkIssueKind;
    damage: 'low' | 'medium' | 'high';
  }> = [];
  if (input.grammarDamage !== 'none') {
    candidates.push({
      kind: 'grammar',
      damage: input.grammarDamage,
    });
  }
  if (input.naturalnessDamage !== 'none') {
    candidates.push({
      kind: 'naturalness',
      damage: input.naturalnessDamage,
    });
  }

  const grammar = evaluateSuggestionChannel({
    damage: input.grammarDamage,
    used: input.grammarSuggestionsUsed,
    max: input.grammarMax,
    chanceTable: table.grammar,
    hasSoftRecast,
    random,
  });
  const naturalness = evaluateSuggestionChannel({
    damage: input.naturalnessDamage,
    used: input.naturalnessSuggestionsUsed,
    max: input.naturalnessMax,
    chanceTable: table.naturalness,
    hasSoftRecast,
    random,
  });

  let kind: FreeTalkIssueKind | null = null;
  if (grammar.passed && naturalness.passed) {
    kind =
      freeTalkDamageRank(input.grammarDamage) >=
      freeTalkDamageRank(input.naturalnessDamage)
        ? 'grammar'
        : 'naturalness';
  } else if (grammar.passed) {
    kind = 'grammar';
  } else if (naturalness.passed) {
    kind = 'naturalness';
  }

  let grammarSuggestionsUsed = input.grammarSuggestionsUsed;
  let naturalnessSuggestionsUsed = input.naturalnessSuggestionsUsed;
  if (kind === 'grammar') grammarSuggestionsUsed += 1;
  if (kind === 'naturalness') naturalnessSuggestionsUsed += 1;

  const issueLogEntries: FreeTalkIssueLogEntry[] = candidates.map((c) => ({
    userTurnIndex: input.userTurnIndex,
    kind: c.kind,
    damage: c.damage,
    learnerText: input.learnerText,
    note,
    suggestedMidChat: kind === c.kind,
  }));

  return {
    applySoftRecast: kind != null,
    kind,
    issueLogEntries,
    grammarSuggestionsUsed,
    naturalnessSuggestionsUsed,
    debug: {
      languageLevel: input.languageLevel,
      grammarDamage: input.grammarDamage,
      naturalnessDamage: input.naturalnessDamage,
      issueNote: note,
      hasSoftRecast,
      grammar: {
        damage: grammar.damage,
        eligible: grammar.eligible,
        chance: grammar.chance,
        roll: grammar.roll,
        rollPassed: grammar.rollPassed,
        passed: grammar.passed,
        used: grammarSuggestionsUsed,
        max: input.grammarMax,
        skipReason: grammar.skipReason,
      },
      naturalness: {
        damage: naturalness.damage,
        eligible: naturalness.eligible,
        chance: naturalness.chance,
        roll: naturalness.roll,
        rollPassed: naturalness.rollPassed,
        passed: naturalness.passed,
        used: naturalnessSuggestionsUsed,
        max: input.naturalnessMax,
        skipReason: naturalness.skipReason,
      },
      applied: kind != null,
      appliedKind: kind,
    },
  };
}

function evaluateSuggestionChannel(options: {
  damage: FreeTalkDamageLevel;
  used: number;
  max: number;
  chanceTable: { high: number; medium: number };
  hasSoftRecast: boolean;
  random: () => number;
}): {
  damage: FreeTalkDamageLevel;
  eligible: boolean;
  chance: number | null;
  roll: number | null;
  rollPassed: boolean;
  passed: boolean;
  skipReason: string | null;
} {
  const base = {
    damage: options.damage,
    eligible: false,
    chance: null as number | null,
    roll: null as number | null,
    rollPassed: false,
    passed: false,
    skipReason: null as string | null,
  };

  if (options.damage !== 'medium' && options.damage !== 'high') {
    return {
      ...base,
      skipReason:
        options.damage === 'none' ? 'damage_none' : 'damage_low',
    };
  }
  if (options.used >= options.max) {
    return { ...base, skipReason: 'budget_exhausted' };
  }

  const chance = options.chanceTable[options.damage];
  const roll = options.random();
  const rollPassed = roll < chance;
  if (!options.hasSoftRecast) {
    return {
      ...base,
      eligible: true,
      chance,
      roll,
      rollPassed,
      passed: false,
      skipReason: 'no_soft_recast',
    };
  }
  if (!rollPassed) {
    return {
      ...base,
      eligible: true,
      chance,
      roll,
      rollPassed: false,
      passed: false,
      skipReason: 'chance_miss',
    };
  }
  return {
    ...base,
    eligible: true,
    chance,
    roll,
    rollPassed: true,
    passed: true,
    skipReason: null,
  };
}

export function formatFreeTalkIssueLogForReport(
  issueLog: FreeTalkIssueLogEntry[],
): string {
  if (!issueLog.length) {
    return 'No mid-session grammar/naturalness issues were logged.';
  }
  return (
    'Logged grammar/naturalness issues from this session ' +
    '(prefer coaching on items with suggestedMidChat=false in grammarTip/turnFeedback):\n' +
    issueLog
      .map(
        (e) =>
          `- turn ${e.userTurnIndex} [${e.kind}/${e.damage}] ` +
          `midChat=${e.suggestedMidChat}: "${e.learnerText}" — ${e.note || '(no note)'}`,
      )
      .join('\n')
  );
}

/**
 * Opening vibe bank — server picks one at random each Free Talk start
 * so Teacher B does not sound scripted.
 */
export const FREE_TALK_GREETING_SEEDS: readonly string[] = [
  'Hey!',
  'Hi!',
  'โอ้ มาแล้ว',
  'คิดถึงนะ',
  'วันนี้พร้อมคุยหรือยัง',
  'เหนื่อยไหมวันนี้',
  'ทำอะไรอยู่ก่อนเข้ามา',
  'กินข้าวหรือยัง',
  'วันนี้อารมณ์เป็นยังไง',
  'Yo!',
  'เฮ้!',
  'มาแล้ววว',
  'อุ้ย มาแล้ว',
  'ดีใจที่ได้เจอ',
  "What's up?",
  'Long time no see — แซวเบาๆ',
  'วันนี้นอนหลับดีไหม',
  'เช้านี้ / เย็นนี้ เป็นไงบ้าง',
  'เพิ่งว่างใช่ไหม',
  'ว้าว มาคุยกันแล้ว',
  'มีอะไรอยากระบายไหม',
  'วันนี้ยุ่งไหม',
  'กาแฟหรือชามั้ย — ถามเล่นๆ',
  'เสียงดีไหมวันนี้',
  'พร้อมแซวกันหน่อยไหม',
  'วันนี้อยากคุยเรื่องสนุกๆ หรือเรื่องจริงจัง',
  'มีข่าวดีไหมวันนี้',
  'เหนื่อยจากงาน/เรียนไหม',
  'เพิ่งกินอะไรอร่อยๆ ไหม',
  'อากาศวันนี้เป็นไงที่นู่น',
];

export function pickFreeTalkGreetingSeed(
  random: () => number = Math.random,
): string {
  const index = Math.floor(random() * FREE_TALK_GREETING_SEEDS.length);
  return FREE_TALK_GREETING_SEEDS[index] ?? FREE_TALK_GREETING_SEEDS[0]!;
}

/** Bias wrap-up when client reports this many seconds left (or fewer). */
export const FREE_TALK_WRAP_UP_SECONDS = 45;

export const THAI_MIX_PROMPT = `The learner spoke English mixed with Thai words.
Convert their utterance into natural, correct English while preserving the meaning.
Return ONLY the corrected English sentence, nothing else.`;

export const HINTS_PROMPT = `Based on the last AI message in this conversation, generate exactly 3 short reply suggestions
the learner could say next. Each hint needs:
- id: hint_1, hint_2, hint_3
- label: short Thai label (2-4 words) describing the intent
- sentenceEn: the full English sentence to say
- pronunciation: a Thai phonetic reading (คำอ่านภาษาไทย) of sentenceEn so a Thai learner can pronounce it, e.g. "Could you help me?" -> "คูด ยู เฮลพ์ มี?"

Return JSON matching the schema.`;

/** Used when Gemini hint generation fails so the client never gets an empty list. */
export const FALLBACK_HINTS: HintOption[] = [
  {
    id: 'hint_fallback_1',
    label: 'ตอบสั้นๆ',
    sentenceEn: 'Yes, that sounds good.',
    pronunciation: 'เย็ส, แดท ซาวนด์ส กู้ด',
  },
  {
    id: 'hint_fallback_2',
    label: 'ถามเพิ่ม',
    sentenceEn: 'Could you tell me more?',
    pronunciation: 'คูด ยู เทล มี มอร์?',
  },
  {
    id: 'hint_fallback_3',
    label: 'ขอความช่วยเหลือ',
    sentenceEn: 'Could you help me with that?',
    pronunciation: 'คูด ยู เฮลพ์ มี วิธ แดท?',
  },
];

export const REPORT_PROMPT = `${BROTHER_BANANA_PERSONA}

Summarize this English practice session for a Thai learner.
Return JSON matching the schema with these fields:
- feedbackEn / feedbackTh: warm overall encouragement from Teacher B (ครูพี่บี) about the whole session (not a quoted learner sentence). feedbackTh must sound like Teacher B speaking — masculine Thai with ครับ, never ค่ะ.
- bestSentenceEn: one exact English sentence the learner spoke that was their best moment (quote from the conversation).
- bestSentenceNoteTh: short Thai praise explaining why that sentence was great (Teacher B voice: ครับ, not ค่ะ).
- grammarTip: one short grammar tip in English based on the learner's mistakes.
- grammarTipTh: Thai translation of grammarTip (Teacher B voice: ครับ, not ค่ะ).
- pronunciationIssues: words the learner mispronounced or struggled with; scorePercent 0-100 estimate per word (empty array if none).
- vocab: 3-5 useful vocab items from the conversation.
- turnFeedback: one coaching card per LEARNER turn (see numbered Learner lines in the prompt). For each item:
  - userTurnIndex: 0-based index matching [Learner #N] in the prompt
  - status: "great" | "good" | "needs_improvement"
  - headlineTh: short Thai headline (e.g. "ดีมาก", "พูดได้ดี", or "พูดได้ แต่ยังไม่เป็นธรรมชาติที่สุด")
  - detailTh: one short Thai sentence explaining why (Teacher B voice: ครับ)
  - suggestionEn: a more natural English alternative for needs_improvement; empty string for great/good
  - suggestionReasonTh: Thai reason why suggestionEn is better; empty string for great/good
  Cover every learner turn. Prefer "good"/"great" when the utterance fits the situation; use needs_improvement only when a clear natural upgrade exists.

If the learner did not speak at all (no learner lines in the conversation), set bestSentenceEn, bestSentenceNoteTh, grammarTip, and grammarTipTh to empty strings, pronunciationIssues to [], and turnFeedback to [].
Never use "-", "N/A", or other placeholder text for empty fields.`;

/** Normalize feminine Thai particles to Teacher B's masculine voice. */
export function teacherBThaiVoice(text: string): string {
  if (!text) return text;
  return text
    .replaceAll('นะคะ', 'นะครับ')
    .replaceAll('ค่ะ', 'ครับ')
    .replace(/คะ(?=\s|$|[.!?…,])/g, 'ครับ');
}

export function getTopic(topicId: string): Topic | undefined {
  return TOPICS.find((t) => t.id === topicId);
}

export function conversationSystemPrompt(topicId: string): string {
  const context =
    TOPIC_CONTEXT[topicId] ?? 'General English conversation practice.';
  return `${BROTHER_BANANA_PERSONA}\n\nTopic context: ${context}`;
}

export function normalizeFreeTalkLanguageLevel(
  value?: string | null,
): FreeTalkLanguageLevel {
  if (value === 'easy' || value === 'englishOnly') return value;
  return 'balanced';
}

export function freeTalkSystemPrompt(options: {
  languageLevel: FreeTalkLanguageLevel;
  phase?: FreeTalkPhase | string;
  topic?: string | null;
  nextAction?: FreeTalkNextAction | string | null;
  memories?: string[];
  remainingSeconds?: number | null;
  durationLimitSeconds?: number | null;
}): string {
  const levelGuide = FREE_TALK_LANGUAGE_LEVEL_GUIDE[options.languageLevel];
  const memories =
    options.memories && options.memories.length > 0
      ? `Known learner memories from their last Free Talk (use naturally, do not list them):\n` +
        options.memories.map((m) => `- ${m}`).join('\n')
      : 'No prior Free Talk memories yet.';

  const phaseLine = options.phase
    ? `Current phase: ${options.phase}.`
    : 'Current phase: greeting.';
  const topicLine = options.topic
    ? `Current topic focus: ${options.topic}.`
    : 'Current topic focus: not set yet — discover gently.';
  const actionLine = options.nextAction
    ? `Last nextAction: ${options.nextAction}.`
    : '';

  const remaining =
    typeof options.remainingSeconds === 'number'
      ? options.remainingSeconds
      : null;
  const wrapHint =
    remaining != null && remaining <= FREE_TALK_WRAP_UP_SECONDS
      ? `Time left ≈ ${remaining}s — prefer nextAction wrap_up and move phase toward wrap_up.`
      : remaining != null
        ? `Time left ≈ ${remaining}s of ${options.durationLimitSeconds ?? 'session'}s.`
        : '';

  return [
    FREE_TALK_PERSONA,
    `Topic context: ${TOPIC_CONTEXT.free_talk}`,
    levelGuide,
    FREE_TALK_PHASE_GUIDE,
    FREE_TALK_DAMAGE_GUIDE,
    memories,
    phaseLine,
    topicLine,
    actionLine,
    wrapHint,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function freeTalkOpeningUserPrompt(options: {
  languageLevel: FreeTalkLanguageLevel;
  memories?: string[];
  learnerFirstName?: string;
  greetingSeed?: string;
}): string {
  const name = (options.learnerFirstName ?? '').trim() || 'เพื่อน';
  const seed = (options.greetingSeed ?? '').trim() || pickFreeTalkGreetingSeed();
  const memoryHint =
    options.memories && options.memories.length > 0
      ? 'If natural, lightly recall one prior memory (e.g. something they shared last time) — do not dump a list.'
      : 'No prior memories — keep the opener easy.';

  const mixRule =
    options.languageLevel === 'englishOnly'
      ? 'textEn must be English-only; textTh is Thai subtitle. '
      : options.languageLevel === 'easy'
        ? 'REWRITE the seed into spoken textEn: mostly Thai (~60–70%) with English phrases (~30–40%) interleaved. Never paste the Thai seed as-is. The learner name alone does NOT count as English mix. '
        : 'REWRITE the seed into spoken textEn: mostly English (~60–70%) with light Thai (~30–40%) interleaved. Never paste a Thai-only seed. Include real English phrases beyond the learner name. ';

  return (
    'Start a Free Talk session as Teacher B in phase greeting. ' +
    `Greeting vibe seed (inspiration ONLY — do NOT copy verbatim): "${seed}". ` +
    `You MUST rewrite it into a natural spoken line for language level ${options.languageLevel}. ` +
    `Weave in the learner's name (${name}) naturally once. ` +
    'Then add ONE short follow-up that fits the vibe (not always "how\'s your day"). ' +
    'Vary like a real friend — playful, curious, teasing lightly. Keep total reply short (1–2 beats). ' +
    'Do NOT use emojis anywhere in textEn or textTh. ' +
    'Do NOT explain Free Talk, do NOT say "ready for Free Talk", do NOT pitch "we can talk about anything for a few minutes". ' +
    'Do not lock them into a cafe, pets, or lesson script. ' +
    mixRule +
    'textTh is Thai-only subtitle of the same meaning. ' +
    `${memoryHint} ` +
    'Return JSON with textEn, textTh, phase (greeting), nextAction (explore or encourage), ' +
    'light internal fields (intent, emotion, grammarNote, topic, conversationDepth), ' +
    'and set grammarDamage/naturalnessDamage to none with empty issueNote/softRecastEn/softRecastTh.'
  );
}

export function openingUserPrompt(topicId: string): string {
  if (topicId === 'free_talk') {
    return freeTalkOpeningUserPrompt({ languageLevel: 'balanced' });
  }

  const topic = getTopic(topicId);
  const title = topic?.titleEn ?? 'English practice';
  return (
    `Start the conversation about: ${title}. ` +
    'Greet the learner warmly as Brother Banana and ask an easy opening question.'
  );
}

/** End-of-session Free Talk summary + top important memories. */
export const FREE_TALK_SUMMARY_PROMPT = `${FREE_TALK_PERSONA}

You are writing the Free Talk wrap-up package for a Thai learner.
From the full transcript AND the logged issue list, return JSON with:
- conversationSummaryEn: 2–3 short English sentences summarizing the chat warmly (not a test score).
- conversationSummaryTh: Thai version in Teacher B voice (ครับ, not ค่ะ).
- memories: up to 5 strings — the MOST IMPORTANT lasting facts about the learner from THIS session only
  (preferences, plans, people/pets, learning goals). Rank by importance. Skip trivial one-off chit-chat.
  Write each memory as a short Thai or English bullet the coach can reuse next time
  (e.g. "ชอบกาแฟมากกว่าชา", "กำลังเตรียมสัมภาษณ์งาน"). Empty array if nothing lasting.
- feedbackEn / feedbackTh: warm overall encouragement (Teacher B voice in Thai).
- bestSentenceEn / bestSentenceNoteTh: best learner English moment (or empty if they barely spoke).
- grammarTip / grammarTipTh: one gentle tip — prefer an issue that was NOT already soft-recast mid-chat
  (suggestedMidChat=false). Empty if nothing useful.
- pronunciationIssues: [] unless clear issues.
- vocab: 3–5 useful items from the chat (or []).
- turnFeedback: coaching cards per learner turn (same rules as mission reports), or [].
  Prefer turns that still need coaching (logged issues with suggestedMidChat=false).

Never use "-", "N/A", or placeholders for empty fields — use empty string / empty array.`;
