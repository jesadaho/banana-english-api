import {
  LessonApiClient,
  type Json,
  type TurnResult,
} from './lesson-api-client';
import { boardToScriptTurn } from '../../src/training/scripts/choice-lesson.script.ts';
import { extractIntroducedName } from '../../src/training/foundation/foundation.helpers.ts';
import type { FoundationLessonId } from '../../src/training/foundation/foundation.helpers.ts';
import { FOUNDATION_LESSON_IDS } from '../../src/training/foundation/foundation.helpers.ts';
import { FOUNDATION_POOLGATE_FIXTURES } from '../../src/training/foundation/foundation-poolgate.fixtures.ts';
import {
  foundationOutOfPoolCloseMiss,
  foundationOutOfPoolWrong,
  getDef,
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolWrongAgain,
} from '../../src/training/foundation/foundation-poolgate.harness.ts';
import type { ChoiceLessonDef } from '../../src/training/scripts/choice-lesson.script.ts';

export const SCENARIO_TITLES: Record<number, string> = {
  1: 'Scenario 1 — in-pool correct ทุก step → จบบท',
  2: 'Scenario 2 — out-pool correct ทุก step → จบบท',
  3: 'Scenario 3 — out-pool close ทุก step → จบบท',
  4: 'Scenario 4 — out-pool wrong + in-pool พูดตาม recovery → จบบท',
  5: 'Scenario 5 — out-pool wrong + พูดตามผิดอีกครั้ง → soft-advance → จบบท',
};

export const ALL_SCENARIO_LESSON_IDS = [...FOUNDATION_LESSON_IDS] as const;

export type ScenarioLessonId = FoundationLessonId;

export const LEARNER = 'Nana';
const MAX_TURNS = 24;

export type HistoryTurn = {
  speaker: 'ai' | 'user';
  textEn: string;
  expectedSpeech?: string | null;
};

export type ScenarioRunResult = {
  lessonId: string;
  scenario: number;
  ok: boolean;
  steps: number;
  totalMs: number;
  error?: string;
};

function pickExpected(turn: TurnResult): string {
  const expected = turn.expectedSpeech?.trim();
  if (expected) return expected;
  const guided = turn.guidedSpeaking;
  if (guided?.speak?.trim()) return guided.speak.trim();
  const option = guided?.options?.find((o) => o.speak?.trim());
  if (option?.speak?.trim()) return option.speak.trim();
  throw new Error('missing expected speech on turn');
}

export function chromeBeforeAnswer(
  def: ChoiceLessonDef,
  lessonId: string,
  turnBefore: TurnResult,
  history: HistoryTurn[],
) {
  const gs = turnBefore.guidedSpeaking;
  if (gs?.options?.length) {
    const hint = gs.stem?.trim() || '(none)';
    const lines = gs.options.map(
      (o) => `${o.emoji ?? '·'} ${o.label ?? o.speak} → "${o.speak}"`,
    );
    const body = lines.length === 1 ? lines[0] : lines.join('\n         ');
    return { hint, choices: body };
  }

  const name = extractIntroducedName(history, LEARNER);
  const boardHistory =
    extractIntroducedName(history) === name
      ? history
      : [...history, { speaker: 'user' as const, textEn: `My name is ${name}.` }];
  const progressStep = (turnBefore.progressTurn ?? 0) + 1;
  const expected = turnBefore.expectedSpeech?.trim() ?? '';
  const normalizedExpected = expected
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
  const matchingSteps: number[] = [];
  if (normalizedExpected) {
    for (let step = 1; step <= def.maxStep; step++) {
      const candidate = def.boardForStep(step, boardHistory);
      const boardExpected = (candidate?.expectedSpeech ?? '')
        .trim()
        .toLowerCase()
        .replace(/[.!?]+$/g, '')
        .replace(/\s+/g, ' ');
      if (boardExpected && boardExpected === normalizedExpected) {
        matchingSteps.push(step);
      }
    }
  }
  const step = matchingSteps.includes(progressStep)
    ? progressStep
    : (matchingSteps.find((s) => s >= progressStep) ??
      matchingSteps.at(-1) ??
      progressStep);
  const board = def.boardForStep(step, boardHistory);
  if (!board) return { hint: '(none)', choices: '(none)' };
  const scripted = boardToScriptTurn(board);
  const stem = scripted.guidedSpeaking?.stem?.trim() ?? '';
  const hint = stem || '(none)';
  const options = board.options ?? scripted.guidedSpeaking?.options ?? [];
  if (options.length === 0) {
    return { hint, choices: '(none)' };
  }
  const lines = options.map(
    (o) => `${o.emoji ?? '·'} ${o.label ?? o.speak} → "${o.speak}"`,
  );
  const repeatOnly =
    options.length > 0 && !(scripted.guidedSpeaking?.options?.length);
  const suffix = repeatOnly ? ' (repeat-only)' : '';
  const body = lines.length === 1 ? lines[0] : lines.join('\n         ');
  return { hint, choices: `${body}${suffix}` };
}

