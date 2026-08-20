/**
 * Foundation PoolGate — all 16 lessons (incl. greetings), scenarios 1–5 against prod.
 *
 * Transcripts are always written under:
 *   foundation-scenario-results/YYYY-MM-DD/
 *     {lessonId}.txt   latest transcript for that lesson today
 *     run-HHmmss.txt   full stdout of this invocation
 *     SUMMARY.txt      pass/fail of this invocation
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/foundation-scenarios-prod.ts
 *
 *   npx tsx scripts/foundation-scenarios-prod.ts greetings 1
 *   npx tsx scripts/foundation-scenarios-prod.ts 3              # all lessons, scenario 3
 *   npx tsx scripts/foundation-scenarios-prod.ts introductions  # one lesson, all scenarios
 */
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';
import {
  formatMs,
  parseFoundationScenarioArgs,
  runFoundationScenario,
  SCENARIO_TITLES,
  type ScenarioRunResult,
} from './lib/foundation-scenarios-prod-runner';

const API_BASE = (
  process.env.API_BASE ?? 'https://banana-english-api-production.up.railway.app'
).replace(/\/$/, '');

let lessonIds;
let scenarios: number[];

try {
  ({ lessonIds, scenarios } = parseFoundationScenarioArgs(process.argv));
} catch (err) {
  console.error(
    'Usage: npx tsx scripts/foundation-scenarios-prod.ts [lessonId] [scenario 1-5]',
  );
  console.error(
    '       npx tsx scripts/foundation-scenarios-prod.ts [scenario 1-5]   # all lessons',
  );
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function openResultLog(now = new Date()) {
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const dir = join(process.cwd(), 'foundation-scenario-results', date);
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
    lines.push('', lessonId);
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
  console.log(`Lessons: ${lessonIds.join(', ')}`);
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
          await runFoundationScenario(API_BASE, lessonId, scenario, runIndex++),
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
