/**
 * Mission checkpoint scenarios against prod (coffee + meet new friend).
 *
 * Transcripts:
 *   mission-scenario-results/YYYY-MM-DD/
 *     {simulationId}.txt
 *     run-HHmmss.txt
 *     SUMMARY.txt
 *
 *   npx tsx scripts/mission-scenarios-prod.ts
 *   npx tsx scripts/mission-scenarios-prod.ts coffee
 *   npx tsx scripts/mission-scenarios-prod.ts coffee 2
 *   npx tsx scripts/mission-scenarios-prod.ts friend 1
 *   npx tsx scripts/mission-scenarios-prod.ts 3
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/mission-scenarios-prod.ts
 */
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';
import {
  formatMs,
  parseMissionScenarioArgs,
  runMissionScenario,
  SCENARIO_TITLES,
  type ScenarioRunResult,
} from './lib/mission-scenarios-prod-runner';

const API_BASE = (
  process.env.API_BASE ?? 'https://banana-english-api-production.up.railway.app'
).replace(/\/$/, '');

let missionIds;
let scenarios: number[];

try {
  ({ missionIds, scenarios } = parseMissionScenarioArgs(process.argv));
} catch (err) {
  console.error(
    'Usage: npx tsx scripts/mission-scenarios-prod.ts [missionId ...] [scenario 1-3]',
  );
  console.error(
    '       npx tsx scripts/mission-scenarios-prod.ts coffee friend',
  );
  console.error(
    '       npx tsx scripts/mission-scenarios-prod.ts coffee 2',
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
  const dir = join(process.cwd(), 'mission-scenario-results', date);
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
  const byMission = new Map<string, ScenarioRunResult[]>();
  for (const r of results) {
    const list = byMission.get(r.lessonId) ?? [];
    list.push(r);
    byMission.set(r.lessonId, list);
  }
  for (const [missionId, rows] of byMission) {
    lines.push('', missionId);
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
  console.log(`Missions: ${missionIds.join(', ')}`);
  console.log(`Scenarios: ${scenarios.join(', ')}`);
  for (const n of scenarios) {
    console.log(`  ${n}: ${SCENARIO_TITLES[n]}`);
  }
  log.takeBuffer();

  const results: ScenarioRunResult[] = [];
  let runIndex = 0;

  try {
    for (const missionId of missionIds) {
      for (const scenario of scenarios) {
        results.push(
          await runMissionScenario(API_BASE, missionId, scenario, runIndex++),
        );
      }
      writeFileSync(join(log.dir, `${missionId}.txt`), log.takeBuffer(), 'utf8');
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
