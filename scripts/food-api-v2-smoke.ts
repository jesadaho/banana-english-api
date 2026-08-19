/**
 * Food & Drinks PoolGate v2 smoke against live API.
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/food-api-v2-smoke.ts
 */
import {
  LessonApiClient,
  type TurnResult,
  type Json,
} from './lib/lesson-api-client';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
);
const LESSON_ID = 'ee_about_me_food';

type ScenarioResult = { name: string; ok: boolean; detail?: string };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertMatch(value: string, pattern: RegExp, message: string): void {
  if (!pattern.test(value)) throw new Error(`${message}: got "${value}"`);
}

function aiDebug(json: Json): Record<string, unknown> | undefined {
  return json.aiDebug as Record<string, unknown> | undefined;
}

function engineVersion(json: Json): number | undefined {
  const session = json.session as Json | undefined;
  return session?.engineVersion as number | undefined;
}

function logTurn(label: string, user: string | null, turn: TurnResult, json: Json) {
  const dbg = aiDebug(json);
  console.log(`\n── ${label} ──`);
  if (user) console.log(`  USER: ${user}`);
  console.log(`  AI:   ${(turn.aiResponse ?? '').slice(0, 200)}`);
  console.log(
    `  progress: ${turn.progressTurn ?? '?'}/${turn.progressMax ?? '?'} | turn: ${turn.currentTurn}`,
  );
  console.log(`  expected: ${turn.expectedSpeech ?? '(none)'}`);
  console.log(`  stem:     ${turn.guidedStem ?? '(none)'}`);
  if (dbg) console.log(`  aiDebug:  ${JSON.stringify(dbg)}`);
}

async function runHappyPathPizza(client: LessonApiClient): Promise<void> {
  const lines = [
    'I like pizza.',
    'Pizza is delicious.',
    'I drink iced tea with pizza.',
    'Pizza is delicious.',
    'I drink iced tea with pizza.',
    'Somtam is spicy.',
  ];

  const start = await client.startLesson(LESSON_ID);
  assert(engineVersion(start.json) === 2, `expected engineVersion 2, got ${engineVersion(start.json)}`);
  logTurn('opening', null, start.turn, start.json);

  let currentTurn = start.turn.currentTurn;
  for (let i = 0; i < lines.length; i++) {
    const userSpeech = lines[i];
    const res = await client.sendUserSpeech(start.sessionId, currentTurn, userSpeech);
    logTurn(`step ${i + 1}`, userSpeech, res.turn, res.json);
    assert(
      aiDebug(res.json)?.source === 'scripted',
      `happy path step ${i + 1} should be scripted, got ${JSON.stringify(aiDebug(res.json))}`,
    );
    currentTurn = res.turn.currentTurn;
    if (res.turn.isTaskComplete) {
      console.log('\n  ✅ lesson complete on happy path');
      return;
    }
  }
  throw new Error('happy path did not complete lesson');
}

async function runBurgerMapsScripted(client: LessonApiClient): Promise<void> {
  const start = await client.startLesson(LESSON_ID);
  assert(engineVersion(start.json) === 2, 'expected engineVersion 2');
  let currentTurn = start.turn.currentTurn;

  const res = await client.sendUserSpeech(
    start.sessionId,
    currentTurn,
    'I like burger.',
  );
  logTurn('I like burger', 'I like burger.', res.turn, res.json);

  assert(
    aiDebug(res.json)?.source === 'scripted',
    `burger should advance scripted (food map), got ${JSON.stringify(aiDebug(res.json))}`,
  );
  assertMatch(
    res.turn.aiResponse ?? '',
    /Burger/i,
    'tutor should mention Burger on describe step',
  );
  assertMatch(
    res.turn.expectedSpeech ?? '',
    /Burger is delicious/i,
    'expected speech should be Burger describe board',
  );
}

