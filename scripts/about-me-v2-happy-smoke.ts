/**
 * PoolGate v2 happy-path smoke — all 10 About Me lessons on prod.
 * Every user line is an in-pool exact match → scripted (no Gemini).
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/about-me-v2-happy-smoke.ts
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

type LessonCase = {
  id: string;
  label: string;
  /** Default in-pool user lines from opening through lesson complete. */
  lines: string[];
  /** Teaching steps only — success when all lines are scripted (e.g. Favorites → roleplay). */
  teachingOnly?: boolean;
};

const LESSONS: LessonCase[] = [
  {
    id: 'ee_about_me_daily_routine',
    label: 'Daily Routine',
    lines: [
      "I'm ready",
      'wake up',
      "I wake up at 7 o'clock.",
      "I go to sleep at 11 o'clock.",
      'I wake up at 7 AM.',
      'I drink coffee every day.',
      'I wake up at 7 AM every day.',
    ],
  },
  {
    id: 'ee_about_me_food',
    label: 'Food & Drinks',
    lines: [
      'I like pizza.',
      'Pizza is delicious.',
      'I drink iced tea with pizza.',
      'Pizza is delicious.',
      'I drink iced tea with pizza.',
      'Somtam is spicy.',
    ],
  },
  {
    id: 'ee_about_me_home',
    label: 'Home',
    lines: [
      'I live in an apartment.',
      'I live with my family.',
      'I like to relax in the living room.',
      'I live in an apartment.',
      'I live with my family.',
      'I like to relax in the living room.',
    ],
  },
  {
    id: 'ee_about_me_work_school',
    label: 'Work & School',
    lines: [
      'I work.',
      'I work at an office.',
      'My work is busy.',
      'My work is busy, but I enjoy it.',
    ],
  },
  {
    id: 'ee_about_me_hobbies',
    label: 'Hobbies',
    lines: [
      'I watch movies.',
      'I often watch movies.',
      'On weekends, I usually watch movies.',
      'Usually.',
      'Sometimes.',
    ],
  },
  {
    id: 'ee_about_me_pets',
    label: 'Pets',
    lines: [
      'I have a dog.',
      'My dog is very friendly.',
      'Your dog is very friendly.',
      'I have a dog. My dog is very friendly.',
    ],
  },
  {
    id: 'ee_about_me_people',
    label: 'People',
    lines: [
      'My brother.',
      'My brother is an engineer.',
      'He is very funny.',
      'He is very funny.',
      'She is very nice.',
    ],
  },
  {
    id: 'ee_about_me_weather',
    label: 'Weather',
    lines: [
      'Hot.',
      'The weather is very cold today.',
      'I like sunny weather.',
      'I like rainy weather.',
    ],
  },
  {
    id: 'ee_about_me_friends',
    label: 'Friends',
    lines: [
      'We play games together.',
      'We eat out together.',
      'They play games together.',
      'We hang out together.',
      'They eat out together.',
    ],
  },
  {
    id: 'ee_about_me_favorites',
    label: 'Favorites',
    teachingOnly: true,
    lines: [
      'I prefer pizza.',
      "I think it's delicious.",
      'They like pizza.',
      'We eat together.',
    ],
  },
];

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

  for (let i = 0; i < lesson.lines.length; i++) {
    const userSpeech = lesson.lines[i];
    const res = await client.sendUserSpeech(start.sessionId, turn, userSpeech);
    logTurn(`${lesson.label} · step ${i + 1}`, userSpeech, res.turn, res.json);

    assert(
      aiDebug(res.json)?.source === 'scripted',
      `${lesson.label} step ${i + 1} should be scripted in-pool, got ${JSON.stringify(aiDebug(res.json))}`,
    );

    turn = res.turn.currentTurn;

    if (res.turn.isTaskComplete) {
      console.log(`\n  ✅ ${lesson.label} complete after step ${i + 1}`);
      return;
    }

    if (lesson.teachingOnly && i === lesson.lines.length - 1) {
      console.log(`\n  ✅ ${lesson.label} teaching complete after step ${i + 1}`);
      return;
    }
  }

  throw new Error(`${lesson.label}: ran out of lines before lesson complete`);
}

async function runLesson(lesson: LessonCase, index: number): Promise<Result> {
  const client = new LessonApiClient(API_BASE, `about-me-happy-${Date.now()}-${index}`);
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
  console.log(`About Me PoolGate v2 happy path — ${LESSONS.length} lessons\n`);

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
  console.error('\n❌ About Me v2 happy smoke crashed:', err);
  process.exitCode = 1;
});
