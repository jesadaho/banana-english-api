/**
 * Full Food flow: 2x wrong on step 1 → soft-advance → complete lesson.
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/pool-gate-incorrect-full-flow.ts
 */
import { LessonApiClient } from './lib/lesson-api-client';

const API = (process.env.API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');

function printTurn(
  step: number,
  label: string,
  user: string | null,
  json: Record<string, unknown>,
) {
  const gs = json.guidedSpeaking as Record<string, unknown> | undefined;
  const dbg = json.aiDebug as Record<string, unknown> | undefined;
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`STEP ${step} · ${label}`);
  if (user) console.log(`👤 USER: ${user}`);
  console.log(`🍌 AI:   ${json.aiResponse ?? '(empty)'}`);
  console.log(`   turn: ${json.currentTurn} | expected: ${json.expectedSpeech ?? '(none)'}`);
  console.log(`   stem: ${gs?.stem ?? '(none)'}`);
  if (dbg) console.log(`   aiDebug: ${JSON.stringify(dbg)}`);
  console.log(`   complete: ${json.isTaskComplete ?? false}`);
}

async function main() {
  const client = new LessonApiClient(API, `incorrect-full-${Date.now()}`);
  await client.refillBananas();

  const start = await client.startLesson('ee_about_me_food');
  printTurn(0, 'OPENING', null, start.json as Record<string, unknown>);

  let step = 1;
  let turn = start.turn.currentTurn;

  // Wrong #1 → Gemini incorrect (stay step 1)
  let res = await client.sendUserSpeech(
    start.sessionId,
    turn,
    'I work at an office.',
  );
  printTurn(step++, 'WRONG #1 · incorrect (พูดตาม)', 'I work at an office.', res.json as Record<string, unknown>);
  turn = res.turn.currentTurn;

  // Wrong #2 → soft-advance scripted
  res = await client.sendUserSpeech(start.sessionId, turn, 'Good morning.');
  printTurn(step++, 'WRONG #2 · soft-advance (ไปต่อกัน)', 'Good morning.', res.json as Record<string, unknown>);
  turn = res.turn.currentTurn;

  // From here: in-pool answers to finish (default pizza path after soft-advance)
  const finishLines = [
    'Pizza is delicious.',
    'I drink iced tea with pizza.',
    'Pizza is delicious.',
    'I drink iced tea with pizza.',
    'Somtam is spicy.',
  ];

  for (const userSpeech of finishLines) {
    res = await client.sendUserSpeech(start.sessionId, turn, userSpeech);
    printTurn(step++, `in-pool scripted`, userSpeech, res.json as Record<string, unknown>);
    turn = res.turn.currentTurn;
    if (res.turn.isTaskComplete) {
      console.log(`\n${'='.repeat(72)}`);
      console.log('✅ LESSON COMPLETE');
      return;
    }
  }

  console.log('\n⚠️ Did not complete after finish lines');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
