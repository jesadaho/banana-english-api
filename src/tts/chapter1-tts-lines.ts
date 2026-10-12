import {
  buildChoiceLessonAfterUser,
  pinChoiceLessonAiReply,
  type ChoiceLessonDef,
} from '../training/scripts/choice-lesson.script';
import type { ScriptTurnResult } from '../training/scripts/types';
import { getFoundationChoiceLesson } from '../training/scripts/foundation.registry';
import {
  expectedInPoolSpeech,
  mockGeminiReply,
  type Turn,
} from '../training/foundation/foundation-poolgate.harness';
import { FOUNDATION_PROBE_LEARNER } from '../training/foundation/foundation-poolgate.fixtures';
import { spokenTurnText, ttsBankKey } from './tts-bank';

/** Chapter 1 lessons that use the Foundation choice-lesson script. */
export const CHAPTER1_TTS_LESSON_IDS = [
  'greetings',
  'introductions',
  'yes_no_maybe',
] as const;

const PRAISES = ['ถูกต้องครับ!', 'ดีมากครับ!', 'เยี่ยมครับ!'] as const;

const WRONG_CANDIDATES = [
  'I like pizza.',
  'Thank you.',
  'Good morning.',
  'Hello there.',
  'See you tomorrow.',
];

type SpokenReply = {
  textEn?: string | null;
  ttsText?: string | null;
};

function spoken(reply: SpokenReply): string {
  return spokenTurnText(reply.ttsText, reply.textEn);
}

/** A line that still contains this learner's name cannot be shared. */
export function lineContainsLearnerName(text: string, name: string): boolean {
  if (text.includes('{name}')) return true;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

function praiseIndex(text: string): number {
  let hash = 0;
  for (const char of text.trim()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % PRAISES.length;
}

/** Gemini texts that collapse to each of the three fixed correct-advance praises. */
export function praiseSeeds(): string[] {
  const found: Array<string | undefined> = [];
  for (let i = 0; found.filter(Boolean).length < PRAISES.length && i < 5000; i++) {
    const text = `bank-praise-${i}`;
    const index = praiseIndex(text);
    if (!found[index]) found[index] = text;
  }
  if (found.some((seed) => !seed)) {
    throw new Error('Could not find a Gemini seed for every concise praise');
  }
  return found as string[];
}

function openingTurn(def: ChoiceLessonDef, name: string): Turn[] {
  const opening = def.buildOpening(name);
  return [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];
}

function pushAi(turns: Turn[], reply: ScriptTurnResult): void {
  turns.push({
    speaker: 'ai',
    textEn: reply.textEn ?? '',
    expectedSpeech: reply.expectedSpeech,
    assessmentTier: reply.assessmentTier,
    wasSoftAdvance: reply.wasSoftAdvance,
    guidedSpeaking: reply.guidedSpeaking ?? null,
  });
}

function scriptedSoftAnswer(
  def: ChoiceLessonDef,
  turns: Turn[],
  name: string,
  sessionProgressTurn: number | undefined,
  avoid: string[],
): string {
  for (const candidate of WRONG_CANDIDATES) {
    if (avoid.includes(candidate)) continue;
    const trial = [...turns, { speaker: 'user' as const, textEn: candidate }];
    const route = buildChoiceLessonAfterUser(def, {
      turns: trial,
      learnerFirstName: name,
      sessionProgressTurn,
    });
    if (route && !route.deferToAi && route.wasSoftAdvance) return candidate;
  }
  throw new Error(
    `${def.lessonId}: no scripted soft-advance at progress ${def.progressFn(turns)}`,
  );
}

function deferringAnswer(
  def: ChoiceLessonDef,
  turns: Turn[],
  name: string,
  sessionProgressTurn: number | undefined,
  avoid: string[],
): string {
  for (const candidate of WRONG_CANDIDATES) {
    if (avoid.includes(candidate)) continue;
    const trial = [...turns, { speaker: 'user' as const, textEn: candidate }];
    const route = buildChoiceLessonAfterUser(def, {
      turns: trial,
      learnerFirstName: name,
      sessionProgressTurn,
    });
    if (route?.deferToAi) return candidate;
  }
  throw new Error(`${def.lessonId}: no out-of-pool answer at progress ${def.progressFn(turns)}`);
}

function addBankable(bucket: Set<string>, text: string, name: string): void {
  const key = ttsBankKey(text);
  if (!key || lineContainsLearnerName(key, name)) return;
  bucket.add(key);
}

/**
 * Spoken lines from the PoolGate 5-scenario matrix for Chapter 1.
 * Lines that still contain the learner name are omitted.
 */
export function collectChapter1BankLines(
  name = FOUNDATION_PROBE_LEARNER,
): string[] {
  const lines = new Set<string>();
  const seeds = praiseSeeds();

  for (const lessonId of CHAPTER1_TTS_LESSON_IDS) {
    const def = getFoundationChoiceLesson(lessonId);
    if (!def) throw new Error(`missing lesson ${lessonId}`);

    addBankable(lines, spoken(def.buildOpening(name)), name);
    collectInPool(def, name, lines);
    collectAssessed(def, name, lines, seeds);
    collectSoftAdvance(def, name, lines);
  }

  return [...lines].sort();
}

/** Scenario 1 — exact in-pool answer, fully scripted next line. */
function collectInPool(
  def: ChoiceLessonDef,
  name: string,
  lines: Set<string>,
): void {
  const turns = openingTurn(def, name);
  for (let step = 1; step <= def.maxStep; step++) {
    const userText = expectedInPoolSpeech(def, step, turns, name);
    turns.push({ speaker: 'user', textEn: userText });
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: name });
    if (!reply || reply.deferToAi) {
      throw new Error(`${def.lessonId} step ${step}: in-pool reply missing`);
    }
    addBankable(lines, spoken(reply), name);
    pushAi(turns, reply);
  }
}

