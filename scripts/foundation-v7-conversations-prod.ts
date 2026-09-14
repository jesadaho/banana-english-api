/**
 * Foundation V7 conversations — checkpoint scenarios on staging.
 *
 * Transcripts:
 *   foundation-v7-conversation-results/YYYY-MM-DD/
 *     {simulationId}.txt
 *     run-HHmmss.txt
 *     SUMMARY.txt
 *
 *   API_BASE=https://banana-english-api-staging.up.railway.app \
 *     npx tsx scripts/foundation-v7-conversations-prod.ts
 *
 *   npx tsx scripts/foundation-v7-conversations-prod.ts authored
 *   npx tsx scripts/foundation-v7-conversations-prod.ts frozen
 *   npx tsx scripts/foundation-v7-conversations-prod.ts ch2
 *   npx tsx scripts/foundation-v7-conversations-prod.ts u03
 *   npx tsx scripts/foundation-v7-conversations-prod.ts foundation_v7_u02n04
 *   npx tsx scripts/foundation-v7-conversations-prod.ts v7_u02n04 2
 *   npx tsx scripts/foundation-v7-conversations-prod.ts 3
 */
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';
import {
  formatMs,
  parseFoundationV7ConversationArgs,
  runFoundationV7Conversation,
  SCENARIO_TITLES,
  type ScenarioRunResult,
} from './lib/foundation-v7-conversations-prod-runner';

const API_BASE = (
  process.env.API_BASE ?? 'https://banana-english-api-staging.up.railway.app'
).replace(/\/$/, '');

let simulationIds: string[];
let scenarios: number[];

try {
  ({ simulationIds, scenarios } = parseFoundationV7ConversationArgs(
    process.argv,
  ));
} catch (err) {
  console.error(
    'Usage: npx tsx scripts/foundation-v7-conversations-prod.ts [id ... | authored | frozen | all | ch2 | u03] [scenario 1-3]',
  );
  console.error(
    '       npx tsx scripts/foundation-v7-conversations-prod.ts foundation_v7_u02n04',
  );
  console.error(
    '       npx tsx scripts/foundation-v7-conversations-prod.ts u09 1',
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
  const dir = join(process.cwd(), 'foundation-v7-conversation-results', date);
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
  for (const [simulationId, rows] of byMission) {
    lines.push('', simulationId);
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
  console.log(`Conversations: ${simulationIds.join(', ')}`);
  console.log(`Scenarios: ${scenarios.join(', ')}`);
  for (const n of scenarios) {
    console.log(`  ${n}: ${SCENARIO_TITLES[n]}`);
  }
  log.takeBuffer();

  const results: ScenarioRunResult[] = [];
  let runIndex = 0;

  try {
    for (const simulationId of simulationIds) {
      for (const scenario of scenarios) {
        results.push(
          await runFoundationV7Conversation(
            API_BASE,
            simulationId,
            scenario,
            runIndex++,
          ),
        );
      }
      writeFileSync(
        join(log.dir, `${simulationId}.txt`),
        log.takeBuffer(),
        'utf8',
      );
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
