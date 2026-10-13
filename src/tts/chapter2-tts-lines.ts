import { TAP_TO_CONTINUE_TURN_TEXT } from '../common/api.types';
import { scriptedAiDebug } from '../common/ai-debug';
import {
  ADVENTURE_A2_LESSONS,
  buildFoundationV7Steps,
  FOUNDATION_V7_LESSONS,
} from '../lessons/foundation-v7-lessons.data';
import { V7_LEGACY_FLOWS } from '../lessons/foundation-v7-legacy-flows';
import type { V7TeachingStep } from '../lessons/foundation-v7-lessons.data';
import type { ChatTurn } from '../session-store/session-store.service';
import type { TrainingTurnReply } from '../gemini/gemini-chat.service';
import {
  TrainingTurnEngine,
  type TrainingEngineTurnInput,
} from '../training/engine/training-turn.engine';
import type { TrainingAiGate } from '../training/engine/ai-gate';
import { FOUNDATION_PROBE_LEARNER } from '../training/foundation/foundation-poolgate.fixtures';
import catalog from '../learn-path/foundation-v7-path.catalog.json';
import a2Catalog from '../learn-path/adventure-a2-path.catalog.json';
import { lineContainsLearnerName } from './chapter1-tts-lines';
import { BARE_PRAISE_LINES } from './english-praises';
import { spokenTurnText, ttsBankKey } from './tts-bank';

/** Chapter 2 choice lessons. Say It and the conversation stay on live TTS. */
export const CHAPTER2_TTS_LESSON_IDS = [
  'fnd_v7_please_and_thank_you',
  'fnd_v7_goodbye_see_you',
] as const;

type CatalogChapter = {
  number: number;
  items: Array<{ type: string; contentRef?: { lessonId?: string } }>;
};

/** Scripted Foundation lessons in a chapter range. Say It and conversation stay live. */
export function foundationLessonIds(fromChapter: number, toChapter: number): string[] {
  const ids: string[] = [];
  for (const chapter of (catalog as { chapters: CatalogChapter[] }).chapters) {
    if (chapter.number < fromChapter || chapter.number > toChapter) continue;
    for (const item of chapter.items) {
      const lessonId = item.type === 'lesson' ? item.contentRef?.lessonId : undefined;
      if (lessonId) ids.push(lessonId);
    }
  }
  return ids;
}

const OFF_TOPIC = 'I like pizza.';

type Walk = {
  reply: TrainingTurnReply;
  turns: ChatTurn[];
};

function spoken(reply: TrainingTurnReply): string {
  return spokenTurnText(reply.ttsText, reply.textEn);
}

function addBankable(bucket: Set<string>, text: string, name: string): void {
  const key = ttsBankKey(text);
  if (!key || lineContainsLearnerName(key, name)) return;
  if (key.includes('GEMINI_SHOULD_NOT_APPEAR')) {
    throw new Error('Bank line still depends on Gemini wording');
  }
  bucket.add(key);
}

function aiTurn(reply: TrainingTurnReply): ChatTurn {
  return {
    speaker: 'ai',
    textEn: reply.textEn,
    textTh: reply.textTh,
    ttsText: reply.ttsText,
    v7Step: reply.v7Step,
    v7Retry: reply.v7Retry,
    v7Choice: reply.v7Choice,
    expectedSpeech: reply.expectedSpeech,
    expectsUserSpeech: reply.expectsUserSpeech,
  };
}

function engineFor(): TrainingTurnEngine {
  return new TrainingTurnEngine({
    runChoiceLessonAssess: async () => ({
      reply: {
        textEn: 'GEMINI_SHOULD_NOT_APPEAR',
        textTh: '',
        isLessonComplete: false,
        expectsUserSpeech: true,
        assessmentTier: 'incorrect' as const,
      },
      aiDebug: scriptedAiDebug(),
    }),
  } as unknown as TrainingAiGate);
}

/**
 * Scripted teacher lines for Chapter 2 lessons.
 * Correct answers, every valid choice, the first retry, and the soft advance.
 */
export async function collectChapter2BankLines(
  name = FOUNDATION_PROBE_LEARNER,
): Promise<string[]> {
  return collectFoundationBankLines(2, 2, name);
}

/** Scripted Adventure A2 lessons in a chapter range. Say It and conversation stay live. */
export function adventureA2LessonIds(fromChapter: number, toChapter: number): string[] {
  const ids: string[] = [];
  for (const chapter of (a2Catalog as { chapters: CatalogChapter[] }).chapters) {
    if (chapter.number < fromChapter || chapter.number > toChapter) continue;
    for (const item of chapter.items) {
      const lessonId = item.type === 'lesson' ? item.contentRef?.lessonId : undefined;
      if (lessonId) ids.push(lessonId);
    }
  }
  return ids;
}

