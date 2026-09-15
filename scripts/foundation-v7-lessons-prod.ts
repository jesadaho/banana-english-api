/**
 * Foundation V7 lessons — PoolGate scenarios 1–5 on staging.
 *
 * Transcripts:
 *   foundation-v7-lesson-results/YYYY-MM-DD/
 *     {lessonId}.txt
 *     run-HHmmss.txt
 *     SUMMARY.txt
 *
 *   API_BASE=https://banana-english-api-staging.up.railway.app \
 *     npx tsx scripts/foundation-v7-lessons-prod.ts
 *
 *   npx tsx scripts/foundation-v7-lessons-prod.ts authored
 *   npx tsx scripts/foundation-v7-lessons-prod.ts frozen
 *   npx tsx scripts/foundation-v7-lessons-prod.ts ch2
 *   npx tsx scripts/foundation-v7-lessons-prod.ts u03
 *   npx tsx scripts/foundation-v7-lessons-prod.ts fnd_v7_i_am_you_are 1
 *   npx tsx scripts/foundation-v7-lessons-prod.ts 1
 */
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';
import {
  formatMs,
  lessonSummaryLabel,
  parseFoundationV7LessonArgs,
  runFoundationV7Lesson,
  SCENARIO_TITLES,
  type ScenarioRunResult,
} from './lib/foundation-v7-lessons-prod-runner';

const API_BASE = (
  process.env.API_BASE ?? 'https://banana-english-api-staging.up.railway.app'
).replace(/\/$/, '');

let lessonIds: string[];
let scenarios: number[];
try {
  ({ lessonIds, scenarios } = parseFoundationV7LessonArgs(process.argv));
} catch (err) {
  console.error(
    'Usage: npx tsx scripts/foundation-v7-lessons-prod.ts [lessonId ... | authored | frozen | all | ch2 | u03] [scenario 1-5]',
  );
  console.error(
    '       npx tsx scripts/foundation-v7-lessons-prod.ts fnd_v7_i_am_you_are',
  );
  console.error('       npx tsx scripts/foundation-v7-lessons-prod.ts authored 1');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function openResultLog(now = new Date()) {
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const dir = join(process.cwd(), 'foundation-v7-lesson-results', date);
  mkdirSync(dir, { recursive: true });

  const runPath = join(dir, `run-${time}.txt`);
  const stream = createWriteStream(runPath);
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  let buffer: string[] = [];

  const write = (args: unknown[]) => {
    const line = `${format(...args)}\n`;
    buffer.push(line);
    stream.write(line);
  };

  console.log = (...args: unknown[]) => {
    origLog(...args);
    write(args);
  };
  console.error = (...args: unknown[]) => {
    origErr(...args);
    write(args);
  };

  return {
    dir,
    runPath,
    takeBuffer(): string {
      const text = buffer.join('');
      buffer = [];
      return text;
    },
    close(): void {
      console.log = origLog;
      console.error = origErr;
      stream.end();
    },
  };
}

function formatSummary(results: ScenarioRunResult[]): string {
  const lines: string[] = ['SUMMARY', '='.repeat(80)];
  const byLesson = new Map<string, ScenarioRunResult[]>();
  for (const r of results) {
    const list = byLesson.get(r.lessonId) ?? [];
    list.push(r);
    byLesson.set(r.lessonId, list);
  }
  for (const [lessonId, rows] of byLesson) {
    lines.push('', lessonSummaryLabel(lessonId, rows[0]?.titleEn));
    for (const r of rows) {
      lines.push(
        r.ok
          ? `  ✅ Scenario ${r.scenario} — ${r.steps} steps · ${formatMs(r.totalMs)}`
          : `  ❌ Scenario ${r.scenario} — ${r.error}`,
      );
    }
  }
  const failed = results.filter((r) => !r.ok);
  lines.push(
    '',
    `Total: ${results.length - failed.length}/${results.length} passed`,
    '',
  );
  return lines.join('\n');
}

async function main(): Promise<void> {
  const log = openResultLog();

  console.log(`API_BASE=${API_BASE}`);
  console.log(`Results: ${log.dir}`);
  console.log('Lessons:');
  for (const id of lessonIds) {
    console.log(`  ${lessonSummaryLabel(id)}`);
  }
  console.log(`Scenarios: ${scenarios.join(', ')}`);
  for (const n of scenarios) {
    console.log(`  ${n}: ${SCENARIO_TITLES[n]}`);
  }
  log.takeBuffer();

  const results: ScenarioRunResult[] = [];
  let runIndex = 0;

  try {
    for (const lessonId of lessonIds) {
      for (const scenario of scenarios) {
        results.push(
          await runFoundationV7Lesson(API_BASE, lessonId, scenario, runIndex++),
        );
      }
      writeFileSync(join(log.dir, `${lessonId}.txt`), log.takeBuffer(), 'utf8');
    }

    const summary = formatSummary(results);
    console.log(`\n${'='.repeat(80)}`);
    console.log(summary.trimEnd());
    writeFileSync(join(log.dir, 'SUMMARY.txt'), `${summary}\n`, 'utf8');
    log.takeBuffer();
  } finally {
    log.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`Saved: ${log.runPath}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
