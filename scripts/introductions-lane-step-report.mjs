/**
 * Introductions — step-by-step lane report.
 * Usage:
 *   node --import tsx scripts/introductions-lane-step-report.mjs 1
 *   node --import tsx scripts/introductions-lane-step-report.mjs 2
 *   … lanes 1–5
 */
import { performance } from 'node:perf_hooks';
import { buildChoiceLessonAfterUser, boardToScriptTurn } from '../src/training/scripts/choice-lesson.script.ts';
import { extractIntroducedName } from '../src/training/foundation/foundation.helpers.ts';
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

function formatChrome(reply) {
  if (!reply) {
    return { hint: '(none)', choices: '(none)', expected: '(none)' };
  }
  const gs = reply.guidedSpeaking;
  const stem = gs?.stem?.trim() ?? '';
  const options = gs?.options ?? [];
  const hint = stem || '(none)';
  const choices =
    options.length > 0
      ? options
          .map((o) => `${o.emoji ?? '·'} ${o.label ?? o.speak} → "${o.speak}"`)
          .join('\n            ')
      : '(none)';
  const expected = reply.expectedSpeech?.trim() || '(none)';
  return { hint, choices, expected };
}

function boardForChrome(step, turns) {
  const name = extractIntroducedName(turns, LEARNER);
  const history =
    extractIntroducedName(turns) === name
      ? turns
      : [...turns, { speaker: 'user', textEn: `My name is ${name}.` }];
  return def.boardForStep(step, history);
}

function chromeBeforeAnswer(turns) {
  const step = def.progressFn(turns) + 1;
  const board = boardForChrome(step, turns);
  if (!board) return formatChrome(null);
  const scripted = boardToScriptTurn(board);
  const chrome = formatChrome(scripted);
  if (chrome.choices === '(none)' && board.options?.length) {
    chrome.choices = `${board.options
      .map((o) => `${o.emoji ?? '·'} ${o.label ?? o.speak} → "${o.speak}"`)
      .join('\n            ')} (repeat-only — choice bar hidden)`;
  }
  return chrome;
}

function makeRow({ step, aiPrompt, userText, turnsBeforeUser, result, ms, aiReply, nextReply }) {
  const promptChrome = chromeBeforeAnswer(turnsBeforeUser);
  const nextChrome = formatChrome(nextReply);
  return {
    step,
    aiPrompt,
    userText,
    result,
    ms,
    aiReply,
    hint: promptChrome.hint,
    choices: promptChrome.choices,
    expected: promptChrome.expected,
    nextHint: nextChrome.hint,
    nextChoices: nextChrome.choices,
    nextExpected: nextChrome.expected,
  };
}

