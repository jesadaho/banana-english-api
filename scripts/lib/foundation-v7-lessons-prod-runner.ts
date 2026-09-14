import { TAP_TO_CONTINUE_SENTINEL } from '../../src/common/api.types.ts';
import { FOUNDATION_V7_CATALOG } from '../../src/learn-path/foundation-v7-path.data.ts';
import { FOUNDATION_V7_LESSON_IDS } from '../../src/lessons/foundation-v7-lessons.data.ts';
import { getLesson } from '../../src/lessons/lessons.data.ts';
import { pickUserSpeechForTurn } from '../../src/lessons/lesson-turn-driver.ts';
import {
  LessonApiClient,
  type Json,
  type TurnResult,
} from './lesson-api-client';

export const FROZEN_V7_LESSON_IDS = [
  'greetings',
  'introductions',
  'yes_no_maybe',
] as const;

export const AUTHORED_V7_LESSON_IDS = [...FOUNDATION_V7_LESSON_IDS];

export const ALL_V7_PATH_LESSON_IDS = [
  ...FROZEN_V7_LESSON_IDS,
  ...AUTHORED_V7_LESSON_IDS,
];

export const LEARNER = 'Nana';

export type ScenarioRunResult = {
  lessonId: string;
  ok: boolean;
  steps: number;
  totalMs: number;
  error?: string;
};

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export { formatMs };

function classifyResult(json: Json): string {
  const dbg = json.aiDebug as Json | undefined;
  const tier = json.assessmentTier as string | undefined;
  if (dbg?.source === 'scripted') return 'correct in pool';
  if (dbg?.source === 'gemini') {
    if (tier === 'close') return 'close out pool';
    if (tier === 'incorrect') return 'incorrect out pool';
    return 'correct out pool';
  }
  return tier ?? String(dbg?.source ?? 'gemini');
}

function turnBlock(json: Json): Json {
  return (json.opening ?? json) as Json;
}

function chromeForTurn(turn: TurnResult): { hint: string; choices: string } {
  if (turn.expectsUserSpeech === false) {
    return { hint: '(tap continue)', choices: TAP_TO_CONTINUE_SENTINEL };
  }
  const options =
    turn.emojiChoice?.options ?? turn.guidedSpeaking?.options ?? [];
  if (options.length > 0) {
    const lines = options.map(
      (o) => `${o.emoji ?? '·'} ${o.label ?? o.speak} → "${o.speak}"`,
    );
    return {
      hint: turn.guidedSpeaking?.stem?.trim() || turn.expectedSpeech?.trim() || '(speak)',
      choices: lines.length === 1 ? lines[0] : lines.join('\n         '),
    };
  }
  const expected = turn.expectedSpeech?.trim();
  return {
    hint: expected || '(speak)',
    choices: expected || '(none)',
  };
}

function pickSpeech(lessonId: string, turn: TurnResult): string {
  if (turn.expectsUserSpeech === false) return TAP_TO_CONTINUE_SENTINEL;
  const picked = pickUserSpeechForTurn(turn)?.trim() ?? '';
  if (picked && picked !== "I'm ready") return picked;
  const fallback = getLesson(lessonId)?.targetPhrases?.[0]?.trim();
  if (fallback) return fallback;
  return "I'm ready";
}

function progressLabel(turn: TurnResult): string {
  if (turn.progressMax == null) return '?/?';
  return `${turn.progressTurn ?? '?'}/${turn.progressMax}`;
}

function printStepBlock(
  step: number,
  ai: string,
  hint: string,
  choices: string,
  user: string,
  result: string,
  ms: number,
  reply: string,
  progress: string,
) {
  console.log(`\nStep ${step}`);
  console.log(`AI: ${ai}`);
  console.log(`Progress: ${progress}`);
  console.log(`Hint: ${hint}`);
  console.log(`Choices: ${choices}`);
  console.log(`User: ${user}`);
  console.log(`Result: ${result}`);
  console.log(`response time : ${formatMs(ms)}`);
  console.log(`Reply: ${reply}`);
}

