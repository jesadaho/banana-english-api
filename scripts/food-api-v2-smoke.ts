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
  console.log(`  AI:   ${(turn.aiResponse ?? '').slice(0, 160)}`);
  console.log(
    `  progress: ${turn.progressTurn ?? '?'}/${turn.progressMax ?? '?'} | turn: ${turn.currentTurn}`,
  );
  console.log(`  expected: ${turn.expectedSpeech ?? '(none)'}`);
  console.log(`  stem:     ${turn.guidedStem ?? '(none)'}`);
  if (dbg) console.log(`  aiDebug:  ${JSON.stringify(dbg)}`);
}

async function runHappyPath(client: LessonApiClient): Promise<void> {
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

async function runOutOfPoolAssess(client: LessonApiClient): Promise<void> {
  const start = await client.startLesson(LESSON_ID);
  assert(engineVersion(start.json) === 2, 'expected engineVersion 2');
  let currentTurn = start.turn.currentTurn;

  console.log('\n>>> USER out-of-pool: I like burger.');
  const wrong = await client.sendUserSpeech(
    start.sessionId,
    currentTurn,
    'I like burger.',
  );
  logTurn('out-of-pool wrong', 'I like burger.', wrong.turn, wrong.json);

  const dbg = aiDebug(wrong.json);
  assert(
    dbg?.source === 'gemini' || dbg?.source === 'scripted',
    `expected gemini assess or scripted soft-advance, got ${JSON.stringify(dbg)}`,
  );
  assert(
    (wrong.turn.progressTurn ?? 0) <= 2,
    `progress should not jump past step 1 on first wrong, got ${wrong.turn.progressTurn}`,
  );

  if (dbg?.source === 'gemini') {
    console.log('  ✅ out-of-pool triggered Gemini assess');
    assert(
      dbg.assessmentTier != null || (wrong.turn.aiResponse ?? '').length > 0,
      'expected assessmentTier or AI reply text',
    );
  }
}

async function runDoubleWrongSoftAdvance(client: LessonApiClient): Promise<void> {
  const start = await client.startLesson(LESSON_ID);
  let currentTurn = start.turn.currentTurn;

  let res = await client.sendUserSpeech(
    start.sessionId,
    currentTurn,
    'I like noodles.',
  );
  logTurn('wrong #1', 'I like noodles.', res.turn, res.json);
  currentTurn = res.turn.currentTurn;

  res = await client.sendUserSpeech(
    start.sessionId,
    currentTurn,
    'I like ramen.',
  );
  logTurn('wrong #2 (soft-advance)', 'I like ramen.', res.turn, res.json);

  assert(
    aiDebug(res.json)?.source === 'scripted',
    `2nd wrong should soft-advance scripted, got ${JSON.stringify(aiDebug(res.json))}`,
  );
  assert(
    (res.turn.progressTurn ?? 0) >= 2,
    `after double wrong progress should advance (>=2), got ${res.turn.progressTurn}`,
  );
  assert(
    (res.turn.guidedStem ?? '').includes('Pizza is') ||
      (res.turn.expectedSpeech ?? '').includes('Pizza is'),
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
  const results = await Promise.all([
    runScenario('happy path (all in-pool scripted)', `food-v2-happy-${ts}`, runHappyPath),
    runScenario('out-of-pool → Gemini assess', `food-v2-assess-${ts}`, runOutOfPoolAssess),
    runScenario(
      'double wrong → soft-advance',
      `food-v2-soft-${ts}`,
      runDoubleWrongSoftAdvance,
    ),
  ]);

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