async function runNoodlesMapsScripted(client: LessonApiClient): Promise<void> {
  const start = await client.startLesson(LESSON_ID);
  let currentTurn = start.turn.currentTurn;

  const res = await client.sendUserSpeech(
    start.sessionId,
    currentTurn,
    'I like noodles.',
  );
  logTurn('I like noodles', 'I like noodles.', res.turn, res.json);

  assert(
    aiDebug(res.json)?.source === 'scripted',
    `noodles should advance scripted, got ${JSON.stringify(aiDebug(res.json))}`,
  );
  assertMatch(res.turn.aiResponse ?? '', /Noodles/i, 'tutor should mention Noodles');
  assertMatch(
    res.turn.expectedSpeech ?? '',
    /Noodles is delicious/i,
    'expected Noodles describe board',
  );
}

async function runOffTopicGeminiAssess(client: LessonApiClient): Promise<void> {
  const start = await client.startLesson(LESSON_ID);
  let currentTurn = start.turn.currentTurn;

  const res = await client.sendUserSpeech(
    start.sessionId,
    currentTurn,
    'I work at an office.',
  );
  logTurn('off-topic', 'I work at an office.', res.turn, res.json);

  assert(
    aiDebug(res.json)?.source === 'gemini',
    `off-topic should defer to Gemini, got ${JSON.stringify(aiDebug(res.json))}`,
  );
  assert(
    (res.turn.currentTurn ?? 0) <= 2,
    'should stay on step 1 after first off-topic wrong',
  );
}

async function runDoubleWrongSoftAdvance(client: LessonApiClient): Promise<void> {
  const start = await client.startLesson(LESSON_ID);
  let currentTurn = start.turn.currentTurn;

  let res = await client.sendUserSpeech(
    start.sessionId,
    currentTurn,
    'I work at an office.',
  );
  logTurn('wrong #1 off-topic', 'I work at an office.', res.turn, res.json);
  assert(aiDebug(res.json)?.source === 'gemini', 'wrong #1 should be gemini');
  currentTurn = res.turn.currentTurn;

  res = await client.sendUserSpeech(start.sessionId, currentTurn, 'Good morning.');
  logTurn('wrong #2 off-topic', 'Good morning.', res.turn, res.json);

  assert(
    aiDebug(res.json)?.source === 'scripted',
    `2nd wrong should soft-advance scripted, got ${JSON.stringify(aiDebug(res.json))}`,
  );
  assertMatch(
    res.turn.expectedSpeech ?? '',
    /Pizza is delicious/i,
    'after soft-advance should land on describe-food step',
  );
}

async function runScenario(
  name: string,
  anonUser: string,
  fn: (client: LessonApiClient) => Promise<void>,
): Promise<ScenarioResult> {
  const client = new LessonApiClient(API_BASE, anonUser);
  try {
    await client.refillBananas();
    console.log(`\n${'='.repeat(60)}\nSCENARIO: ${name}\nANON_USER: ${anonUser}`);
    await fn(client);
    console.log(`\n✅ ${name}`);
    return { name, ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ ${name}: ${detail}`);
    return { name, ok: false, detail };
  }
}

async function main(): Promise<void> {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`LESSON_ID=${LESSON_ID}`);

  const ts = Date.now();
  const results: ScenarioResult[] = [];
  for (const [i, [name, fn]] of [
    ['happy path pizza (scripted)', runHappyPathPizza],
    ['I like burger → Burger board (scripted)', runBurgerMapsScripted],
    ['I like noodles → Noodles board (scripted)', runNoodlesMapsScripted],
    ['off-topic → Gemini assess', runOffTopicGeminiAssess],
    ['double wrong off-topic → soft-advance', runDoubleWrongSoftAdvance],
  ].entries()) {
    results.push(
      await runScenario(name, `food-v2-${ts}-${i}`, fn as (c: LessonApiClient) => Promise<void>),
    );
  }

  console.log(`\n${'='.repeat(60)}\nSUMMARY`);
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }

  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ Food v2 smoke crashed:', err);
  process.exitCode = 1;
});
