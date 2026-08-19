/**
 * Pretty-print unhappy incorrect → 2nd wrong → soft-advance on prod.
 * API_BASE=... npx tsx scripts/pool-gate-incorrect-2nd-detail.ts
 */
import { LessonApiClient } from './lib/lesson-api-client';

const API = (process.env.API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');

function printTurn(label: string, user: string | null, json: Record<string, unknown>) {
  console.log(`\n=== ${label} ===`);
  if (user) console.log('USER:', user);
  console.log('AI:', json.aiResponse);
  console.log('textTh:', json.textTh ?? '');
  console.log('currentTurn:', json.currentTurn);
  console.log('expectedSpeech:', json.expectedSpeech ?? '(none)');
  console.log('guidedStem:', (json.guidedSpeaking as Record<string, unknown> | undefined)?.stem ?? '(none)');
  console.log('expectsUserSpeech:', json.expectsUserSpeech);
  console.log('isTaskComplete:', json.isTaskComplete);
  console.log('aiDebug:', JSON.stringify(json.aiDebug, null, 2));
}

async function main() {
  const client = new LessonApiClient(API, `incorrect-2nd-${Date.now()}`);
  await client.refillBananas();

  const start = await client.startLesson('ee_about_me_food');
  printTurn('OPENING', null, start.json as Record<string, unknown>);

  let turn = start.turn.currentTurn;

  let res = await client.sendUserSpeech(
    start.sessionId,
    turn,
    'I work at an office.',
  );
  printTurn('WRONG #1 (incorrect → พูดตาม)', 'I work at an office.', res.json as Record<string, unknown>);
  turn = res.turn.currentTurn;

  res = await client.sendUserSpeech(
    start.sessionId,
    turn,
    'Good morning.',
  );
  printTurn('WRONG #2 (expect soft-advance)', 'Good morning.', res.json as Record<string, unknown>);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
