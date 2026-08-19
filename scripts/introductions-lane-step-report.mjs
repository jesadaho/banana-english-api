/**
 * Introductions — step-by-step lane report.
 * Usage:
 *   node --import tsx scripts/introductions-lane-step-report.mjs 1
 *   node --import tsx scripts/introductions-lane-step-report.mjs 2
 *   … lanes 1–5
 */
import { performance } from 'node:perf_hooks';
import { buildChoiceLessonAfterUser } from '../src/training/scripts/choice-lesson.script.ts';
import { FOUNDATION_POOLGATE_FIXTURES } from '../src/training/foundation/foundation-poolgate.fixtures.ts';
import {
  buildHistoryAtProbe,
  buildSoftAdvanceHistory,
  expectedInPoolSpeech,
  getDef,
  pinGeminiAtProbe,
  withProbeUser,
} from '../src/training/foundation/foundation-poolgate.harness.ts';

const LEARNER = 'Nana';
const laneArg = process.argv[2] ?? '1';
const lane = Number(laneArg);

if (!Number.isInteger(lane) || lane < 1 || lane > 5) {
  console.error('Usage: node --import tsx scripts/introductions-lane-step-report.mjs <1-5>');
  process.exit(1);
}

const fixture = FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === 'introductions');
if (!fixture) throw new Error('introductions fixture missing');

const def = getDef(fixture);