export function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function classifyResult(json: Json): string {
  const dbg = json.aiDebug as Json | undefined;
  const tier = json.assessmentTier as string | undefined;
  if (dbg?.source === 'scripted') {
    if (tier === 'incorrect' && /ตรงนี้พูด(ว่า|ได้ว่า)/.test(String(json.aiResponse ?? ''))) {
      return 'wrong (soft-advance)';
    }
    return 'correct in pool';
  }
  if (dbg?.source === 'gemini') {
    if (tier === 'close') return 'close out pool';
    if (tier === 'incorrect') return 'incorrect out pool';
    return 'correct out pool';
  }
  return tier ?? String(dbg?.source ?? '—');
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
) {
  console.log(`\nStep ${step}`);
  console.log(`AI: ${ai}`);
  console.log(`Hint: ${hint}`);
  console.log(`Choices: ${choices}`);
  console.log(`User: ${user}`);
  console.log(`Result: ${result}`);
  console.log(`response time : ${formatMs(ms)}`);
  console.log(`Reply: ${reply}`);
}

function turnBlock(json: Json): Json {
  return (json.opening ?? json) as Json;
}

function pickUserSpeech(
  lessonId: string,
  scenario: number,
  turnBefore: TurnResult,
  step: number,
): { speech: string; recoverExact?: string; recoverWrong?: string } {
  const expected = pickExpected(turnBefore);

  switch (scenario) {
    case 1:
      return { speech: expected };
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

export async function runFoundationScenario(
  apiBase: string,
  lessonId: FoundationLessonId,
  scenario: number,
  runIndex: number,
): Promise<ScenarioRunResult> {
  const fixture = FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === lessonId);
  if (!fixture) {
    return {
      lessonId,
      scenario,
      ok: false,
      steps: 0,
      totalMs: 0,
      error: `no PoolGate fixture for ${lessonId}`,
    };
  }

  const def = getDef(fixture);
  const anonUser = `${lessonId}-s${scenario}-prod-${Date.now()}-${runIndex}`;
  const client = new LessonApiClient(apiBase, anonUser, true);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${lessonId} — ${SCENARIO_TITLES[scenario]}`);
  console.log(`API: ${apiBase} · Learner: ${LEARNER}`);
  console.log('='.repeat(80));

  try {
    await client.request('PUT', '/users/me', { displayName: LEARNER });
    await client.refillBananas();

    const start = await client.startLesson(lessonId);
    const engineVersion = (start.json.session as Json)?.engineVersion;
    if (engineVersion !== 2) {
      throw new Error(`expected engineVersion 2, got ${String(engineVersion)}`);
    }

    let turnBefore = start.turn;
    let aiPrompt = start.turn.aiResponse ?? '';
    let currentTurn = start.turn.currentTurn;
    let totalMs = 0;
    let reportStep = 0;
    let lessonStep = 1;
    const history: HistoryTurn[] = [
      {
        speaker: 'ai',
        textEn: aiPrompt,
        expectedSpeech: start.turn.expectedSpeech,
      },
    ];

    while (reportStep < MAX_TURNS) {
      const { speech, recoverExact, recoverWrong } = pickUserSpeech(
        lessonId,
        scenario,
        turnBefore,
        lessonStep,
      );
      const { hint, choices } = chromeBeforeAnswer(
        def,
        lessonId,
        turnBefore,
        history,
      );

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

      printStepBlock(
        reportStep,
        aiPrompt,
        hint,
        choices,
        speech,
        result,
        res.durationMs,
        reply,
      );

      history.push({ speaker: 'user', textEn: speech });
      history.push({
        speaker: 'ai',
        textEn: reply,
        expectedSpeech: res.turn.expectedSpeech,
      });

      currentTurn = res.turn.currentTurn;
      turnBefore = res.turn;

      if (res.turn.isTaskComplete) {
        console.log(`\n${'─'.repeat(72)}`);
        console.log(
          `✅ ${lessonId} scenario ${scenario} complete · ${reportStep} turns · ${formatMs(totalMs)}`,
        );
        return { lessonId, scenario, ok: true, steps: reportStep, totalMs };
      }

      if (recoverExact && result === 'incorrect out pool') {
        const { hint: recHint, choices: recChoices } = chromeBeforeAnswer(
          def,
          lessonId,
          turnBefore,
          history,
        );
        reportStep++;
        const recovery = await client.sendUserSpeech(
          start.sessionId,
          currentTurn,
          recoverExact,
        );
        totalMs += recovery.durationMs;
        const recBlock = turnBlock(recovery.json);
        const recReply = (recBlock.aiResponse as string | undefined) ?? '';
        const recResult = classifyResult(recBlock);

        printStepBlock(
          reportStep,
          reply,
          recHint,
          recChoices,
          recoverExact,
          recResult,
          recovery.durationMs,
          recReply,
        );

        history.push({ speaker: 'user', textEn: recoverExact });
        history.push({
          speaker: 'ai',
          textEn: recReply,
          expectedSpeech: recovery.turn.expectedSpeech,
        });

        currentTurn = recovery.turn.currentTurn;
        turnBefore = recovery.turn;
        aiPrompt = recReply;

        if (recovery.turn.isTaskComplete) {
          console.log(`\n${'─'.repeat(72)}`);
          console.log(
            `✅ ${lessonId} scenario ${scenario} complete · ${reportStep} turns · ${formatMs(totalMs)}`,
          );
          return { lessonId, scenario, ok: true, steps: reportStep, totalMs };
        }
      } else if (recoverWrong && result === 'incorrect out pool') {
        const { hint: recHint, choices: recChoices } = chromeBeforeAnswer(
          def,
          lessonId,
          turnBefore,
          history,
        );
        reportStep++;
        const secondWrong = await client.sendUserSpeech(
          start.sessionId,
          currentTurn,
          recoverWrong,
        );
        totalMs += secondWrong.durationMs;
        const softBlock = turnBlock(secondWrong.json);
        const softReply = (softBlock.aiResponse as string | undefined) ?? '';
        const softResult = classifyResult(softBlock);

        printStepBlock(
          reportStep,
          reply,
          recHint,
          recChoices,
          recoverWrong,
          softResult,
          secondWrong.durationMs,
          softReply,
        );

        history.push({ speaker: 'user', textEn: recoverWrong });
        history.push({
          speaker: 'ai',
          textEn: softReply,
          expectedSpeech: secondWrong.turn.expectedSpeech,
        });

        currentTurn = secondWrong.turn.currentTurn;
        turnBefore = secondWrong.turn;
        aiPrompt = softReply;

        if (secondWrong.turn.isTaskComplete) {
          console.log(`\n${'─'.repeat(72)}`);
          console.log(
            `✅ ${lessonId} scenario ${scenario} complete · ${reportStep} turns · ${formatMs(totalMs)}`,
          );
          return { lessonId, scenario, ok: true, steps: reportStep, totalMs };
        }
      } else {
        aiPrompt = reply;
      }

      lessonStep++;
    }

    throw new Error(`did not complete within ${MAX_TURNS} turns`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ ${lessonId} scenario ${scenario} failed: ${error}`);
    return { lessonId, scenario, ok: false, steps: 0, totalMs: 0, error };
  }
}

export function parseFoundationScenarioArgs(argv: string[]): {
  lessonIds: ScenarioLessonId[];
  scenarios: number[];
} {
  let lessonIds: ScenarioLessonId[] = [...ALL_SCENARIO_LESSON_IDS];
  let scenarios = [1, 2, 3, 4, 5];

  const arg1 = argv[2];
  const arg2 = argv[3];

  if (arg1) {
    if (/^\d+$/.test(arg1)) {
      const n = Number(arg1);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new Error('scenario must be 1–5');
      }
      scenarios = [n];
    } else if ((ALL_SCENARIO_LESSON_IDS as readonly string[]).includes(arg1)) {
      lessonIds = [arg1 as ScenarioLessonId];
      if (arg2) {
        const n = Number(arg2);
        if (!Number.isInteger(n) || n < 1 || n > 5) {
          throw new Error('scenario must be 1–5');
        }
        scenarios = [n];
      }
    } else {
      throw new Error(`unknown lesson: ${arg1}`);
    }
  }

  return { lessonIds, scenarios };
}