/**
 * Scenarios 2–4. Scenario 2 banks all three fixed praises.
 * Scenario 4 is banked only when the spoken line does not change with Gemini's wording.
 */
function collectAssessed(
  def: ChoiceLessonDef,
  name: string,
  lines: Set<string>,
  seeds: string[],
): void {
  let sessionProgressTurn = 1;
  const turns = openingTurn(def, name);

  for (let step = 1; step <= def.maxStep; step++) {
    const wrong = deferringAnswer(def, turns, name, sessionProgressTurn, []);
    turns.push({ speaker: 'user', textEn: wrong });

    for (const seed of seeds) {
      const pinned = pinChoiceLessonAiReply(
        def,
        turns,
        mockGeminiReply('correct', seed),
        sessionProgressTurn,
        name,
      );
      addBankable(lines, spoken(pinned), name);
    }

    const close = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('close', 'เกือบถูกแล้วครับ'),
      sessionProgressTurn,
      name,
    );
    addBankable(lines, spoken(close), name);

    const incorrectA = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('incorrect', 'ยังไม่ใช่นะครับ ลองพูดว่า'),
      sessionProgressTurn,
      name,
    );
    const incorrectB = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('incorrect', 'ประโยคนี้ยังไม่ตรงครับ'),
      sessionProgressTurn,
      name,
    );
    if (ttsBankKey(spoken(incorrectA)) === ttsBankKey(spoken(incorrectB))) {
      addBankable(lines, spoken(incorrectA), name);
    }

    const advance = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('correct', seeds[0]),
      sessionProgressTurn,
      name,
    );
    pushAi(turns, advance);
    sessionProgressTurn++;
  }
}

/** Scenario 5 — second wrong, scripted soft-advance, no Gemini. */
function collectSoftAdvance(
  def: ChoiceLessonDef,
  name: string,
  lines: Set<string>,
): void {
  let sessionProgressTurn = 1;
  const turns = openingTurn(def, name);

  for (let step = 1; step <= def.maxStep; step++) {
    const wrong = deferringAnswer(def, turns, name, sessionProgressTurn, []);
    turns.push({ speaker: 'user', textEn: wrong });
    const incorrect = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('incorrect', 'ยังไม่ใช่นะครับ ลองพูดว่า'),
      sessionProgressTurn,
      name,
    );
    pushAi(turns, incorrect);

    const again = scriptedSoftAnswer(def, turns, name, sessionProgressTurn, [wrong]);
    turns.push({ speaker: 'user', textEn: again });
    const soft = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName: name,
      sessionProgressTurn,
    });
    if (!soft || soft.deferToAi) {
      throw new Error(`${def.lessonId} step ${step}: soft-advance was not scripted`);
    }
    addBankable(lines, spoken(soft), name);
    pushAi(turns, soft);
    sessionProgressTurn++;
  }
}
