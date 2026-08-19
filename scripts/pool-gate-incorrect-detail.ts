/**
 * Pretty-print unhappy incorrect lane against live API.
 * API_BASE=... npx tsx scripts/pool-gate-incorrect-detail.ts
 */
import { LessonApiClient } from './lib/lesson-api-client';

const API = (process.env.API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');

async function main() {
  const client = new LessonApiClient(API, `incorrect-detail-${Date.now()}`);
  await client.refillBananas();

  const start = await client.startLesson('ee_about_me_food');

  console.log('=== OPENING ===');
  console.log('engineVersion:', (start.json.session as Record<string, unknown>)?.engineVersion);
  console.log('AI:', start.turn.aiResponse);
  console.log('expectedSpeech:', start.turn.expectedSpeech);
  console.log('currentTurn:', start.turn.currentTurn);

  const userSpeech = 'I work at an office.';
  const res = await client.sendUserSpeech(
    start.sessionId,
    start.turn.currentTurn,
    userSpeech,
  );

  const j = res.json as Record<string, unknown>;

  console.log('\n=== UNHAPPY INCORRECT (lane 4) ===');
  console.log('USER:', userSpeech);
  console.log('AI:', res.turn.aiResponse);
  console.log('textTh:', j.textTh ?? '');
  console.log('currentTurn:', res.turn.currentTurn);
  console.log('expectedSpeech:', res.turn.expectedSpeech);
  console.log('guidedStem:', res.turn.guidedStem);
  console.log('expectsUserSpeech:', res.turn.expectsUserSpeech);
  console.log('isTaskComplete:', res.turn.isTaskComplete);
  console.log('aiDebug:', JSON.stringify(j.aiDebug, null, 2));

  console.log('\n=== guidedSpeaking ===');
  console.log(JSON.stringify(j.guidedSpeaking, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
