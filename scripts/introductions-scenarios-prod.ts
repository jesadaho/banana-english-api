/**
 * Introductions — all 4 PoolGate scenarios against prod (step-by-step report).
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/introductions-scenarios-prod.ts
 *
 *   npx tsx scripts/introductions-scenarios-prod.ts 2   # single scenario
 */
import {
  LessonApiClient,
  type Json,
  type TurnResult,
} from './lib/lesson-api-client';
import { boardToScriptTurn } from '../src/training/scripts/choice-lesson.script.ts';
import { extractIntroducedName } from '../src/training/foundation/foundation.helpers.ts';
import { FOUNDATION_POOLGATE_FIXTURES } from '../src/training/foundation/foundation-poolgate.fixtures.ts';
import {
  getDef,
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolWrong,
} from '../src/training/foundation/foundation-poolgate.harness.ts';

const def = getDef(
  FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === 'introductions')!,
);

const API_BASE = (
  process.env.API_BASE ?? 'https://banana-english-api-production.up.railway.app'
).replace(/\/$/, '');

const LEARNER = 'Nana';
const MAX_TURNS = 24;
const LESSON_ID = 'introductions';

const SCENARIO_TITLES: Record<number, string> = {
  1: 'Scenario 1 — in-pool correct ทุก step → จบบท',
  2: 'Scenario 2 — out-pool correct ทุก step → จบบท',
  3: 'Scenario 3 — out-pool close ทุก step → จบบท',
  4: 'Scenario 4 — out-pool wrong ทุก step → จบบท',
};

const scenarioArg = process.argv[2];
const scenariosToRun: number[] = scenarioArg
  ? [Number(scenarioArg)]
  : [1, 2, 3, 4];

if (scenariosToRun.some((n) => !Number.isInteger(n) || n < 1 || n > 4)) {
  console.error('Usage: npx tsx scripts/introductions-scenarios-prod.ts [1-4]');
  process.exit(1);
}

function outOfPoolNearMiss(exact: string): string {
  return introductionsOutOfPoolNearMiss(exact);
}

function outOfPoolWrong(_exact: string): string {
  return introductionsOutOfPoolWrong(_exact);
}

function pickExpected(turn: TurnResult): string {
  const expected = turn.expectedSpeech?.trim();
  if (expected) return expected;
  const guided = turn.guidedSpeaking;
  if (guided?.speak?.trim()) return guided.speak.trim();
  const option = guided?.options?.find((o) => o.speak?.trim());
  if (option?.speak?.trim()) return option.speak.trim();
  throw new Error('missing expected speech on turn');
}

type HistoryTurn = {
  speaker: 'ai' | 'user';
  textEn: string;
  expectedSpeech?: string | null;
};

