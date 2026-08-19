/**
 * PoolGate v2 smoke — all 10 About Me lessons on prod.
 *
 * Per lesson:
 *   1. engineVersion 2
 *   2. wrong #1 off-topic → Gemini incorrect + พูดตาม
 *   3. wrong #2 → scripted soft-advance (คำตอบนี้เราพูดว่า … ไปต่อกันเลย —)
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/about-me-v2-smoke.ts
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

/** Off-topic on every About Me step 1; avoids near-tier (e.g. hobbies) and Gemini correct (e.g. work/school). */
const WRONG_1 = 'Good morning.';
const WRONG_2 = 'Hello.';

type LessonCase = {
  id: string;
  label: string;
  modelPattern: RegExp;
  advancePattern: RegExp;
};

const LESSONS: LessonCase[] = [
  {
    id: 'ee_about_me_daily_routine',
    label: 'Daily Routine',
    modelPattern: /I'm ready/i,
    advancePattern: /wake up|What time do you wake up/i,
  },
  {
    id: 'ee_about_me_food',
    label: 'Food & Drinks',
    modelPattern: /I like pizza/i,
    advancePattern: /What is pizza like/i,
  },
  {
    id: 'ee_about_me_home',
    label: 'Home',
    modelPattern: /I live in an apartment/i,
    advancePattern: /Who do you live with/i,
  },
  {
    id: 'ee_about_me_work_school',
    label: 'Work & School',
    modelPattern: /I work/i,
    advancePattern: /Where do you work/i,
  },
  {
    id: 'ee_about_me_hobbies',
    label: 'Hobbies',
    modelPattern: /I watch movies/i,
    advancePattern: /How often do you watch movies/i,
  },
  {
    id: 'ee_about_me_pets',
    label: 'Pets',
    modelPattern: /I have a dog/i,
    advancePattern: /What is your dog like/i,
  },
  {
    id: 'ee_about_me_people',
    label: 'People',
    modelPattern: /My brother/i,
    advancePattern: /What does he do/i,
  },
  {
    id: 'ee_about_me_weather',
    label: 'Weather',
    modelPattern: /Hot/i,
    advancePattern: /very cold today/i,
  },
  {
    id: 'ee_about_me_friends',
    label: 'Friends',
    modelPattern: /We play games together/i,
    advancePattern: /we eat out together/i,
  },
  {
    id: 'ee_about_me_favorites',
    label: 'Favorites',
    modelPattern: /I prefer pizza/i,
    advancePattern: /Why do you like it/i,
  },
];

type Result = { label: string; ok: boolean; detail?: string };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertMatch(value: string, pattern: RegExp, message: string): void {
  if (!pattern.test(value)) throw new Error(`${message}: got "${value.slice(0, 180)}"`);
}

function aiDebug(json: Json): Record<string, unknown> | undefined {
  return json.aiDebug as Record<string, unknown> | undefined;
}

function engineVersion(json: Json): number | undefined {
  return (json.session as Json | undefined)?.engineVersion as number | undefined;
}

function asksRepeat(text: string): boolean {
  return /พูดตาม|ลองพูดตาม/i.test(text);
}

function logTurn(
  label: string,
  user: string | null,
  turn: TurnResult,
  json: Json,
): void {
  const dbg = aiDebug(json);
  console.log(`\n── ${label} ──`);
  if (user) console.log(`  USER: ${user}`);
  console.log(`  AI:   ${(turn.aiResponse ?? '').slice(0, 220)}`);
  console.log(`  expected: ${turn.expectedSpeech ?? '(none)'}`);
  if (dbg) console.log(`  aiDebug: ${JSON.stringify(dbg)}`);
}

async function smokeLesson(
  client: LessonApiClient,
  lesson: LessonCase,
): Promise<void> {
  const start = await client.startLesson(lesson.id);
  assert(engineVersion(start.json) === 2, `${lesson.label}: expected engineVersion 2`);
  logTurn(`${lesson.label} · opening`, null, start.turn, start.json);

  let turn = start.turn.currentTurn;

  let res = await client.sendUserSpeech(start.sessionId, turn, WRONG_1);
  logTurn(`${lesson.label} · wrong #1`, WRONG_1, res.turn, res.json);
  assert(
    aiDebug(res.json)?.source === 'gemini',
    `${lesson.label}: wrong #1 should be gemini`,
  );
  assert(
    asksRepeat(res.turn.aiResponse ?? ''),
    `${lesson.label}: wrong #1 should ask พูดตาม`,
  );
  turn = res.turn.currentTurn;

  res = await client.sendUserSpeech(start.sessionId, turn, WRONG_2);
  logTurn(`${lesson.label} · wrong #2 soft-advance`, WRONG_2, res.turn, res.json);
  assert(
    aiDebug(res.json)?.source === 'scripted',
    `${lesson.label}: wrong #2 should be scripted soft-advance`,
  );
  const ai = res.turn.aiResponse ?? '';
  assertMatch(ai, /ตรงนี้พูดว่า/, `${lesson.label}: soft-advance model line`);
  assertMatch(ai, /ไปต่อกันเลย —/, `${lesson.label}: soft-advance lead-in`);
  assertMatch(ai, lesson.modelPattern, `${lesson.label}: model phrase`);
  assertMatch(ai, lesson.advancePattern, `${lesson.label}: next question`);
}

async function runLesson(lesson: LessonCase, index: number): Promise<Result> {
  const client = new LessonApiClient(API_BASE, `about-me-v2-${Date.now()}-${index}`);
  try {
    await client.refillBananas();
    console.log(`\n${'='.repeat(64)}\nLESSON: ${lesson.label} (${lesson.id})`);
    await smokeLesson(client, lesson);
    console.log(`\n✅ ${lesson.label}`);
    return { label: lesson.label, ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ ${lesson.label}: ${detail}`);
    return { label: lesson.label, ok: false, detail };
  }
}

async function main(): Promise<void> {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`About Me PoolGate v2 — ${LESSONS.length} lessons\n`);

  const results: Result[] = [];
  for (let i = 0; i < LESSONS.length; i++) {
    results.push(await runLesson(LESSONS[i], i));
  }

  console.log(`\n${'='.repeat(64)}\nSUMMARY (${results.filter((r) => r.ok).length}/${results.length})`);
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
  }

  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ About Me v2 smoke crashed:', err);
  process.exitCode = 1;
});
