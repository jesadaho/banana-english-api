/**
 * Foundation PoolGate — all 16 lessons (incl. greetings), scenarios 1–5 against prod.
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/foundation-scenarios-prod.ts
 *
 *   npx tsx scripts/foundation-scenarios-prod.ts greetings 1
 *   npx tsx scripts/foundation-scenarios-prod.ts 3              # all lessons, scenario 3
 *   npx tsx scripts/foundation-scenarios-prod.ts introductions  # one lesson, all scenarios
 */
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

async function main(): Promise<void> {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`Lessons: ${lessonIds.join(', ')}`);
  console.log(`Scenarios: ${scenarios.join(', ')}`);
  for (const n of scenarios) {
    console.log(`  ${n}: ${SCENARIO_TITLES[n]}`);
  }

  const results: ScenarioRunResult[] = [];
  let runIndex = 0;

  for (const lessonId of lessonIds) {
    for (const scenario of scenarios) {
      results.push(
        await runFoundationScenario(API_BASE, lessonId, scenario, runIndex++),
      );
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const byLesson = new Map<string, ScenarioRunResult[]>();
  for (const r of results) {
    const list = byLesson.get(r.lessonId) ?? [];
    list.push(r);
    byLesson.set(r.lessonId, list);
  }

  for (const [lessonId, rows] of byLesson) {
    console.log(`\n${lessonId}`);
    for (const r of rows) {
      const line = r.ok
        ? `  ✅ Scenario ${r.scenario} — ${r.steps} steps · ${formatMs(r.totalMs)}`
        : `  ❌ Scenario ${r.scenario} — ${r.error}`;
      console.log(line);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\nTotal: ${results.length - failed.length}/${results.length} passed`,
  );

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