function fullText(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function classifyResult(reply, { gemini = false } = {}) {
  if (!reply) return '—';
  if (reply.deferToAi) return '→ defer Gemini';
  const tier = reply.assessmentTier ?? 'correct';
  if (tier === 'correct' && gemini) return 'correct out pool';
  if (tier === 'correct') return 'correct in pool';
  if (tier === 'close') return 'close';
  if (tier === 'incorrect') {
    if (/คำตอบนี้เราพูดว่า/.test(reply.textEn ?? '')) return 'wrong (soft-advance)';
    return 'wrong';
  }
  return tier;
}

/** @returns {{ step: number, aiPrompt: string, userText: string, result: string, ms: number, aiReply: string }[]} */
function runLane1Steps() {
  const opening = def.buildOpening(LEARNER);
  const turns = [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];
  const rows = [];
  let aiPrompt = opening.textEn ?? '';

  for (let step = 1; step <= def.maxStep; step++) {
    const userText = expectedInPoolSpeech(def, step, turns, LEARNER);
    turns.push({ speaker: 'user', textEn: userText });

    const t0 = performance.now();
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
    const ms = performance.now() - t0;

    rows.push({
      step,
      aiPrompt,
      userText,
      result: classifyResult(reply),
      ms,
      aiReply: reply?.textEn ?? '',
    });

    turns.push({
      speaker: 'ai',
      textEn: reply?.textEn ?? '',
      expectedSpeech: reply?.expectedSpeech,
    });
    aiPrompt = reply?.textEn ?? '';
  }

  return rows;
}

/** Steps 1..probe-1 exact, probe uses lane-specific answer, then exact through end. */
function runLaneWithProbeAnswer(probeUserText, afterProbe) {
  const probeStep = def.progressFn(buildHistoryAtProbe(fixture, LEARNER)) + 1;
  const opening = def.buildOpening(LEARNER);
  const turns = [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];
  const rows = [];
  let aiPrompt = opening.textEn ?? '';

  for (let step = 1; step < probeStep; step++) {
    const userText = expectedInPoolSpeech(def, step, turns, LEARNER);
    turns.push({ speaker: 'user', textEn: userText });
    const t0 = performance.now();
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
    const ms = performance.now() - t0;
    rows.push({ step, aiPrompt, userText, result: classifyResult(reply), ms, aiReply: reply?.textEn ?? '' });
    turns.push({ speaker: 'ai', textEn: reply?.textEn ?? '', expectedSpeech: reply?.expectedSpeech });
    aiPrompt = reply?.textEn ?? '';
  }

  // probe step
  turns.push({ speaker: 'user', textEn: probeUserText });
  const tProbe = performance.now();
  let probeReply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
  const msProbe = performance.now() - tProbe;

  if (probeReply?.deferToAi && afterProbe) {
    rows.push({
      step: probeStep,
      aiPrompt,
      userText: probeUserText,
      result: classifyResult(probeReply),
      ms: msProbe,
      aiReply: '(defer → Gemini)',
    });
    const tPin = performance.now();
    probeReply = afterProbe();
    const msPin = performance.now() - tPin;
    rows.push({
      step: probeStep,
      aiPrompt: '(Gemini assess)',
      userText: probeUserText,
      result: classifyResult(probeReply, { gemini: true }),
      ms: msPin,
      aiReply: probeReply?.textEn ?? '',
    });
    turns.push({ speaker: 'ai', textEn: probeReply?.textEn ?? '', expectedSpeech: probeReply?.expectedSpeech });
    aiPrompt = probeReply?.textEn ?? '';
  } else {
    rows.push({
      step: probeStep,
      aiPrompt,
      userText: probeUserText,
      result: classifyResult(probeReply),
      ms: msProbe,
      aiReply: probeReply?.textEn ?? '',
    });
    turns.push({ speaker: 'ai', textEn: probeReply?.textEn ?? '', expectedSpeech: probeReply?.expectedSpeech });
    aiPrompt = probeReply?.textEn ?? '';
  }

  for (let step = probeStep + 1; step <= def.maxStep; step++) {
    const userText = expectedInPoolSpeech(def, step, turns, LEARNER);
    turns.push({ speaker: 'user', textEn: userText });
    const t0 = performance.now();
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
    const ms = performance.now() - t0;
    rows.push({ step, aiPrompt, userText, result: classifyResult(reply), ms, aiReply: reply?.textEn ?? '' });
    turns.push({ speaker: 'ai', textEn: reply?.textEn ?? '', expectedSpeech: reply?.expectedSpeech });
    aiPrompt = reply?.textEn ?? '';
  }

  return rows;
}

function runLane5Steps() {
  const probeStep = def.progressFn(buildHistoryAtProbe(fixture, LEARNER)) + 1;
  const opening = def.buildOpening(LEARNER);
  const base = buildHistoryAtProbe(fixture, LEARNER);
  const rows = [];
  let aiPrompt = base.at(-1)?.textEn ?? opening.textEn ?? '';

  // wrong #1
  const turns1 = [...base, { speaker: 'user', textEn: fixture.wrongAtProbe }];
  const t1 = performance.now();
  const route1 = buildChoiceLessonAfterUser(def, { turns: turns1, learnerFirstName: LEARNER });
  const ms1 = performance.now() - t1;
  rows.push({
    step: probeStep,
    aiPrompt,
    userText: fixture.wrongAtProbe,
    result: classifyResult(route1),
    ms: ms1,
    aiReply: '(defer → Gemini)',
  });

  const tPin1 = performance.now();
  const pin1 = pinGeminiAtProbe(def, fixture, fixture.wrongAtProbe, 'incorrect', 'ลองพูดตามนะครับ', LEARNER);
  const msPin1 = performance.now() - tPin1;
  rows.push({
    step: probeStep,
    aiPrompt: '(Gemini assess)',
    userText: fixture.wrongAtProbe,
    result: classifyResult(pin1, { gemini: true }),
    ms: msPin1,
    aiReply: pin1.textEn ?? '',
  });

  aiPrompt = pin1.textEn ?? '';
  const turns2 = [
    ...base,
    { speaker: 'user', textEn: fixture.wrongAtProbe },
    { speaker: 'ai', textEn: pin1.textEn ?? '' },
    { speaker: 'user', textEn: fixture.wrongAgainAtProbe },
  ];
  const t2 = performance.now();
  const soft = buildChoiceLessonAfterUser(def, { turns: turns2, learnerFirstName: LEARNER });
  const ms2 = performance.now() - t2;
  rows.push({
    step: probeStep,
    aiPrompt,
    userText: fixture.wrongAgainAtProbe,
    result: classifyResult(soft),
    ms: ms2,
    aiReply: soft?.textEn ?? '',
  });

  const turns = [
    ...turns2,
    { speaker: 'ai', textEn: soft?.textEn ?? '', expectedSpeech: soft?.expectedSpeech },
  ];
  aiPrompt = soft?.textEn ?? '';

  for (let step = probeStep + 1; step <= def.maxStep; step++) {
    const userText = expectedInPoolSpeech(def, step, turns, LEARNER);
    turns.push({ speaker: 'user', textEn: userText });
    const t0 = performance.now();
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
    const ms = performance.now() - t0;
    rows.push({ step, aiPrompt, userText, result: classifyResult(reply), ms, aiReply: reply?.textEn ?? '' });
    turns.push({ speaker: 'ai', textEn: reply?.textEn ?? '', expectedSpeech: reply?.expectedSpeech });
    aiPrompt = reply?.textEn ?? '';
  }

  return rows;
}

const LANE_TITLES = {
  1: 'Lane 1 — happy in-pool (exact ทุก step → จบบท)',
  2: 'Lane 2 — out-pool + Gemini correct (probe) → exact ต่อ',
  3: 'Lane 3 — out-pool + Gemini close (probe) → exact ต่อ',
  4: 'Lane 4 — wrong + Gemini incorrect (probe) → exact ต่อ',
  5: 'Lane 5 — wrong ×2 soft-advance (probe) → exact ต่อ',
};

function getRowsForLane(n) {
  switch (n) {
    case 1:
      return runLane1Steps();
    case 2:
      return runLaneWithProbeAnswer(fixture.outOfPoolAtProbe, () =>
        pinGeminiAtProbe(def, fixture, fixture.outOfPoolAtProbe, 'correct', 'ถูกต้องแล้วครับ! เก่งมากครับ', LEARNER),
      );
    case 3:
      return runLaneWithProbeAnswer(fixture.outOfPoolAtProbe, () =>
        pinGeminiAtProbe(def, fixture, fixture.outOfPoolAtProbe, 'close', 'เกือบเป๊ะครับ! ไปต่อกันเลย', LEARNER),
      );
    case 4:
      return runLaneWithProbeAnswer(fixture.wrongAtProbe, () =>
        pinGeminiAtProbe(def, fixture, fixture.wrongAtProbe, 'incorrect', 'ยังไม่ใช่นะครับ ลองพูดว่า', LEARNER),
      );
    case 5:
      return runLane5Steps();
    default:
      throw new Error(`unknown lane ${n}`);
  }
}

function printReport(rows) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Introductions — ${LANE_TITLES[lane]}`);
  console.log(`Learner: ${LEARNER} · maxStep: ${def.maxStep}`);
  console.log('='.repeat(80));

  for (const r of rows) {
    console.log(`\nStep ${r.step}`);
    console.log(`  AI:       ${fullText(r.aiPrompt)}`);
    console.log(`  User:     ${fullText(r.userText)}`);
    console.log(`  Result:   ${r.result}`);
    console.log(`  Response: ${formatMs(r.ms)}`);
    console.log(`  Reply:    ${fullText(r.aiReply)}`);
  }

  const totalMs = rows.reduce((s, row) => s + row.ms, 0);
  console.log(`\n${'-'.repeat(80)}`);
  console.log(
    `Turns: ${rows.length} · Total engine time: ${formatMs(totalMs)} · Avg: ${formatMs(totalMs / rows.length)}`,
  );
}

const rows = getRowsForLane(lane);
printReport(rows);
