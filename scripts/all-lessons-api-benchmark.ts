/**
 * Happy-path turn benchmark for every lesson in LESSON_PROGRESSION_ORDER.
 * Drives each lesson to completion (or max turns) and reports avg response time.
 *
 * Usage:
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     tsx scripts/all-lessons-api-benchmark.ts
 *
 * Optional env:
 *   LESSON_IDS=greetings,introductions   — subset only
 *   ANON_PREFIX=lesson-bench             — anonymous user prefix
 *   MAX_EXTRA_TURNS=5                    — safety buffer beyond lesson maxTurns
 *   OUTPUT=scripts/output/all-lessons-benchmark.json
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getAllLessons, getLesson } from '../src/lessons/lessons.data';
import { LessonApiClient, type TurnResult } from './lib/lesson-api-client';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
);
const ANON_PREFIX = process.env.ANON_PREFIX ?? 'all-lessons-bench';
const MAX_EXTRA_TURNS = Number(process.env.MAX_EXTRA_TURNS ?? '5');
const OUTPUT =
  process.env.OUTPUT ?? 'scripts/output/all-lessons-benchmark.json';
const VERBOSE = process.env.VERBOSE === '1';

type LessonBenchResult = {
  lessonId: string;
  titleEn: string;
  titleTh: string;
  ok: boolean;
  completed: boolean;
  turns: number;
  apiCalls: number;
  avgMs: number;
  avgGeminiMs: number;
  avgHandlerMs: number;
  minMs: number;
  maxMs: number;
  totalMs: number;
  error?: string;
  timingsMs: number[];
  geminiMs: number[];
  handlerMs: number[];
};

function parseAiDebug(json: Record<string, unknown>): {
  geminiMs?: number;
  handlerMs?: number;
} {
  const raw = json.aiDebug;
  if (raw == null || typeof raw !== 'object') return {};
  const d = raw as Record<string, unknown>;
  return {
    geminiMs: typeof d.geminiMs === 'number' ? d.geminiMs : undefined,
    handlerMs: typeof d.handlerMs === 'number' ? d.handlerMs : undefined,
  };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function parseLessonFilter(): Set<string> | null {
  const raw = process.env.LESSON_IDS?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

async function runLesson(
  lessonId: string,
  runIndex: number,
): Promise<LessonBenchResult> {
  const config = getLesson(lessonId);
  const titleEn = config?.titleEn ?? lessonId;
  const titleTh = config?.titleTh ?? lessonId;
  const maxTurns = config?.maxTurns ?? 30;
  const anonUser = `${ANON_PREFIX}-${lessonId}-${Date.now()}-${runIndex}`;
  const client = new LessonApiClient(API_BASE, anonUser);
  const timingsMs: number[] = [];
  const geminiMs: number[] = [];
  const handlerMs: number[] = [];

  const recordAiDebug = (json: Record<string, unknown>) => {
    const dbg = parseAiDebug(json);
    if (dbg.geminiMs != null) geminiMs.push(dbg.geminiMs);
    if (dbg.handlerMs != null) handlerMs.push(dbg.handlerMs);
  };

  try {
    await client.refillBananas();

    const opening = await client.startLesson(lessonId);
    timingsMs.push(opening.durationMs);
    recordAiDebug((opening.json.opening ?? opening.json) as Record<string, unknown>);

    let turn: TurnResult = opening.turn;
    let currentTurn = turn.currentTurn;
    const sessionId = opening.sessionId;
    let steps = 0;
    const maxSteps = maxTurns + MAX_EXTRA_TURNS;
    const seen = new Set<string>();

    if (VERBOSE) client.logTurn(`${lessonId} opening`, turn);

    while (!turn.isTaskComplete && steps < maxSteps) {
      const userSpeech = client.suggestedUserSpeech(turn);
      if (!userSpeech) break;

      const sig = `${currentTurn}|${userSpeech}|${turn.expectedSpeech ?? ''}`;
      if (seen.has(sig)) {
        throw new Error(`stuck loop at turn ${currentTurn} with "${userSpeech}"`);
      }
      seen.add(sig);

      if (VERBOSE) {
        console.log(`\n>>> ${lessonId} USER: ${userSpeech}`);
      }

      const res = await client.sendUserSpeech(sessionId, currentTurn, userSpeech);
      timingsMs.push(res.durationMs);
      recordAiDebug(res.json);
      turn = res.turn;
      currentTurn = turn.currentTurn;
      steps++;

      if (VERBOSE) client.logTurn(`${lessonId} step ${steps}`, turn);
    }

    const completed = Boolean(turn.isTaskComplete);
    const ok = completed;

    return {
      lessonId,
      titleEn,
      titleTh,
      ok,
      completed,
      turns: steps,
      apiCalls: timingsMs.length,
      avgMs: Math.round(avg(timingsMs)),
      avgGeminiMs: Math.round(avg(geminiMs)),
      avgHandlerMs: Math.round(avg(handlerMs)),
      minMs: timingsMs.length ? Math.min(...timingsMs) : 0,
      maxMs: timingsMs.length ? Math.max(...timingsMs) : 0,
      totalMs: Math.round(timingsMs.reduce((a, b) => a + b, 0)),
      timingsMs: timingsMs.map((n) => Math.round(n)),
      geminiMs: geminiMs.map((n) => Math.round(n)),
      handlerMs: handlerMs.map((n) => Math.round(n)),
      ...(ok
        ? {}
        : {
            error: completed
              ? undefined
              : steps >= maxSteps
                ? `max steps (${maxSteps}) reached without completion`
                : 'lesson did not complete',
          }),
    };
  } catch (err) {
    return {
      lessonId,
      titleEn,
      titleTh,
      ok: false,
      completed: false,
      turns: 0,
      apiCalls: timingsMs.length,
      avgMs: timingsMs.length ? Math.round(avg(timingsMs)) : 0,
      avgGeminiMs: Math.round(avg(geminiMs)),
      avgHandlerMs: Math.round(avg(handlerMs)),
      minMs: timingsMs.length ? Math.min(...timingsMs) : 0,
      maxMs: timingsMs.length ? Math.max(...timingsMs) : 0,
      totalMs: Math.round(timingsMs.reduce((a, b) => a + b, 0)),
      timingsMs: timingsMs.map((n) => Math.round(n)),
      geminiMs: geminiMs.map((n) => Math.round(n)),
      handlerMs: handlerMs.map((n) => Math.round(n)),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function printTable(results: LessonBenchResult[]): void {
  const header =
    '| Lesson | Title | OK | Turns | Wall (ms) | Gemini (ms) | Handler (ms) |';
  const sep =
    '|--------|-------|----|-------|-----------|-------------|--------------|';
  console.log('\n' + header);
  console.log(sep);
  for (const r of results) {
    console.log(
      `| ${r.lessonId} | ${r.titleEn.slice(0, 22)} | ${r.ok ? '✅' : '❌'} | ${r.turns} | ${r.avgMs} | ${r.avgGeminiMs} | ${r.avgHandlerMs} |`,
    );
    if (r.error) {
      console.log(`  ↳ ${r.error}`);
    }
  }

  const okResults = results.filter((r) => r.ok);
  const allTimings = okResults.flatMap((r) => r.timingsMs);
  console.log('\n── Summary ──');
  console.log(`Lessons: ${results.length} total, ${okResults.length} completed`);
  if (allTimings.length) {
    console.log(`Overall avg response: ${Math.round(avg(allTimings))} ms`);
    console.log(
      `Slowest lesson (by avg): ${okResults.sort((a, b) => b.avgMs - a.avgMs)[0]?.lessonId ?? 'n/a'}`,
    );
  }
}

async function main(): Promise<void> {
  const filter = parseLessonFilter();
  const lessons = getAllLessons().filter(
    (l) => !filter || filter.has(l.lessonId),
  );

  console.log(`API_BASE=${API_BASE}`);
  console.log(`Lessons to run: ${lessons.length}`);

  const results: LessonBenchResult[] = [];
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!;
    console.log(
      `\n[${i + 1}/${lessons.length}] ${lesson.lessonId} — ${lesson.titleEn}`,
    );
    const result = await runLesson(lesson.lessonId, i);
    results.push(result);
    console.log(
      `  → ${result.ok ? 'OK' : 'FAIL'} | turns=${result.turns} wall=${result.avgMs}ms llm=${result.avgGeminiMs}ms handler=${result.avgHandlerMs}ms`,
    );
    if (result.error) console.log(`  → ${result.error}`);

    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(
      OUTPUT,
      JSON.stringify(
        {
          apiBase: API_BASE,
          ranAt: new Date().toISOString(),
          lessonCount: lessons.length,
          results,
        },
        null,
        2,
      ),
    );
  }

  printTable(results);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\n❌ Benchmark crashed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