/** Chapters 2–16 scripted lesson lines, plus both shared English praise sets. */
export async function collectFoundationBankLines(
  fromChapter = 2,
  toChapter = 16,
  name = FOUNDATION_PROBE_LEARNER,
): Promise<string[]> {
  const lines = new Set<string>(BARE_PRAISE_LINES);
  for (const lessonId of foundationLessonIds(fromChapter, toChapter)) {
    await collectLesson(lessonId, name, lines);
  }
  return [...lines].sort((a, b) => a.localeCompare(b));
}

/** Adventure A2 chapters 1–8 scripted lesson lines. Praise stays inside the sentence. */
export async function collectAdventureA2BankLines(
  fromChapter = 1,
  toChapter = 8,
  name = FOUNDATION_PROBE_LEARNER,
): Promise<string[]> {
  const lines = new Set<string>();
  for (const lessonId of adventureA2LessonIds(fromChapter, toChapter)) {
    await collectA2Lesson(lessonId, name, lines);
  }
  return [...lines].sort((a, b) => a.localeCompare(b));
}

async function collectA2Lesson(
  lessonId: string,
  name: string,
  lines: Set<string>,
): Promise<void> {
  const steps = buildFoundationV7Steps(lessonId);
  const config = ADVENTURE_A2_LESSONS.find((lesson) => lesson.lessonId === lessonId);
  if (!config) throw new Error(`missing A2 lesson ${lessonId}`);
  const engine = engineFor();
  const advances: string[] = [];

  for (const step of steps) {
    const here = await replay(engine, config, name, advances, lines, false);
    if (advances.length === 0) addBankable(lines, spoken(here.reply), name);
    if (step.kind === 'complete' || here.reply.isLessonComplete) break;
    if (!step.expectsUserSpeech) {
      await say(engine, config, name, here, TAP_TO_CONTINUE_TURN_TEXT, lines);
      advances.push(TAP_TO_CONTINUE_TURN_TEXT);
      continue;
    }
    if (!step.expectedSpeech) continue;
    for (const answer of answersFor(step)) {
      await say(engine, config, name, here, answer, lines);
    }
    const firstWrong = await say(engine, config, name, here, OFF_TOPIC, lines);
    await say(engine, config, name, firstWrong, OFF_TOPIC, lines);
    advances.push(step.expectedSpeech);
  }
}

async function collectLesson(
  lessonId: string,
  name: string,
  lines: Set<string>,
): Promise<void> {
  const steps = V7_LEGACY_FLOWS[lessonId];
  const config = FOUNDATION_V7_LESSONS.find((lesson) => lesson.lessonId === lessonId);
  if (!steps || !config) throw new Error(`missing chapter 2 lesson ${lessonId}`);

  const engine = engineFor();
  const prefix: string[] = [];

  for (const step of steps) {
    const here = await replay(engine, config, name, prefix, lines, false);
    if (prefix.length === 0) addBankable(lines, spoken(here.reply), name);
    if (!step.expectsUserSpeech || !step.expectedSpeech) continue;

    const answers = answersFor(step);
    for (const answer of answers) {
      await say(engine, config, name, here, answer, lines);
    }

    const firstWrong = await say(engine, config, name, here, OFF_TOPIC, lines);
    await say(engine, config, name, firstWrong, OFF_TOPIC, lines);

    prefix.push(step.expectedSpeech);
  }
}

function answersFor(step: V7TeachingStep): string[] {
  const presentation = step.presentation;
  const options = presentation?.options ?? [];
  const extra = presentation?.extraAnswers?.map((answer) => answer.speak) ?? [];
  if (presentation?.answerMode === 'any') {
    return [...options.map((option) => option.speak), ...extra];
  }
  const answers = [step.expectedSpeech!];
  for (const option of options) {
    if (option.speak !== step.expectedSpeech) answers.push(option.speak);
    if (option.label && option.label !== option.speak) answers.push(option.label);
  }
  return [...new Set(answers)];
}

async function replay(
  engine: TrainingTurnEngine,
  config: TrainingEngineTurnInput['config'],
  name: string,
  answers: string[],
  lines: Set<string>,
  record: boolean,
): Promise<Walk> {
  let reply = engine.buildOpening(config, name).reply;
  let turns: ChatTurn[] = [aiTurn(reply)];
  if (record) addBankable(lines, spoken(reply), name);
  for (const answer of answers) {
    const next = await say(engine, config, name, { reply, turns }, answer, record ? lines : new Set());
    reply = next.reply;
    turns = next.turns;
  }
  return { reply, turns };
}

async function say(
  engine: TrainingTurnEngine,
  config: TrainingEngineTurnInput['config'],
  name: string,
  state: Walk,
  text: string,
  lines: Set<string>,
): Promise<Walk> {
  const turns = [...state.turns, { speaker: 'user' as const, textEn: text }];
  const reply = (
    await engine.runTurn({
      config,
      turns,
      userText: text,
      originalText: text,
      learnerFirstName: name,
      sessionProgressTurn: state.reply.v7Step,
    })
  ).reply;
  addBankable(lines, spoken(reply), name);
  return { reply, turns: [...turns, aiTurn(reply)] };
}