function chromeBeforeAnswer(turnBefore: TurnResult, history: HistoryTurn[]) {
  const gs = turnBefore.guidedSpeaking;
  if (gs?.options?.length) {
    const hint = gs.stem?.trim() || '(none)';
    const lines = gs.options.map(
      (o) => `${o.emoji ?? '·'} ${o.label ?? o.speak} → "${o.speak}"`,
    );
    const body = lines.length === 1 ? lines[0] : lines.join('\n         ');
    return { hint, choices: body };
  }

  const step = (turnBefore.progressTurn ?? 0) + 1;
  const name = extractIntroducedName(history, LEARNER);
  const boardHistory =
    extractIntroducedName(history) === name
      ? history
      : [...history, { speaker: 'user' as const, textEn: `My name is ${name}.` }];
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

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function classifyResult(json: Json): string {
  const dbg = json.aiDebug as Json | undefined;
  const tier = json.assessmentTier as string | undefined;
  if (dbg?.source === 'scripted') {
    if (tier === 'incorrect' && /คำตอบนี้เราพูดว่า/.test(String(json.aiResponse ?? ''))) {
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
  scenario: number,
  turnBefore: TurnResult,
): { speech: string; recoverExact?: string } {
  const expected = pickExpected(turnBefore);

  switch (scenario) {
    case 1:
      return { speech: expected };
    case 2:
      return { speech: outOfPoolNearMiss(expected) };
    case 3:
      return { speech: outOfPoolNearMiss(expected) };
    case 4:
      return { speech: outOfPoolWrong(expected), recoverExact: expected };
    default:
      return { speech: expected };
  }
}

type ScenarioRunResult = {
  scenario: number;
  ok: boolean;
  steps: number;
  totalMs: number;
  error?: string;
};

async function runScenario(
  scenario: number,
  runIndex: number,
): Promise<ScenarioRunResult> {
  const anonUser = `intro-s${scenario}-prod-${Date.now()}-${runIndex}`;
  const client = new LessonApiClient(API_BASE, anonUser, true);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Introductions — ${SCENARIO_TITLES[scenario]}`);
  console.log(`API: ${API_BASE} · Learner: ${LEARNER}`);
  console.log('='.repeat(80));

  try {
    await client.request('PUT', '/users/me', { displayName: LEARNER });
    await client.refillBananas();

    const start = await client.startLesson(LESSON_ID);
    const engineVersion = (start.json.session as Json)?.engineVersion;
    if (engineVersion !== 2) {
      throw new Error(`expected engineVersion 2, got ${String(engineVersion)}`);
    }

    let turnBefore = start.turn;
    let aiPrompt = start.turn.aiResponse ?? '';
    let currentTurn = start.turn.currentTurn;
    let totalMs = 0;
    let step = 1;
    const history: HistoryTurn[] = [
      {
        speaker: 'ai',
        textEn: aiPrompt,
        expectedSpeech: start.turn.expectedSpeech,
      },
    ];

    for (let guard = 0; guard < MAX_TURNS; guard++) {
      const { speech, recoverExact } = pickUserSpeech(scenario, turnBefore);
      const { hint, choices } = chromeBeforeAnswer(turnBefore, history);

      const res = await client.sendUserSpeech(
        start.sessionId,
        currentTurn,
        speech,
      );
      totalMs += res.durationMs;

      const block = turnBlock(res.json);
      const reply = (block.aiResponse as string | undefined) ?? '';
      const result = classifyResult(block);

      printStepBlock(step, aiPrompt, hint, choices, speech, result, res.durationMs, reply);

      history.push({ speaker: 'user', textEn: speech });
      history.push({
        speaker: 'ai',
        textEn: reply,
        expectedSpeech: res.turn.expectedSpeech,
      });

      currentTurn = res.turn.currentTurn;
      turnBefore = res.turn;
      step++;

      if (res.turn.isTaskComplete) {
        console.log(`\n${'─'.repeat(72)}`);
        console.log(
          `✅ Scenario ${scenario} complete · ${step - 1} steps · ${formatMs(totalMs)}`,
        );
        return { scenario, ok: true, steps: step - 1, totalMs };
      }

      if (recoverExact) {
        const recovery = await client.sendUserSpeech(
          start.sessionId,
          currentTurn,
          recoverExact,
        );
        totalMs += recovery.durationMs;
        history.push({ speaker: 'user', textEn: recoverExact });
        history.push({
          speaker: 'ai',
          textEn: recovery.turn.aiResponse ?? '',
          expectedSpeech: recovery.turn.expectedSpeech,
        });
        currentTurn = recovery.turn.currentTurn;
        turnBefore = recovery.turn;
        aiPrompt = recovery.turn.aiResponse ?? '';

        if (recovery.turn.isTaskComplete) {
          console.log(`\n${'─'.repeat(72)}`);
          console.log(
            `✅ Scenario ${scenario} complete · ${step - 1} steps · ${formatMs(totalMs)}`,
          );
          return { scenario, ok: true, steps: step - 1, totalMs };
        }
        continue;
      }

      aiPrompt = reply;
    }

    throw new Error(`did not complete within ${MAX_TURNS} turns`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Scenario ${scenario} failed: ${error}`);
    return { scenario, ok: false, steps: 0, totalMs: 0, error };
  }
}

async function main(): Promise<void> {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`Running scenarios: ${scenariosToRun.join(', ')}`);

  const results: ScenarioRunResult[] = [];
  for (let i = 0; i < scenariosToRun.length; i++) {
    results.push(await runScenario(scenariosToRun[i], i));
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  for (const r of results) {
    const line = r.ok
      ? `✅ Scenario ${r.scenario} — ${r.steps} steps · ${formatMs(r.totalMs)}`
      : `❌ Scenario ${r.scenario} — ${r.error}`;
    console.log(line);
  }

  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
