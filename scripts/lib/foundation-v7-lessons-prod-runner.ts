import { TAP_TO_CONTINUE_SENTINEL } from '../../src/common/api.types.ts';
import { FOUNDATION_V7_CATALOG } from '../../src/learn-path/foundation-v7-path.data.ts';
import { FOUNDATION_V7_LESSON_IDS } from '../../src/lessons/foundation-v7-lessons.data.ts';
import {
  FOUNDATION_V7_LESSON_ID_ALIASES,
  canonicalFoundationV7LessonId,
} from '../../src/lessons/foundation-v7-lesson-id-aliases.ts';
import { getLesson } from '../../src/lessons/lessons.data.ts';
import { pickUserSpeechForTurn } from '../../src/lessons/lesson-turn-driver.ts';
import {
  foundationOutOfPoolCloseMiss,
  foundationOutOfPoolWrong,
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolWrongAgain,
} from '../../src/training/foundation/foundation-poolgate.harness.ts';
import {
  LessonApiClient,
  type Json,
  type TurnResult,
} from './lesson-api-client';

export const SCENARIO_TITLES: Record<number, string> = {
  1: 'Scenario 1 — in-pool correct ทุก step → จบบท',
  2: 'Scenario 2 — out-pool correct ทุก step → จบบท',
  3: 'Scenario 3 — out-pool close ทุก step → จบบท',
  4: 'Scenario 4 — out-pool wrong + in-pool พูดตาม recovery → จบบท',
  5: 'Scenario 5 — out-pool wrong + พูดตามผิดอีกครั้ง → soft-advance → จบบท',
};

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
  titleEn: string;
  scenario: number;
  ok: boolean;
  steps: number;
  totalMs: number;
  error?: string;
};

