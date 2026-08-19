/**
 * Introductions — all 5 PoolGate scenarios against prod (step-by-step report).
 *
 *   API_BASE=https://banana-english-api-production.up.railway.app \
 *     npx tsx scripts/introductions-scenarios-prod.ts
 *
 *   npx tsx scripts/introductions-scenarios-prod.ts 2   # single scenario
 *
 * @deprecated Prefer `npx tsx scripts/foundation-scenarios-prod.ts introductions [scenario]`
 */
import {
  formatMs,
  runFoundationScenario,
  type ScenarioRunResult,
} from './lib/foundation-scenarios-prod-runner';

const API_BASE = (
  process.env.API_BASE ?? 'https://banana-english-api-production.up.railway.app'
).replace(/\/$/, '');

const scenarioArg = process.argv[2];
const scenariosToRun: number[] = scenarioArg
  ? [Number(scenarioArg)]
  : [1, 2, 3, 4, 5];

if (scenariosToRun.some((n) => !Number.isInteger(n) || n < 1 || n > 5)) {
  console.error('Usage: npx tsx scripts/introductions-scenarios-prod.ts [1-5]');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`Running scenarios: ${scenariosToRun.join(', ')}`);

  const results: ScenarioRunResult[] = [];
  for (let i = 0; i < scenariosToRun.length; i++) {
    results.push(
      await runFoundationScenario(
        API_BASE,
        'introductions',
        scenariosToRun[i],
        i,
      ),
    );
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  for (const r of results) {
    const line = r.ok
      ? `✅ Scenario ${r.scenario} — ${r.steps} steps · ${formatMs(r.totalMs)}`
      : `❌ Scenario ${r.scenario} — ${r.error}`;
    console.log(line);
  }

  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
