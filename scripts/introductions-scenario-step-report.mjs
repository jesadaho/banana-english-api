/**
 * Introductions — step-by-step lane report.
 * Usage:
 *   node --import tsx scripts/introductions-scenario-step-report.mjs 1
 *   node --import tsx scripts/introductions-scenario-step-report.mjs 2
 *   … scenarios 1–5
 */
import { performance } from 'node:perf_hooks';
import { buildChoiceLessonAfterUser, boardToScriptTurn, pinChoiceLessonAiReply, choiceLessonEffectiveProgress } from '../src/training/scripts/choice-lesson.script.ts';
import { extractIntroducedName } from '../src/training/foundation/foundation.helpers.ts';
import { FOUNDATION_POOLGATE_FIXTURES } from '../src/training/foundation/foundation-poolgate.fixtures.ts';
import {
  expectedInPoolSpeech,
  getDef,
  introductionsOutOfPoolNearMiss,
  introductionsOutOfPoolCloseMiss,
  introductionsOutOfPoolWrong,
  introductionsOutOfPoolWrongAgain,
  mockGeminiReply,
} from '../src/training/foundation/foundation-poolgate.harness.ts';

const LEARNER = 'Nana';
const scenarioArg = process.argv[2] ?? '1';
const scenario = Number(scenarioArg);