export function lessonSummaryLabel(lessonId: string, titleEn?: string): string {
  const title = titleEn?.trim() || getLesson(lessonId)?.titleEn?.trim() || '';
  return title ? `${title}  (${lessonId})` : lessonId;
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export { formatMs };

export function classifyResult(json: Json): string {
  const dbg = json.aiDebug as Json | undefined;
  const tier = json.assessmentTier as string | undefined;
  const reply = String(json.aiResponse ?? '');
  if (json.wasSoftAdvance || /ลองฝึกต่อด้วยกัน/.test(reply)) {
    return 'wrong (soft-advance)';
  }
  if (tier === 'incorrect') return 'incorrect out pool';
  if (tier === 'close') return 'close out pool';
  if (dbg?.source === 'scripted') return 'correct in pool';
  if (dbg?.source === 'gemini') return 'correct out pool';
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

function pickExpected(lessonId: string, turn: TurnResult): string {
  if (turn.expectsUserSpeech === false) return TAP_TO_CONTINUE_SENTINEL;
  const picked = pickUserSpeechForTurn(turn)?.trim() ?? '';
  if (picked && picked !== "I'm ready") return picked;
  const fallback = getLesson(lessonId)?.targetPhrases?.[0]?.trim();
  if (fallback) return fallback;
  return "I'm ready";
}

function pickUserSpeech(
  lessonId: string,
  scenario: number,
  turn: TurnResult,
  step: number,
): { speech: string; recoverExact?: string; recoverWrong?: string } {
  const expected = pickExpected(lessonId, turn);
  if (expected === TAP_TO_CONTINUE_SENTINEL) return { speech: expected };

  switch (scenario) {
    case 2:
      return { speech: introductionsOutOfPoolNearMiss(expected, step) };
    case 3:
      return { speech: foundationOutOfPoolCloseMiss(expected, step, lessonId) };
    case 4:
      return {
        speech: foundationOutOfPoolWrong(expected, step, lessonId),
        recoverExact: expected,
      };
    case 5:
      return {
        speech: foundationOutOfPoolWrong(expected, step, lessonId),
        recoverWrong: introductionsOutOfPoolWrongAgain(expected, step),
      };
    default:
      return { speech: expected };
  }
}

function turnSig(speech: string, aiPrompt: string): string {
  return `${speech}|${(aiPrompt || '').trim().slice(0, 80)}`;
}

function isAlreadyCompleteError(err: unknown): boolean {
  return err instanceof Error && /409: Session already complete/i.test(err.message);
}

function stayedOnSpeechStep(
  before: TurnResult,
  after: TurnResult,
  result: string,
): boolean {
  if (after.isTaskComplete) return false;
  if (result === 'incorrect out pool') return true;
  const expectedBefore = before.expectedSpeech?.trim() ?? '';
  const expectedAfter = after.expectedSpeech?.trim() ?? '';
  return Boolean(expectedBefore) && expectedBefore === expectedAfter;
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

export function parseFoundationV7LessonArgs(argv: string[]): {
  lessonIds: string[];
  scenarios: number[];
} {
  const args = argv.slice(2);
  const known = new Set([
    ...ALL_V7_PATH_LESSON_IDS,
    ...Object.keys(FOUNDATION_V7_LESSON_ID_ALIASES),
  ]);
  const lessonIds: string[] = [];
  const scenarios: number[] = [];
  const add = (ids: readonly string[]) => {
    for (const id of ids) {
      if (!lessonIds.includes(id)) lessonIds.push(id);
    }
  };

  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      const n = Number(arg);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new Error('scenario must be 1–5');
      }
      if (!scenarios.includes(n)) scenarios.push(n);
      continue;
    }
    if (arg === 'all') {
      add(ALL_V7_PATH_LESSON_IDS);
      continue;
    }
    if (arg === 'authored' || arg === 'new') {
      add(AUTHORED_V7_LESSON_IDS);
      continue;
    }
    if (arg === 'frozen' || arg === 'ch1') {
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
    add([canonicalFoundationV7LessonId(arg)]);
  }

  return {
    lessonIds: lessonIds.length > 0 ? lessonIds : [...AUTHORED_V7_LESSON_IDS],
    scenarios: scenarios.length > 0 ? scenarios : [1, 2, 3, 4, 5],
  };
}

export async function runFoundationV7Lesson(
  apiBase: string,
  lessonId: string,
  scenario: number,
  runIndex: number,
): Promise<ScenarioRunResult> {
  const config = getLesson(lessonId);
  if (!config) {
    return {
      lessonId,
      titleEn: lessonId,
      scenario,
      ok: false,
      steps: 0,
      totalMs: 0,
      error: `unknown lesson: ${lessonId}`,
    };
  }

  const maxTurns = (config.maxTurns ?? 30) + 8;
  const anonUser = `${lessonId}-s${scenario}-v7-${Date.now()}-${runIndex}`;
  const client = new LessonApiClient(apiBase, anonUser, true);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${lessonId} — ${config.titleEn}`);
  console.log(`${SCENARIO_TITLES[scenario]}`);
  console.log(`API: ${apiBase} · Learner: ${LEARNER} · engine: Gemini`);
  console.log('='.repeat(80));

  let totalMs = 0;
  let reportStep = 0;
  let speakStep = 1;

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

    const finish = (steps: number, progress: string) => {
      console.log(`\n${'─'.repeat(72)}`);
      console.log(
        `✅ ${lessonId} scenario ${scenario} complete · ${steps} turns · ${formatMs(totalMs)} · ${progress}`,
      );
      return { lessonId, titleEn: config.titleEn, scenario, ok: true, steps, totalMs };
    };

    const sendSpeech = async (speech: string) => {
      try {
        return await client.sendUserSpeech(start.sessionId, currentTurn, speech);
      } catch (err) {
        if (isAlreadyCompleteError(err) && reportStep > 0) {
          return 'complete' as const;
        }
        throw err;
      }
    };

    while (reportStep < maxTurns) {
      const picked = pickUserSpeech(lessonId, scenario, turnBefore, speakStep);
      let speech = picked.speech;
      const expected = pickExpected(lessonId, turnBefore);
      const { hint, choices } = chromeForTurn(turnBefore);
      let sig = turnSig(speech, aiPrompt);
      if (seen.has(sig) && speech === TAP_TO_CONTINUE_SENTINEL) {
        const fallback =
          turnBefore.expectedSpeech?.trim() ||
          config.targetPhrases.find((phrase) => phrase.trim()) ||
          '';
        if (fallback) {
          speech = fallback;
          sig = turnSig(speech, aiPrompt);
          console.log(`(unstick continue loop → speak "${speech}")`);
        }
      }
      if (seen.has(sig) && speech !== expected && expected !== TAP_TO_CONTINUE_SENTINEL) {
        console.log(`(unstick "${speech}" → "${expected}")`);
        speech = expected;
        sig = turnSig(speech, aiPrompt);
      }
      if (seen.has(sig)) {
        throw new Error(`stuck loop with "${speech}"`);
      }
      seen.add(sig);

      reportStep++;
      const res = await sendSpeech(speech);
      if (res === 'complete') return finish(reportStep, progressLabel(turnBefore));
      totalMs += res.durationMs;

      const block = turnBlock(res.json);
      const reply = (block.aiResponse as string | undefined) ?? '';
      const result = classifyResult(block);
      const session = res.json.session as Json | undefined;
      const progressOf = (turn: TurnResult) =>
        progressLabel({
          ...turn,
          progressTurn:
            turn.progressTurn ?? (session?.progressTurn as number | undefined),
          progressMax:
            turn.progressMax ?? (session?.progressMax as number | undefined),
        });
      const progress = progressOf(res.turn);

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

      const recoverNow =
        speech !== TAP_TO_CONTINUE_SENTINEL &&
        Boolean(picked.recoverExact || picked.recoverWrong) &&
        stayedOnSpeechStep(turnBefore, res.turn, result);

      currentTurn = res.turn.currentTurn;
      turnBefore = res.turn;
      aiPrompt = reply;

      if (res.turn.isTaskComplete) return finish(reportStep, progress);

      if (recoverNow && picked.recoverExact) {
        reportStep++;
        const recHint = chromeForTurn(turnBefore);
        const recovery = await sendSpeech(picked.recoverExact);
        if (recovery === 'complete') return finish(reportStep, progressOf(turnBefore));
        totalMs += recovery.durationMs;
        const recBlock = turnBlock(recovery.json);
        const recReply = (recBlock.aiResponse as string | undefined) ?? '';
        printStepBlock(
          reportStep,
          reply,
          recHint.hint,
          recHint.choices,
          picked.recoverExact,
          classifyResult(recBlock),
          recovery.durationMs,
          recReply,
          progressOf(recovery.turn),
        );
        currentTurn = recovery.turn.currentTurn;
        turnBefore = recovery.turn;
        aiPrompt = recReply;
        lastReply = recReply;
        sameReplyStreak = 0;
        if (recovery.turn.isTaskComplete) return finish(reportStep, progressOf(recovery.turn));
      } else if (recoverNow && picked.recoverWrong) {
        reportStep++;
        const recHint = chromeForTurn(turnBefore);
        const secondWrong = await sendSpeech(picked.recoverWrong);
        if (secondWrong === 'complete') return finish(reportStep, progressOf(turnBefore));
        totalMs += secondWrong.durationMs;
        const softBlock = turnBlock(secondWrong.json);
        const softReply = (softBlock.aiResponse as string | undefined) ?? '';
        printStepBlock(
          reportStep,
          reply,
          recHint.hint,
          recHint.choices,
          picked.recoverWrong,
          classifyResult(softBlock),
          secondWrong.durationMs,
          softReply,
          progressOf(secondWrong.turn),
        );
        currentTurn = secondWrong.turn.currentTurn;
        turnBefore = secondWrong.turn;
        aiPrompt = softReply;
        lastReply = softReply;
        sameReplyStreak = 0;
        if (secondWrong.turn.isTaskComplete) {
          return finish(reportStep, progressOf(secondWrong.turn));
        }
      }

      if (
        speech !== TAP_TO_CONTINUE_SENTINEL &&
        (turnBefore.isTaskComplete ||
          pickExpected(lessonId, turnBefore) !== expected)
      ) {
        speakStep += 1;
      }
    }

    throw new Error(`did not complete within ${maxTurns} turns`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ ${lessonId} scenario ${scenario} failed: ${error}`);
    return {
      lessonId,
      titleEn: config.titleEn,
      scenario,
      ok: false,
      steps: reportStep,
      totalMs,
      error,
    };
  }
}
