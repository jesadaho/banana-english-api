/**
 * Unhappy-path smoke for Daily Routine on a live API (Railway / local).
 *
 * Usage:
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/daily-routine-api-unhappy-smoke.ts
 */

import {
  DailyRoutineApiClient,
  type TurnResult,
} from './lib/daily-routine-api-client';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
);
const ANON_PREFIX = process.env.ANON_PREFIX ?? 'daily-routine-unhappy';

type ScenarioResult = { name: string; ok: boolean; detail?: string };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runWrongVocabThenFix(
  client: DailyRoutineApiClient,
): Promise<void> {
  const { sessionId, turn: opening } = await client.startLesson();
  client.logTurn('opening', opening);
  let currentTurn = opening.currentTurn;

  let res = await client.sendUserSpeech(sessionId, currentTurn, "I'm ready");
  client.logTurn('after ready', res.turn);
  currentTurn = res.turn.currentTurn;

  console.log('\n>>> USER wrong vocab: go to work');
  res = await client.sendUserSpeech(sessionId, currentTurn, 'go to work');
  client.logTurn('after wrong vocab', res.turn);
  assert(
    (res.turn.progressTurn ?? 0) <= 2,
    `progress should not jump past vocab beat, got ${res.turn.progressTurn}`,
  );
  currentTurn = res.turn.currentTurn;

  console.log('\n>>> USER fix: wake up');
  res = await client.sendUserSpeech(sessionId, currentTurn, 'wake up');
  client.logTurn('after fix vocab', res.turn);
  assert(
    (res.turn.progressTurn ?? 0) >= 3,
    `after correct vocab progress should reach wake-time beat (>=3), got ${res.turn.progressTurn}`,
  );
  assert(
    res.turn.guidedStem === 'I wake up at...' ||
      (res.turn.expectedSpeech ?? '').includes('wake up'),
    `expected wake-time step, stem=${res.turn.guidedStem}`,
  );
}

async function runDoubleWrongSoftAdvance(
  client: DailyRoutineApiClient,
): Promise<void> {
  const { sessionId, turn: opening } = await client.startLesson();
  let currentTurn = opening.currentTurn;

  let res = await client.sendUserSpeech(sessionId, currentTurn, "I'm ready");
  currentTurn = res.turn.currentTurn;

  console.log('\n>>> USER wrong #1: go to work');
  res = await client.sendUserSpeech(sessionId, currentTurn, 'go to work');
  client.logTurn('wrong #1', res.turn);
  currentTurn = res.turn.currentTurn;

  console.log('\n>>> USER wrong #2: go to sleep');
  res = await client.sendUserSpeech(sessionId, currentTurn, 'go to sleep');
  client.logTurn('wrong #2 (soft-advance expected)', res.turn);
  assert(
    (res.turn.progressTurn ?? 0) >= 3,
    `after double wrong, progress should soft-advance to wake-time beat (>=3), got ${res.turn.progressTurn}`,
  );
  assert(
    res.turn.guidedStem === 'I wake up at...' ||
      (res.turn.aiResponse ?? '').toLowerCase().includes('wake up') ||
      (res.turn.expectedSpeech ?? '').toLowerCase().includes('wake up'),
    'after soft-advance should land on wake-time step',
  );
}

async function runStandaloneAmRejected(
  client: DailyRoutineApiClient,
): Promise<void> {
  const lines = [
    "I'm ready",
    'wake up',
    "I wake up at 7 o'clock.",
    "I go to sleep at 11 o'clock.",
  ];
  const { sessionId, turn: opening } = await client.startLesson();
  let currentTurn = opening.currentTurn;

  for (const line of lines) {
    const res = await client.sendUserSpeech(sessionId, currentTurn, line);
    currentTurn = res.turn.currentTurn;
  }

  console.log('\n>>> USER wrong AM/PM: standalone "AM"');
  const wrong = await client.sendUserSpeech(sessionId, currentTurn, 'AM');
  client.logTurn('standalone AM (should not finish AM/PM step)', wrong.turn);
  assert(
    (wrong.turn.progressTurn ?? 0) <= 5,
    `standalone AM must not complete AM/PM beat, progress=${wrong.turn.progressTurn}`,
  );
  assert(wrong.turn.isTaskComplete !== true, 'lesson must not complete on "AM"');

  console.log('\n>>> USER fix: I wake up at 7 AM.');
  const fix = await client.sendUserSpeech(
    sessionId,
    wrong.turn.currentTurn,
    'I wake up at 7 AM.',
  );
  client.logTurn('fixed AM/PM sentence', fix.turn);
  assert(
    (fix.turn.progressTurn ?? 0) >= 6,
    `after proper AM/PM sentence progress should advance, got ${fix.turn.progressTurn}`,
  );
}

async function runStaleTurn409(client: DailyRoutineApiClient): Promise<void> {
  const { sessionId, turn: opening } = await client.startLesson();
  const res = await client.sendUserSpeech(
    sessionId,
    opening.currentTurn + 99,
    "I'm ready",
    false,
  );
  assert(res.status === 409, `expected 409 stale turn, got ${res.status}`);
  const detail =
    (typeof res.json.message === 'string' ? res.json.message : '') ||
    (typeof res.json.detail === 'string' ? res.json.detail : '');
  assert(
    detail.toLowerCase().includes('stale turn'),
    `expected stale turn message, got: ${detail}`,
  );
  console.log('\n── stale turn ──');
  console.log(`  status: 409`);
  console.log(`  detail: ${detail}`);
}

async function runScenario(
  name: string,
  anonUser: string,
  fn: (client: DailyRoutineApiClient) => Promise<void>,
): Promise<ScenarioResult> {
  const client = new DailyRoutineApiClient(API_BASE, anonUser);
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

  const results = await Promise.all([
    runScenario('wrong vocab → fix', `${ANON_PREFIX}-vocab`, runWrongVocabThenFix),
    runScenario(
      'double wrong → soft-advance',
      `${ANON_PREFIX}-soft`,
      runDoubleWrongSoftAdvance,
    ),
    runScenario(
      'standalone AM rejected',
      `${ANON_PREFIX}-ampm`,
      runStandaloneAmRejected,
    ),
    runScenario('stale turn → 409', `${ANON_PREFIX}-stale`, runStaleTurn409),
  ]);

  console.log(`\n${'='.repeat(60)}\nSUMMARY`);
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }

  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ Unhappy smoke crashed:', err);
  process.exitCode = 1;
});
