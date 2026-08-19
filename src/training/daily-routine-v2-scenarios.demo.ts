/**
 * Demo script — Daily Routine v2 three lanes (exact / near / wrong#2).
 * Run: npx tsx src/training/daily-routine-v2-scenarios.demo.ts
 */
import { scriptedAiDebug } from '../common/ai-debug';
import { buildDailyRoutineAfterUser, buildDailyRoutineOpening } from './scripts/daily-routine.script';
import { resolveChoiceStepContext } from './engine/choice-step.resolver';
import { resolveTurnLane } from './engine/turn-lanes';
import {
  dailyRoutineProgress,
  scoreDailyRoutineStep,
} from '../lessons/lessons.data';

type Turn = { speaker: string; textEn?: string };

function laneLabel(tier: string, progressBefore: number, progressAfter: number): string {
  if (tier === 'exact') return 'Lane 1 — scripted (exact, no LLM)';
  if (progressAfter > progressBefore) return 'Lane 3 — scriptedAdvance (wrong #2, soft-advance)';
  return 'Lane 2 — scriptedSoftTeach (near / wrong #1, no LLM)';
}

function runScenario(name: string, userSpeech: string, setup: Turn[]) {
  const history: Turn[] = [
    { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
    ...setup,
    { speaker: 'user', textEn: userSpeech },
  ];
  const prior = history.slice(0, -1);
  const ctx = resolveChoiceStepContext(
    history,
    7,
    scoreDailyRoutineStep,
    dailyRoutineProgress,
  );
  const progressBefore = dailyRoutineProgress(prior);
  const progressAfter = dailyRoutineProgress(history);
  const lane = resolveTurnLane({
    tier: ctx.tier,
    attempt: ctx.attempt,
    nearMeansSemantic: false,
  });
  const reply = buildDailyRoutineAfterUser({
    turns: history,
    learnerFirstName: 'Nana',
  });
  const debug = scriptedAiDebug();

  console.log('\n' + '═'.repeat(72));
  console.log(`SCENARIO: ${name}`);
  console.log('─'.repeat(72));
  console.log(`User said     : "${userSpeech}"`);
  console.log(`Tier          : ${ctx.tier}`);
  console.log(`Attempt       : ${ctx.attempt}`);
  console.log(`Progress      : ${progressBefore} → ${progressAfter}`);
  console.log(`Resolve lane  : ${lane}`);
  console.log(`Effective     : ${laneLabel(ctx.tier, progressBefore, progressAfter)}`);
  console.log(`AI called?    : ${debug.source === 'scripted' ? 'NO (scripted)' : debug.source}`);
  console.log(`deferToAi?    : ${reply?.deferToAi ?? false}`);
  console.log('─'.repeat(72));
  console.log(`textEn        : ${reply?.textEn?.slice(0, 120)}${(reply?.textEn?.length ?? 0) > 120 ? '…' : ''}`);
  console.log(`expectedSpeech: ${reply?.expectedSpeech ?? '(none)'}`);
  console.log(`guidedSpeaking: ${reply?.guidedSpeaking?.stem ?? '(none)'}`);
  console.log(`isComplete    : ${reply?.isLessonComplete ?? false}`);
}

console.log('Daily Routine — Training Engine v2 — 3 scenario smoke test');
console.log('Lesson: ee_about_me_daily_routine');

runScenario('1) EXACT — I\'m ready', "I'm ready", []);

runScenario('2) NEAR — get up (vocab step, close miss)', 'get up', [
  { speaker: 'user', textEn: "I'm ready" },
  {
    speaker: 'ai',
    textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
  },
]);

runScenario('3) WRONG #2 — soft-advance after two wrong vocab answers', 'go to sleep', [
  { speaker: 'user', textEn: "I'm ready" },
  {
    speaker: 'ai',
    textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
  },
  { speaker: 'user', textEn: 'go to work' },
  { speaker: 'ai', textEn: 'ปกติแล้ว \'ตื่นนอน\' ในภาษาอังกฤษจะใช้คำว่า wake up ครับ ลองพูดตามนะครับ' },
]);

console.log('\n' + '═'.repeat(72));
console.log('Done — all 3 scenarios use scripted v2 (no Gemini).');
console.log('═'.repeat(72));