if (!Number.isInteger(scenario) || scenario < 1 || scenario > 5) {
  console.error('Usage: node --import tsx scripts/introductions-scenario-step-report.mjs <1-5>');
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
  if (tier === 'close') return gemini ? 'close out pool' : 'close';
  if (tier === 'incorrect') {
    if (/คำตอบนี้เราพูดว่า/.test(reply.textEn ?? '')) return 'wrong (soft-advance)';
    return gemini ? 'incorrect out pool' : 'wrong';
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

function chromeBeforeAnswer(turns, sessionProgressTurn) {
  const step =
    choiceLessonEffectiveProgress(def, turns, sessionProgressTurn) + 1;
  const board = boardForChrome(step, turns);
  if (!board) return formatChrome(null);
  const scripted = boardToScriptTurn(board);
  const chrome = formatChrome(scripted);
  if (chrome.choices === '(none)' && board.options?.length) {
    chrome.choices = `${board.options
      .map((o) => `${o.emoji ?? '·'} ${o.label ?? o.speak} → "${o.speak}"`)
      .join('\n         ')} (repeat-only)`;
  }
  return chrome;
}

function makeRow({
  step,
  aiPrompt,
  userText,
  turnsBeforeUser,
  result,
  ms,
  aiReply,
  nextReply,
  sessionProgressTurn,
}) {
  const promptChrome = chromeBeforeAnswer(turnsBeforeUser, sessionProgressTurn);
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
function runScenario1Steps() {
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

function pinGeminiAssess(turns, tier, praise, sessionProgressTurn) {
  return pinChoiceLessonAiReply(
    def,
    turns,
    mockGeminiReply(tier, praise),
    sessionProgressTurn,
    LEARNER,
  );
}

const GEMINI_PREFIX = {
  correct: 'ถูกต้องแล้วครับ! เก่งมากครับ',
  close: 'เกือบเป๊ะครับ! ไปต่อกันเลย',
  incorrect: 'ยังไม่ใช่นะครับ ลองพูดว่า',
};

/** Every step: out-of-pool → defer → pinned Gemini assess → advance. */
function runScenarioAllOutOfPoolGemini(outOfPoolFn, { tier, recoverAfterIncorrect = false }) {
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
  let sessionProgressTurn = 1;
  let reportStep = 0;

  for (let step = 1; step <= def.maxStep; step++) {
    const turnsBeforeUser = turns.map((t) => ({ ...t }));
    const exact = expectedInPoolSpeech(def, step, turns, LEARNER);
    const userText = outOfPoolFn(exact, step);
    const turnsWithUser = [...turns, { speaker: 'user', textEn: userText }];

    const t0 = performance.now();
    const route = buildChoiceLessonAfterUser(def, {
      turns: turnsWithUser,
      learnerFirstName: LEARNER,
      sessionProgressTurn,
    });
    const msRoute = performance.now() - t0;

    if (!route?.deferToAi) {
      throw new Error(
        `step ${step}: expected defer for "${userText}", got ${route?.assessmentTier ?? 'null'}`,
      );
    }

    const tPin = performance.now();
    const pinned = pinGeminiAssess(
      turnsWithUser,
      tier,
      GEMINI_PREFIX[tier],
      sessionProgressTurn,
    );
    const msPin = performance.now() - tPin;

    reportStep++;
    rows.push(
      makeRow({
        step: reportStep,
        aiPrompt,
        userText,
        turnsBeforeUser,
        result: classifyResult(pinned, { gemini: true }),
        ms: msRoute + msPin,
        aiReply: pinned?.textEn ?? '',
        nextReply: pinned,
        sessionProgressTurn,
      }),
    );

    turns.push({ speaker: 'user', textEn: userText });
    turns.push({
      speaker: 'ai',
      textEn: pinned?.textEn ?? '',
      expectedSpeech: pinned?.expectedSpeech,
    });

    if (recoverAfterIncorrect) {
      turns.push({ speaker: 'user', textEn: exact });
      const tRec = performance.now();
      const recovery = buildChoiceLessonAfterUser(def, {
        turns,
        learnerFirstName: LEARNER,
        sessionProgressTurn,
      });
      const msRec = performance.now() - tRec;
      if (recovery?.deferToAi) {
        throw new Error(`step ${step}: recovery "${exact}" should be in-pool`);
      }
      reportStep++;
      rows.push(
        makeRow({
          step: reportStep,
          aiPrompt: pinned?.textEn ?? '',
          userText: exact,
          turnsBeforeUser: turns.slice(0, -1).map((t) => ({ ...t })),
          result: classifyResult(recovery, { gemini: false }),
          ms: msRec,
          aiReply: recovery?.textEn ?? '',
          nextReply: recovery,
          sessionProgressTurn,
        }),
      );
      turns.push({
        speaker: 'ai',
        textEn: recovery?.textEn ?? '',
        expectedSpeech: recovery?.expectedSpeech,
      });
      aiPrompt = recovery?.textEn ?? '';
    } else {
      aiPrompt = pinned?.textEn ?? '';
    }

    sessionProgressTurn++;
  }

  return rows;
}

function runScenario2Steps() {
  return runScenarioAllOutOfPoolGemini(introductionsOutOfPoolNearMiss, {
    tier: 'correct',
  });
}

function runScenario3Steps() {
  return runScenarioAllOutOfPoolGemini(introductionsOutOfPoolCloseMiss, {
    tier: 'close',
  });
}

/** Every step: out-of-pool wrong → incorrect → wrong again → soft-advance. */
function runScenarioAllOutOfPoolWrongThenSoftAdvance(
  wrongFn,
  wrongAgainFn,
) {
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
  let sessionProgressTurn = 1;
  let reportStep = 0;

  for (let step = 1; step <= def.maxStep; step++) {
    const turnsBeforeWrong = turns.map((t) => ({ ...t }));
    const exact = expectedInPoolSpeech(def, step, turns, LEARNER);
    const wrongText = wrongFn(exact, step);
    const turnsWithWrong = [...turns, { speaker: 'user', textEn: wrongText }];

    const t0 = performance.now();
    const route = buildChoiceLessonAfterUser(def, {
      turns: turnsWithWrong,
      learnerFirstName: LEARNER,
      sessionProgressTurn,
    });
    const msRoute = performance.now() - t0;

    if (!route?.deferToAi) {
      throw new Error(
        `step ${step}: expected defer for "${wrongText}", got ${route?.assessmentTier ?? 'null'}`,
      );
    }

    const tPin = performance.now();
    const pinned = pinGeminiAssess(
      turnsWithWrong,
      'incorrect',
      GEMINI_PREFIX.incorrect,
      sessionProgressTurn,
    );
    const msPin = performance.now() - tPin;

    reportStep++;
    rows.push(
      makeRow({
        step: reportStep,
        aiPrompt,
        userText: wrongText,
        turnsBeforeUser: turnsBeforeWrong,
        result: classifyResult(pinned, { gemini: true }),
        ms: msRoute + msPin,
        aiReply: pinned?.textEn ?? '',
        nextReply: pinned,
        sessionProgressTurn,
      }),
    );

    turns.push({ speaker: 'user', textEn: wrongText });
    turns.push({
      speaker: 'ai',
      textEn: pinned?.textEn ?? '',
      expectedSpeech: pinned?.expectedSpeech,
    });

    const wrongAgainText = wrongAgainFn(exact, step);
    const turnsBeforeAgain = turns.map((t) => ({ ...t }));
    turns.push({ speaker: 'user', textEn: wrongAgainText });

    const tSoft = performance.now();
    const soft = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName: LEARNER,
      sessionProgressTurn,
    });
    const msSoft = performance.now() - tSoft;

    if (soft?.deferToAi) {
      throw new Error(`step ${step}: 2nd wrong "${wrongAgainText}" should soft-advance`);
    }

    reportStep++;
    rows.push(
      makeRow({
        step: reportStep,
        aiPrompt: pinned?.textEn ?? '',
        userText: wrongAgainText,
        turnsBeforeUser: turnsBeforeAgain,
        result: classifyResult(soft, { gemini: false }),
        ms: msSoft,
        aiReply: soft?.textEn ?? '',
        nextReply: soft,
        sessionProgressTurn,
      }),
    );

    turns.push({
      speaker: 'ai',
      textEn: soft?.textEn ?? '',
      expectedSpeech: soft?.expectedSpeech,
    });
    aiPrompt = soft?.textEn ?? '';
    sessionProgressTurn++;
  }

  return rows;
}

function runScenario5Steps() {
  return runScenarioAllOutOfPoolWrongThenSoftAdvance(
    introductionsOutOfPoolWrong,
    introductionsOutOfPoolWrongAgain,
  );
}

function runScenario4Steps() {
  return runScenarioAllOutOfPoolGemini(introductionsOutOfPoolWrong, {
    tier: 'incorrect',
    recoverAfterIncorrect: true,
  });
}

const SCENARIO_TITLES = {
  1: 'Scenario 1 — in-pool correct ทุก step → จบบท',
  2: 'Scenario 2 — out-pool correct ทุก step → จบบท',
  3: 'Scenario 3 — out-pool close ทุก step → จบบท',
  4: 'Scenario 4 — out-pool wrong + in-pool พูดตาม recovery → จบบท',
  5: 'Scenario 5 — out-pool wrong + พูดตามผิดอีกครั้ง → soft-advance → จบบท',
};

function getRowsForScenario(n) {
  switch (n) {
    case 1:
      return runScenario1Steps();
    case 2:
      return runScenario2Steps();
    case 3:
      return runScenario3Steps();
    case 4:
      return runScenario4Steps();
    case 5:
      return runScenario5Steps();
    default:
      throw new Error(`unknown scenario ${n}`);
  }
}

function printReport(rows) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Introductions — ${SCENARIO_TITLES[scenario]}`);
  console.log(`Learner: ${LEARNER} · maxStep: ${def.maxStep}`);
  console.log('='.repeat(80));

  for (const r of rows) {
    const hint = r.hint === '(none)' ? '(none)' : r.hint;
    const choices =
      r.choices === '(none)'
        ? '(none)'
        : r.choices.replace(/ \(repeat-only — choice bar hidden\)/g, ' (repeat-only)');
    console.log(`\nStep ${r.step}`);
    console.log(`AI: ${fullText(r.aiPrompt)}`);
    console.log(`Hint: ${hint}`);
    console.log(`Choices: ${choices}`);
    console.log(`User: ${fullText(r.userText)}`);
    console.log(`Result: ${r.result}`);
    console.log(`response time : ${formatMs(r.ms)}`);
    console.log(`Reply: ${fullText(r.aiReply)}`);
  }

  const totalMs = rows.reduce((s, row) => s + row.ms, 0);
  console.log(`\n${'-'.repeat(80)}`);
  console.log(
    `Turns: ${rows.length} · Total engine time: ${formatMs(totalMs)} · Avg: ${formatMs(totalMs / rows.length)}`,
  );
}

const rows = getRowsForScenario(scenario);
printReport(rows);
