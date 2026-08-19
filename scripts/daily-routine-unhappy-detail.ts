/**
 * Pretty-print unhappy-path Q&A against live API.
 * API_BASE=https://banana-english-api-production.up.railway.app \
 *   npx tsx scripts/daily-routine-unhappy-detail.ts
 */
import { DailyRoutineApiClient, type TurnResult } from './lib/daily-routine-api-client';

const API = (process.env.API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');

function printExchange(
  label: string,
  user: string | null,
  turn: TurnResult,
  json: Record<string, unknown>,
) {
  console.log('\n' + '─'.repeat(70));
  console.log(label);
  if (user) console.log(`👤 USER: ${user}`);
  console.log(`🍌 AI:   ${turn.aiResponse ?? '(empty)'}`);
  const dbg = json.aiDebug as Record<string, unknown> | undefined;
  if (dbg) console.log(`   aiDebug: ${JSON.stringify(dbg)}`);
  console.log(
    `   progress: ${turn.progressTurn ?? '?'}/${turn.progressMax ?? '?'} | turn: ${turn.currentTurn}`,
  );
  console.log(`   expectedSpeech: ${turn.expectedSpeech ?? '(none)'}`);
  console.log(`   guidedSpeaking.stem: ${turn.guidedStem ?? '(none)'}`);
}

async function scenarioWrongVocabThenFix() {
  console.log('\n' + '='.repeat(70));
  console.log('SCENARIO 1: Wrong vocab → fix');
  console.log('='.repeat(70));
  const c = new DailyRoutineApiClient(API, `unhappy-detail-vocab-${Date.now()}`);
  await c.refillBananas();
  const start = await c.startLesson();
  printExchange('Opening', null, start.turn, start.json);

  let t = start.turn.currentTurn;
  let r = await c.sendUserSpeech(sessionIdFrom(start), t, "I'm ready");
  printExchange("Turn 1 — learner says I'm ready", "I'm ready", r.turn, r.json);
  t = r.turn.currentTurn;

  r = await c.sendUserSpeech(sessionIdFrom(start), t, 'go to work');
  printExchange('Turn 2 — wrong vocab', 'go to work', r.turn, r.json);
  t = r.turn.currentTurn;

  r = await c.sendUserSpeech(sessionIdFrom(start), t, 'wake up');
  printExchange('Turn 3 — fix with wake up', 'wake up', r.turn, r.json);
}

function sessionIdFrom(start: { sessionId: string }) {
  return start.sessionId;
}

async function scenarioDoubleWrongSoftAdvance() {
  console.log('\n' + '='.repeat(70));
  console.log('SCENARIO 2: Double wrong → soft-advance');
  console.log('='.repeat(70));
  const c = new DailyRoutineApiClient(API, `unhappy-detail-soft-${Date.now()}`);
  await c.refillBananas();
  const start = await c.startLesson();
  printExchange('Opening', null, start.turn, start.json);

  let t = start.turn.currentTurn;
  let r = await c.sendUserSpeech(start.sessionId, t, "I'm ready");
  printExchange("Turn 1 — I'm ready", "I'm ready", r.turn, r.json);
  t = r.turn.currentTurn;

  r = await c.sendUserSpeech(start.sessionId, t, 'go to work');
  printExchange('Turn 2 — wrong #1', 'go to work', r.turn, r.json);
  t = r.turn.currentTurn;

  r = await c.sendUserSpeech(start.sessionId, t, 'go to sleep');
  printExchange('Turn 3 — wrong #2 (expect soft-advance)', 'go to sleep', r.turn, r.json);
}

async function scenarioStandaloneAmRejected() {
  console.log('\n' + '='.repeat(70));
  console.log('SCENARIO 3: Standalone AM rejected → fix');
  console.log('='.repeat(70));
  const c = new DailyRoutineApiClient(API, `unhappy-detail-ampm-${Date.now()}`);
  await c.refillBananas();
  const start = await c.startLesson();
  let t = start.turn.currentTurn;

  const setup: Array<{ label: string; speech: string }> = [
    { label: "Turn 1 — I'm ready", speech: "I'm ready" },
    { label: 'Turn 2 — wake up', speech: 'wake up' },
    { label: "Turn 3 — wake time", speech: "I wake up at 7 o'clock." },
    { label: 'Turn 4 — sleep time', speech: "I go to sleep at 11 o'clock." },
  ];
  for (const step of setup) {
    const r = await c.sendUserSpeech(start.sessionId, t, step.speech);
    printExchange(step.label, step.speech, r.turn, r.json);
    t = r.turn.currentTurn;
  }

  let r = await c.sendUserSpeech(start.sessionId, t, 'AM');
  printExchange('Turn 5 — wrong: standalone AM only', 'AM', r.turn, r.json);
  t = r.turn.currentTurn;

  r = await c.sendUserSpeech(start.sessionId, t, 'I wake up at 7 AM.');
  printExchange('Turn 6 — fix full AM sentence', 'I wake up at 7 AM.', r.turn, r.json);
}

async function scenarioStaleTurn() {
  console.log('\n' + '='.repeat(70));
  console.log('SCENARIO 4: Stale turn → 409');
  console.log('='.repeat(70));
  const c = new DailyRoutineApiClient(API, `unhappy-detail-stale-${Date.now()}`);
  await c.refillBananas();
  const start = await c.startLesson();
  const r = await c.sendUserSpeech(
    start.sessionId,
    start.turn.currentTurn + 99,
    "I'm ready",
    false,
  );
  console.log("\n👤 USER: I'm ready  (sent with currentTurn=99, server expected 0)");
  console.log(`❌ HTTP ${r.status}: ${String(r.json.message ?? r.json.detail ?? '')}`);
}

async function main() {
  console.log(`PROD: ${API}`);
  await scenarioWrongVocabThenFix();
  await scenarioDoubleWrongSoftAdvance();
  await scenarioStandaloneAmRejected();
  await scenarioStaleTurn();
  console.log('\n' + '='.repeat(70));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
