/**
 * PoolGate v2 smoke — all 15 Foundation lessons (Basics).
 *
 * Per lesson:
 *   1. engineVersion 2
 *   2. step 1 in-pool → scripted
 *   3. wrong #1 off-topic → Gemini + พูดตาม
 *   4. wrong #2 → soft-advance
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/foundation-v2-smoke.ts
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

const WRONG_1 = 'Good morning.';
const WRONG_2 = 'Hello.';

/** Step-1 in-pool happy answers (from foundation-v2.test.ts). */
const STEP1_HAPPY: Record<string, string> = {
  introductions: 'My name is Nana.',
  yes_no_maybe: 'Yes, I do.',
  polite_expressions: 'Thank you very much.',
  meet_people: 'I am Nana.',
  talk_about_groups: 'He is my father.',
  ee_about_me_family: "I'm ready",
  numbers: 'three',
  telling_time: "It's six o'clock.",
  everyday_numbers: 'forty',
  money_prices: 'How much is it?',
  likes_dislikes: 'I like coffee.',
  wants_needs: 'I want water.',
  can_cant: 'I can swim.',
  asking_for_help: "I don't understand.",
  asking_questions: 'Where is the bathroom?',
};

const LESSON_LABELS: Record<string, string> = {
  introductions: 'Introductions',
  yes_no_maybe: 'Yes, No & Basics',
  polite_expressions: 'Polite Expressions',
  meet_people: 'Talking About Yourself',
  talk_about_groups: 'Talking About People',
  ee_about_me_family: 'Family',
  numbers: 'Numbers',
  telling_time: 'Time',
  everyday_numbers: 'More Numbers',
  money_prices: 'Money & Prices',
  likes_dislikes: 'Likes & Dislikes',
  wants_needs: 'Wants & Needs',
  can_cant: "Can & Can't",
  asking_for_help: 'Asking for Help',
  asking_questions: 'Simple Questions',
};

type Result = { label: string; ok: boolean; detail?: string };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
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
  lessonId: string,
  label: string,
): Promise<void> {
  const happy1 = STEP1_HAPPY[lessonId];
  assert(Boolean(happy1), `missing step-1 happy answer for ${lessonId}`);

  const start = await client.startLesson(lessonId);
  assert(engineVersion(start.json) === 2, `${label}: expected engineVersion 2`);
  logTurn(`${label} · opening`, null, start.turn, start.json);

  let turn = start.turn.currentTurn;

  let res = await client.sendUserSpeech(start.sessionId, turn, happy1);
  logTurn(`${label} · happy step 1`, happy1, res.turn, res.json);
  assert(
    aiDebug(res.json)?.source === 'scripted',
    `${label}: happy step 1 should be scripted`,
  );
  turn = res.turn.currentTurn;

  const start2 = await client.startLesson(lessonId);
  turn = start2.turn.currentTurn;

  res = await client.sendUserSpeech(start2.sessionId, turn, WRONG_1);
  logTurn(`${label} · wrong #1`, WRONG_1, res.turn, res.json);
  assert(
    aiDebug(res.json)?.source === 'gemini',
    `${label}: wrong #1 should be gemini`,
  );
  assert(
    asksRepeat(res.turn.aiResponse ?? ''),
    `${label}: wrong #1 should ask พูดตาม`,
  );
  turn = res.turn.currentTurn;

  res = await client.sendUserSpeech(start2.sessionId, turn, WRONG_2);
  logTurn(`${label} · wrong #2 soft-advance`, WRONG_2, res.turn, res.json);
  assert(
    aiDebug(res.json)?.source === 'scripted',
    `${label}: wrong #2 should be scripted soft-advance`,
  );
  const ai = res.turn.aiResponse ?? '';
  assert(/ตรงนี้พูดว่า/.test(ai), `${label}: soft-advance model line`);
  assert(/ไปต่อกันเลย —/.test(ai), `${label}: soft-advance lead-in`);
}

async function runLesson(
  lessonId: string,
  index: number,
): Promise<Result> {
  const label = LESSON_LABELS[lessonId] ?? lessonId;
  const client = new LessonApiClient(
    API_BASE,
    `foundation-v2-${Date.now()}-${index}`,
  );
  try {
    await client.refillBananas();
    console.log(`\n${'='.repeat(64)}\nLESSON: ${label} (${lessonId})`);
    await smokeLesson(client, lessonId, label);
    console.log(`\n✅ ${label}`);
    return { label, ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ ${label}: ${detail}`);
    return { label, ok: false, detail };
  }
}

async function main(): Promise<void> {
  const ids = Object.keys(STEP1_HAPPY);
  console.log(`API_BASE=${API_BASE}`);
  console.log(`Foundation PoolGate v2 — ${ids.length} lessons\n`);

  const results: Result[] = [];
  for (let i = 0; i < ids.length; i++) {
    results.push(await runLesson(ids[i], i));
  }

  console.log(
    `\n${'='.repeat(64)}\nSUMMARY (${results.filter((r) => r.ok).length}/${results.length})`,
  );
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
  }

  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ Foundation v2 smoke crashed:', err);
  process.exitCode = 1;
});
