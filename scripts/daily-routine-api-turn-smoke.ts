import {
  DailyRoutineApiClient,
  DEFAULT_LESSON_ID,
} from './lib/daily-routine-api-client';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
);
const ANON_USER =
  process.env.ANON_USER ?? `daily-routine-smoke-${Date.now()}`;

const USER_LINES = [
  "I'm ready",
  'wake up',
  "I wake up at 7 o'clock.",
  "I go to sleep at 11 o'clock.",
  'I wake up at 7 AM.',
  'I drink coffee every day.',
  'I wake up at 7 AM every day.',
];

async function main(): Promise<void> {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`ANON_USER=${ANON_USER}`);

  const client = new DailyRoutineApiClient(API_BASE, ANON_USER);
  await client.refillBananas();

  const { sessionId, turn: opening } = await client.startLesson(DEFAULT_LESSON_ID);
  client.logTurn('opening', opening);

  let currentTurn = opening.currentTurn;

  for (let i = 0; i < USER_LINES.length; i++) {
    const userSpeech = USER_LINES[i];
    console.log(`\n>>> USER (step ${i + 1}): ${userSpeech}`);

    const { turn } = await client.sendUserSpeech(
      sessionId,
      currentTurn,
      userSpeech,
    );
    client.logTurn(`AI after user step ${i + 1}`, turn);

    currentTurn = turn.currentTurn;

    if (turn.isTaskComplete) {
      console.log('\n✅ Lesson complete');
      return;
    }
  }

  console.log('\n⚠️  Ran out of scripted user lines before lesson complete');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ Smoke failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
