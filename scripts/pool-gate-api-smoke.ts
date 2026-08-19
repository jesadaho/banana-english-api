/**
 * PoolGate v2 — 4-lane prod smoke matrix.
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/pool-gate-api-smoke.ts
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

type ScenarioResult = { lane: string; ok: boolean; detail?: string };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertMatch(value: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(value)) {
    throw new Error(message ?? `expected ${pattern}, got "${value}"`);
  }
}

function aiDebug(json: Json): Record<string, unknown> | undefined {
  return json.aiDebug as Record<string, unknown> | undefined;
}

function logTurn(label: string, user: string | null, turn: TurnResult, json: Json) {
  const dbg = aiDebug(json);
  console.log(`\n── ${label} ──`);
  if (user) console.log(`  USER: ${user}`);
  console.log(`  AI:   ${(turn.aiResponse ?? '').slice(0, 220)}`);
  console.log(`  turn: ${turn.currentTurn} | expected: ${turn.expectedSpeech ?? '(none)'}`);
  console.log(`  stem: ${turn.guidedStem ?? '(none)'}`);
  if (dbg) console.log(`  aiDebug: ${JSON.stringify(dbg)}`);
}

function asksRepeat(text: string): boolean {
  return /พูดตาม|ลองพูดตาม|repeat/i.test(text);
}

async function startFood(client: LessonApiClient) {
  return client.startLesson('ee_about_me_food');
}

async function startDailyRoutine(client: LessonApiClient) {
  return client.startLesson('ee_about_me_daily_routine');
}

/** Lane 1 — exact pool match → scripted, no Gemini. */
async function laneHappyInPool(client: LessonApiClient): Promise<void> {
  const start = await startFood(client);
  assert(
    (start.json.session as Json)?.engineVersion === 2,
    'expected engineVersion 2',
  );
  logTurn('opening', null, start.turn, start.json);

  const res = await client.sendUserSpeech(
    start.sessionId,
    start.turn.currentTurn,
    'I like pizza.',
  );
  logTurn('happy in-pool', 'I like pizza.', res.turn, res.json);

  assert(aiDebug(res.json)?.source === 'scripted', 'should be scripted');
  assert(!asksRepeat(res.turn.aiResponse ?? ''), 'should not ask repeat');
  assertMatch(res.turn.aiResponse ?? '', /Pizza/i);
  assertMatch(res.turn.expectedSpeech ?? '', /Pizza is delicious/i);
}

/** Lane 2 — not exact pool, but answers question → Gemini correct → advance. */
async function laneHappyOutOfPool(client: LessonApiClient): Promise<void> {
  const start = await startDailyRoutine(client);
  let turn = start.turn.currentTurn;

  let res = await client.sendUserSpeech(start.sessionId, turn, "I'm ready");
  turn = res.turn.currentTurn;
  res = await client.sendUserSpeech(start.sessionId, turn, 'wake up');
  turn = res.turn.currentTurn;

  console.log('\n>>> out-of-pool valid wake-time wording: I get up at 7 o\'clock.');
  res = await client.sendUserSpeech(
    start.sessionId,
    turn,
    "I get up at 7 o'clock.",
  );
  logTurn('happy out-of-pool', "I get up at 7 o'clock.", res.turn, res.json);

  assert(aiDebug(res.json)?.source === 'gemini', 'should call Gemini assess');
  assert(!asksRepeat(res.turn.aiResponse ?? ''), 'correct tier must not ask repeat');
  assertMatch(
    res.turn.expectedSpeech ?? res.turn.aiResponse ?? '',
    /go to sleep|sleep/i,
    'should advance to sleep-time step',
  );
}

/** Lane 3 — almost right → Gemini close → gentle tweak + advance (no block). */
async function laneUnhappyClose(client: LessonApiClient): Promise<void> {
  const start = await startDailyRoutine(client);
  let turn = start.turn.currentTurn;

  let res = await client.sendUserSpeech(start.sessionId, turn, "I'm ready");
  turn = res.turn.currentTurn;
  const stemBefore = res.turn.guidedStem ?? '';

  console.log('\n>>> near miss vocab: get up');
  res = await client.sendUserSpeech(start.sessionId, turn, 'get up');
  logTurn('unhappy close', 'get up', res.turn, res.json);

  assert(aiDebug(res.json)?.source === 'gemini', 'should call Gemini assess');
  assert(!asksRepeat(res.turn.aiResponse ?? ''), 'close tier must not ask repeat');
  assertMatch(
    res.turn.expectedSpeech ?? res.turn.aiResponse ?? '',
    /wake up at|I wake up at/i,
    'should advance past vocab to wake-time step',
  );
  assert(
    (res.turn.guidedStem ?? '') !== stemBefore || turn !== res.turn.currentTurn,
    'should progress beyond vocab board',
  );
}

/** Lane 4 — wrong / off-topic → Gemini incorrect → stay + พูดตาม. */
async function laneUnhappyIncorrect(client: LessonApiClient): Promise<void> {
  const start = await startFood(client);
  const turn = start.turn.currentTurn;

  console.log('\n>>> off-topic: I work at an office.');
  const res = await client.sendUserSpeech(
    start.sessionId,
    turn,
    'I work at an office.',
  );
  logTurn('unhappy incorrect', 'I work at an office.', res.turn, res.json);

  assert(aiDebug(res.json)?.source === 'gemini', 'should call Gemini assess');
  assert(asksRepeat(res.turn.aiResponse ?? ''), 'incorrect tier should ask repeat');
  assertMatch(res.turn.expectedSpeech ?? '', /I like/i, 'should stay on food choice step');
  assert(res.turn.currentTurn === turn + 1, 'turn increments but step stays');
}

async function runLane(
  lane: string,
  anonUser: string,
  fn: (client: LessonApiClient) => Promise<void>,
): Promise<ScenarioResult> {
  const client = new LessonApiClient(API_BASE, anonUser);
  try {
    await client.refillBananas();
    console.log(`\n${'='.repeat(64)}\nLANE: ${lane}\nUSER: ${anonUser}`);
    await fn(client);
    console.log(`\n✅ ${lane}`);
    return { lane, ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ ${lane}: ${detail}`);
    return { lane, ok: false, detail };
  }
}

async function main(): Promise<void> {
  console.log(`API_BASE=${API_BASE}`);
  console.log('PoolGate 4-lane matrix: in-pool | out-pool | close | incorrect');

  const ts = Date.now();
  const lanes: Array<[string, (c: LessonApiClient) => Promise<void>]> = [
    ['1 happy in-pool (Food · pizza)', laneHappyInPool],
    ['2 happy out-of-pool (DR · get up at 7)', laneHappyOutOfPool],
    ['3 unhappy close (DR · get up)', laneUnhappyClose],
    ['4 unhappy incorrect (Food · off-topic)', laneUnhappyIncorrect],
  ];

  const results: ScenarioResult[] = [];
  for (let i = 0; i < lanes.length; i++) {
    const [name, fn] = lanes[i];
    results.push(await runLane(name, `pool-gate-${ts}-${i}`, fn));
  }

  console.log(`\n${'='.repeat(64)}\nSUMMARY`);
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.lane}${r.detail ? ` — ${r.detail}` : ''}`);
  }

  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ PoolGate smoke crashed:', err);
  process.exitCode = 1;
});