/** @returns {ReturnType<typeof makeRow>[]} */
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
    const turnsBeforeUser = turns.map((t) => ({ ...t }));
    const userText = expectedInPoolSpeech(def, step, turns, LEARNER);
    turns.push({ speaker: 'user', textEn: userText });

    const t0 = performance.now();
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
    const ms = performance.now() - t0;

    rows.push(
      makeRow({
        step,
        aiPrompt,
        userText,
        turnsBeforeUser,
        result: classifyResult(reply),
        ms,
        aiReply: reply?.textEn ?? '',
        nextReply: reply,
      }),
    );

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
    const turnsBeforeUser = turns.map((t) => ({ ...t }));
    const userText = expectedInPoolSpeech(def, step, turns, LEARNER);
    turns.push({ speaker: 'user', textEn: userText });
    const t0 = performance.now();
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
    const ms = performance.now() - t0;
    rows.push(
      makeRow({
        step,
        aiPrompt,
        userText,
        turnsBeforeUser,
        result: classifyResult(reply),
        ms,
        aiReply: reply?.textEn ?? '',
        nextReply: reply,
      }),
    );
    turns.push({ speaker: 'ai', textEn: reply?.textEn ?? '', expectedSpeech: reply?.expectedSpeech });
    aiPrompt = reply?.textEn ?? '';
  }

  // probe step
  const turnsBeforeProbe = turns.map((t) => ({ ...t }));
  turns.push({ speaker: 'user', textEn: probeUserText });
  const tProbe = performance.now();
  let probeReply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
  const msProbe = performance.now() - tProbe;

  if (probeReply?.deferToAi && afterProbe) {
    rows.push(
      makeRow({
        step: probeStep,
        aiPrompt,
        userText: probeUserText,
        turnsBeforeUser: turnsBeforeProbe,
        result: classifyResult(probeReply),
        ms: msProbe,
        aiReply: '(defer → Gemini)',
        nextReply: null,
      }),
    );
    const tPin = performance.now();
    probeReply = afterProbe();
    const msPin = performance.now() - tPin;
    rows.push(
      makeRow({
        step: probeStep,
        aiPrompt: '(Gemini assess)',
        userText: probeUserText,
        turnsBeforeUser: [...turnsBeforeProbe, { speaker: 'user', textEn: probeUserText }],
        result: classifyResult(probeReply, { gemini: true }),
        ms: msPin,
        aiReply: probeReply?.textEn ?? '',
        nextReply: probeReply,
      }),
    );
    turns.push({ speaker: 'ai', textEn: probeReply?.textEn ?? '', expectedSpeech: probeReply?.expectedSpeech });
    aiPrompt = probeReply?.textEn ?? '';
  } else {
    rows.push(
      makeRow({
        step: probeStep,
        aiPrompt,
        userText: probeUserText,
        turnsBeforeUser: turnsBeforeProbe,
        result: classifyResult(probeReply),
        ms: msProbe,
        aiReply: probeReply?.textEn ?? '',
        nextReply: probeReply,
      }),
    );
    turns.push({ speaker: 'ai', textEn: probeReply?.textEn ?? '', expectedSpeech: probeReply?.expectedSpeech });
    aiPrompt = probeReply?.textEn ?? '';
  }

  for (let step = probeStep + 1; step <= def.maxStep; step++) {
    const turnsBeforeUser = turns.map((t) => ({ ...t }));
    const userText = expectedInPoolSpeech(def, step, turns, LEARNER);
    turns.push({ speaker: 'user', textEn: userText });
    const t0 = performance.now();
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
    const ms = performance.now() - t0;
    rows.push(
      makeRow({
        step,
        aiPrompt,
        userText,
        turnsBeforeUser,
        result: classifyResult(reply),
        ms,
        aiReply: reply?.textEn ?? '',
        nextReply: reply,
      }),
    );
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

  const turnsBeforeWrong1 = [...base];
  const turns1 = [...base, { speaker: 'user', textEn: fixture.wrongAtProbe }];
  const t1 = performance.now();
  const route1 = buildChoiceLessonAfterUser(def, { turns: turns1, learnerFirstName: LEARNER });
  const ms1 = performance.now() - t1;
  rows.push(
    makeRow({
      step: probeStep,
      aiPrompt,
      userText: fixture.wrongAtProbe,
      turnsBeforeUser: turnsBeforeWrong1,
      result: classifyResult(route1),
      ms: ms1,
      aiReply: '(defer → Gemini)',
      nextReply: null,
    }),
  );

  const tPin1 = performance.now();
  const pin1 = pinGeminiAtProbe(def, fixture, fixture.wrongAtProbe, 'incorrect', 'ลองพูดตามนะครับ', LEARNER);
  const msPin1 = performance.now() - tPin1;
  rows.push(
    makeRow({
      step: probeStep,
      aiPrompt: '(Gemini assess)',
      userText: fixture.wrongAtProbe,
      turnsBeforeUser: turns1,
      result: classifyResult(pin1, { gemini: true }),
      ms: msPin1,
      aiReply: pin1.textEn ?? '',
      nextReply: pin1,
    }),
  );

  aiPrompt = pin1.textEn ?? '';
  const turnsBeforeWrong2 = [
    ...base,
    { speaker: 'user', textEn: fixture.wrongAtProbe },
    { speaker: 'ai', textEn: pin1.textEn ?? '' },
  ];
  const turns2 = [...turnsBeforeWrong2, { speaker: 'user', textEn: fixture.wrongAgainAtProbe }];
  const t2 = performance.now();
  const soft = buildChoiceLessonAfterUser(def, { turns: turns2, learnerFirstName: LEARNER });
  const ms2 = performance.now() - t2;
  rows.push(
    makeRow({
      step: probeStep,
      aiPrompt,
      userText: fixture.wrongAgainAtProbe,
      turnsBeforeUser: turnsBeforeWrong2,
      result: classifyResult(soft),
      ms: ms2,
      aiReply: soft?.textEn ?? '',
      nextReply: soft,
    }),
  );

  const turns = [
    ...turns2,
    { speaker: 'ai', textEn: soft?.textEn ?? '', expectedSpeech: soft?.expectedSpeech },
  ];
  aiPrompt = soft?.textEn ?? '';

  for (let step = probeStep + 1; step <= def.maxStep; step++) {
    const turnsBeforeUser = turns.map((t) => ({ ...t }));
    const userText = expectedInPoolSpeech(def, step, turns, LEARNER);
    turns.push({ speaker: 'user', textEn: userText });
    const t0 = performance.now();
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName: LEARNER });
    const ms = performance.now() - t0;
    rows.push(
      makeRow({
        step,
        aiPrompt,
        userText,
        turnsBeforeUser,
        result: classifyResult(reply),
        ms,
        aiReply: reply?.textEn ?? '',
        nextReply: reply,
      }),
    );
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
    console.log(`  Hint:     ${r.hint}`);
    console.log(`  Choices:  ${r.choices}`);
    console.log(`  Expected: ${r.expected}`);
    console.log(`  User:     ${fullText(r.userText)}`);
    console.log(`  Result:   ${r.result}`);
    console.log(`  Response: ${formatMs(r.ms)}`);
    console.log(`  Reply:    ${fullText(r.aiReply)}`);
    if (r.nextExpected !== '(none)') {
      console.log(`  Next hint:     ${r.nextHint}`);
      console.log(`  Next choices:  ${r.nextChoices}`);
      console.log(`  Next expected: ${r.nextExpected}`);
    }
  }

  const totalMs = rows.reduce((s, row) => s + row.ms, 0);
  console.log(`\n${'-'.repeat(80)}`);
  console.log(
    `Turns: ${rows.length} · Total engine time: ${formatMs(totalMs)} · Avg: ${formatMs(totalMs / rows.length)}`,
  );
}

const rows = getRowsForLane(lane);
printReport(rows);
