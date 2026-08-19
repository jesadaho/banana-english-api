/**
 * Run Introductions PoolGate scenarios one-by-one with verbose output.
 * Usage: node --import tsx scripts/introductions-scenario-report.mjs
 */
import assert from 'node:assert/strict';
import { buildChoiceLessonAfterUser } from '../src/training/scripts/choice-lesson.script.ts';
import { FOUNDATION_POOLGATE_FIXTURES } from '../src/training/foundation/foundation-poolgate.fixtures.ts';
import {
  assertAdvancedFromProbe,
  assertOutOfPool,
  boardAtProbe,
  buildHistoryAtProbe,
  buildSoftAdvanceHistory,
  getDef,
  nextBoardAfterProbeExact,
  pinGeminiAtProbe,
  withProbeUser,
} from '../src/training/foundation/foundation-poolgate.harness.ts';

const LEARNER = 'Nana';
const fixture = FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === 'introductions');
if (!fixture) throw new Error('introductions fixture missing');

const def = getDef(fixture);

function hr(title) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

function snap(label, obj) {
  console.log(`\n--- ${label} ---`);
  if (!obj) {
    console.log('(null)');
    return;
  }
  const pick = {
    deferToAi: obj.deferToAi ?? false,
    aiMode: obj.aiMode ?? null,
    assessmentTier: obj.assessmentTier ?? null,
    expectedSpeech: obj.expectedSpeech ?? null,
    textEn: obj.textEn ?? null,
    guidedSpeaking: obj.guidedSpeaking
      ? obj.guidedSpeaking.options?.map((o) => o.speak)
      : null,
  };
  console.log(JSON.stringify(pick, null, 2));
}

function stepInfo() {
  const base = buildHistoryAtProbe(fixture, LEARNER);
  const step = def.progressFn(base) + 1;
  const probe = boardAtProbe(fixture, LEARNER);
  const next = nextBoardAfterProbeExact(fixture, LEARNER);
  console.log(`progress after setup: ${def.progressFn(base)}`);
  console.log(`probe step: ${step}`);
  console.log(`probe expectedSpeech: ${probe?.expectedSpeech ?? '(none)'}`);
  console.log(`probe textEn (first 120): ${(probe?.textEn ?? '').slice(0, 120)}…`);
  console.log(`next expectedSpeech: ${next?.expectedSpeech ?? '(none)'}`);
  console.log(`next textEn (first 120): ${(next?.textEn ?? '').slice(0, 120)}…`);
}

const results = [];

function runScenario(name, fn) {
  hr(name);
  try {
    stepInfo();
    fn();
    console.log('\n✅ PASS');
    results.push({ scenario: name, pass: true });
  } catch (err) {
    console.log('\n❌ FAIL');
    console.log(String(err?.message ?? err));
    if (err?.stack) console.log(err.stack.split('\n').slice(0, 4).join('\n'));
    results.push({ scenario: name, pass: false, error: String(err?.message ?? err) });
  }
}

runScenario('Scenario 1 — happy in-pool (exact scripted advance)', () => {
  const reply = buildChoiceLessonAfterUser(def, {
    turns: withProbeUser(fixture, fixture.exactAtProbe, LEARNER),
    learnerFirstName: LEARNER,
  });
  snap('route reply', reply);
  assert.ok(reply, 'missing in-pool reply');
  assert.notEqual(reply.deferToAi, true, 'should not defer');
  assert.equal(reply.assessmentTier, 'correct');
  assertAdvancedFromProbe(fixture, reply);
});

runScenario('Scenario 2 — out-pool + Gemini correct', () => {
  const base = buildHistoryAtProbe(fixture, LEARNER);
  assertOutOfPool(def, fixture, base);
  const route = buildChoiceLessonAfterUser(def, {
    turns: withProbeUser(fixture, fixture.outOfPoolAtProbe, LEARNER),
    learnerFirstName: LEARNER,
  });
  snap('route (should defer)', route);
  assert.equal(route?.deferToAi, true);
  assert.equal(route?.aiMode, 'assess');

  const pinned = pinGeminiAtProbe(
    def,
    fixture,
    fixture.outOfPoolAtProbe,
    'correct',
    'ถูกต้องแล้วครับ! เก่งมากครับ',
    LEARNER,
  );
  snap('pinned after Gemini correct', pinned);
  assertAdvancedFromProbe(fixture, pinned);
  assert.equal(pinned.assessmentTier, 'correct');
});

runScenario('Scenario 3 — out-pool + Gemini close', () => {
  const base = buildHistoryAtProbe(fixture, LEARNER);
  assertOutOfPool(def, fixture, base);
  const pinned = pinGeminiAtProbe(
    def,
    fixture,
    fixture.outOfPoolAtProbe,
    'close',
    'เกือบเป๊ะครับ! ไปต่อกันเลย',
    LEARNER,
  );
  snap('pinned after Gemini close', pinned);
  assertAdvancedFromProbe(fixture, pinned);
  assert.equal(pinned.assessmentTier, 'close');
});

runScenario('Scenario 4 — wrong + Gemini incorrect (pin + พูดตาม)', () => {
  const current = boardAtProbe(fixture, LEARNER);
  snap('probe board', current);
  const route = buildChoiceLessonAfterUser(def, {
    turns: withProbeUser(fixture, fixture.wrongAtProbe, LEARNER),
    learnerFirstName: LEARNER,
  });
  snap('route (should defer)', route);
  assert.equal(route?.deferToAi, true);

  const pinned = pinGeminiAtProbe(
    def,
    fixture,
    fixture.wrongAtProbe,
    'incorrect',
    'ยังไม่ใช่นะครับ ลองพูดว่า',
    LEARNER,
  );
  snap('pinned after Gemini incorrect', pinned);
  assert.equal(pinned.expectedSpeech, current.expectedSpeech);
  assert.match(pinned.textEn ?? '', /พูดตาม/);
  assert.equal(pinned.assessmentTier, 'incorrect');
});

runScenario('Scenario 5 — 2nd wrong soft-advance (engine regression)', () => {
  const next = nextBoardAfterProbeExact(fixture, LEARNER);
  const turns = buildSoftAdvanceHistory(fixture, LEARNER);
  console.log(`\nsoft-advance turn count: ${turns.length}`);
  turns.forEach((t, i) => {
    const tag = t.speaker === 'user' ? 'USER' : 'AI ';
    console.log(`  [${i + 1}] ${tag}: ${(t.textEn ?? '').slice(0, 100)}`);
  });

  const reply = buildChoiceLessonAfterUser(def, {
    turns,
    learnerFirstName: LEARNER,
  });
  snap('soft-advance reply', reply);
  assert.ok(reply, 'missing soft-advance reply');
  assert.notEqual(reply.deferToAi, true);
  assert.match(reply.textEn ?? '', /ตรงนี้พูดว่า/);
  assert.match(reply.textEn ?? '', /ไปต่อกันเลย —/);
  assert.equal(reply.expectedSpeech, next.expectedSpeech);
  assert.equal(reply.assessmentTier, 'incorrect');
});

hr('SUMMARY');
for (const r of results) {
  console.log(`${r.pass ? '✅' : '❌'} ${r.scenario}${r.error ? ` — ${r.error}` : ''}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
process.exit(failed > 0 ? 1 : 0);