export function parseFoundationV7LessonArgs(argv: string[]): string[] {
  const args = argv.slice(2);
  if (args.length === 0) return [...AUTHORED_V7_LESSON_IDS];

  const known = new Set(ALL_V7_PATH_LESSON_IDS);
  const lessonIds: string[] = [];
  const add = (ids: readonly string[]) => {
    for (const id of ids) {
      if (!lessonIds.includes(id)) lessonIds.push(id);
    }
  };

  for (const arg of args) {
    if (arg === 'all') {
      add(ALL_V7_PATH_LESSON_IDS);
      continue;
    }
    if (arg === 'authored' || arg === 'new') {
      add(AUTHORED_V7_LESSON_IDS);
      continue;
    }
    if (arg === 'frozen') {
      add(FROZEN_V7_LESSON_IDS);
      continue;
    }
    if (arg === 'ch1') {
      add(FROZEN_V7_LESSON_IDS);
      continue;
    }
    const chapter = arg === 'ch2' ? (['ch2', '02'] as const) : arg.match(/^u(\d{2})$/i);
    if (chapter) {
      const catalogChapter = FOUNDATION_V7_CATALOG.chapters.find(
        (ch) => ch.id === `v7_u${chapter[1]}`,
      );
      const fromPath = (catalogChapter?.items ?? [])
        .filter((node) => node.type === 'lesson')
        .map((node) => node.contentRef.lessonId)
        .filter((id): id is string => Boolean(id));
      if (fromPath.length === 0) {
        throw new Error(`no V7 lessons in chapter ${arg}`);
      }
      add(fromPath);
      continue;
    }
    if (!known.has(arg)) {
      throw new Error(`unknown V7 lesson: ${arg}`);
    }
    add([arg]);
  }
  return lessonIds;
}

export async function runFoundationV7Lesson(
  apiBase: string,
  lessonId: string,
  runIndex: number,
): Promise<ScenarioRunResult> {
  const config = getLesson(lessonId);
  if (!config) {
    return {
      lessonId,
      ok: false,
      steps: 0,
      totalMs: 0,
      error: `unknown lesson: ${lessonId}`,
    };
  }

  const maxTurns = (config.maxTurns ?? 30) + 8;
  const anonUser = `${lessonId}-v7-staging-${Date.now()}-${runIndex}`;
  const client = new LessonApiClient(apiBase, anonUser, true);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${lessonId} — ${config.titleEn}`);
  console.log(`API: ${apiBase} · Learner: ${LEARNER} · engine: Gemini`);
  console.log('='.repeat(80));

  let totalMs = 0;
  let reportStep = 0;

  try {
    await client.request('PUT', '/users/me', { displayName: LEARNER });
    await client.refillBananas();

    const start = await client.startLesson(lessonId);
    let turnBefore = start.turn;
    let aiPrompt = start.turn.aiResponse ?? '';
    let currentTurn = start.turn.currentTurn;
    let sameReplyStreak = 0;
    let lastReply = '';
    const seen = new Set<string>();

    while (reportStep < maxTurns) {
      const speech = pickSpeech(lessonId, turnBefore);
      const { hint, choices } = chromeForTurn(turnBefore);
      const sig = `${speech}|${(aiPrompt || '').trim().slice(0, 80)}`;
      if (seen.has(sig)) {
        throw new Error(`stuck loop with "${speech}"`);
      }
      seen.add(sig);

      reportStep++;
      const res = await client.sendUserSpeech(
        start.sessionId,
        currentTurn,
        speech,
      );
      totalMs += res.durationMs;

      const block = turnBlock(res.json);
      const reply = (block.aiResponse as string | undefined) ?? '';
      const result = classifyResult(block);
      const session = res.json.session as Json | undefined;
      const progress = progressLabel({
        ...res.turn,
        progressTurn:
          res.turn.progressTurn ?? (session?.progressTurn as number | undefined),
        progressMax:
          res.turn.progressMax ?? (session?.progressMax as number | undefined),
      });

      printStepBlock(
        reportStep,
        aiPrompt,
        hint,
        choices,
        speech,
        result,
        res.durationMs,
        reply,
        progress,
      );

      if (reply.trim() === lastReply.trim() && reply.trim()) {
        sameReplyStreak += 1;
      } else {
        sameReplyStreak = 0;
      }
      lastReply = reply;
      if (sameReplyStreak >= 2) {
        throw new Error(`looped the same AI reply ${sameReplyStreak + 1} times`);
      }

      currentTurn = res.turn.currentTurn;
      turnBefore = res.turn;
      aiPrompt = reply;

      if (res.turn.isTaskComplete) {
        console.log(`\n${'─'.repeat(72)}`);
        console.log(
          `✅ ${lessonId} complete · ${reportStep} turns · ${formatMs(totalMs)} · ${progress}`,
        );
        return { lessonId, ok: true, steps: reportStep, totalMs };
      }
    }

    throw new Error(`did not complete within ${maxTurns} turns`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ ${lessonId} failed: ${error}`);
    return { lessonId, ok: false, steps: reportStep, totalMs, error };
  }
}
