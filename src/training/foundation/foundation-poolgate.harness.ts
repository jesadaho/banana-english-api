import assert from 'node:assert/strict';
import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import {
  buildChoiceLessonAfterUser,
  choiceLessonEffectiveProgress,
  isRepeatOnlyBoard,
  pinChoiceLessonAiReply,
  type ChoiceLessonBoard,
  type ChoiceLessonDef,
} from '../scripts/choice-lesson.script';

export { pinChoiceLessonAiReply };
import { getFoundationChoiceLesson } from '../scripts/foundation.registry';
import type { FoundationPoolGateFixture } from './foundation-poolgate.fixtures';
import { FOUNDATION_PROBE_LEARNER } from './foundation-poolgate.fixtures';

export type Turn = {
  speaker: string;
  textEn?: string;
  expectedSpeech?: string | null;
  assessmentTier?: 'correct' | 'close' | 'incorrect';
  wasSoftAdvance?: boolean;
  guidedSpeaking?: { options?: Array<{ speak?: string }> } | null;
};

export function getDef(fixture: FoundationPoolGateFixture): ChoiceLessonDef {
  const def = getFoundationChoiceLesson(fixture.lessonId);
  if (!def) {
    throw new Error(`missing foundation def: ${fixture.lessonId}`);
  }
  return def;
}

/** Replay exact in-pool answers until the probe step AI line is shown. */
export function buildHistoryAtProbe(
  fixture: FoundationPoolGateFixture,
  name = FOUNDATION_PROBE_LEARNER,
): Turn[] {
  const def = getDef(fixture);
  const opening = def.buildOpening(name);
  const turns: Turn[] = [
    {
      speaker: 'ai',
      textEn: opening.textEn,
      expectedSpeech: opening.expectedSpeech,
    },
  ];

  for (const exact of fixture.setupExact) {
    turns.push({ speaker: 'user', textEn: exact });
    const reply = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName: name,
    });
    if (!reply || reply.deferToAi) {
      throw new Error(
        `${fixture.lessonId}: setup "${exact}" should be in-pool scripted`,
      );
    }
    turns.push({
      speaker: 'ai',
      textEn: reply.textEn,
      expectedSpeech: reply.expectedSpeech,
    });
  }

  return turns;
}

export function boardAtProbe(
  fixture: FoundationPoolGateFixture,
  name = FOUNDATION_PROBE_LEARNER,
): ChoiceLessonBoard | null {
  const def = getDef(fixture);
  const base = buildHistoryAtProbe(fixture, name);
  const step = def.progressFn(base) + 1;
  return def.boardForStep(step, base);
}

/** Board shown after a successful exact answer at the probe step. */
export function nextBoardAfterProbeExact(
  fixture: FoundationPoolGateFixture,
  name = FOUNDATION_PROBE_LEARNER,
): ChoiceLessonBoard | null {
  const def = getDef(fixture);
  const turns = withProbeUser(fixture, fixture.exactAtProbe, name);
  const cleared = def.progressFn(turns);
  return def.boardForStep(cleared + 1, turns);
}

export function assertOutOfPool(
  def: ChoiceLessonDef,
  fixture: FoundationPoolGateFixture,
  turns: Turn[],
): void {
  const step = def.progressFn(turns) + 1;
  const tier = def.scoreStep(step, fixture.outOfPoolAtProbe, turns);
  if (tier === 'exact') {
    throw new Error(
      `${fixture.lessonId}: outOfPoolAtProbe must not be exact`,
    );
  }
}

export function mockGeminiReply(
  tier: 'correct' | 'close' | 'incorrect',
  textEn: string,
): TrainingTurnReply {
  return {
    textEn,
    textTh: tier === 'incorrect' ? 'Try again.' : 'Nice!',
    isLessonComplete: false,
    expectsUserSpeech: true,
    assessmentTier: tier,
  };
}

export function withProbeUser(
  fixture: FoundationPoolGateFixture,
  userText: string,
  name = FOUNDATION_PROBE_LEARNER,
): Turn[] {
  return [...buildHistoryAtProbe(fixture, name), { speaker: 'user', textEn: userText }];
}

export function pinGeminiAtProbe(
  def: ChoiceLessonDef,
  fixture: FoundationPoolGateFixture,
  userText: string,
  tier: 'correct' | 'close' | 'incorrect',
  praiseEn: string,
  name = FOUNDATION_PROBE_LEARNER,
): TrainingTurnReply {
  const turns = withProbeUser(fixture, userText, name);
  return pinChoiceLessonAiReply(
    def,
    turns,
    mockGeminiReply(tier, praiseEn),
    undefined,
    name,
  );
}

export function buildSoftAdvanceHistory(
  fixture: FoundationPoolGateFixture,
  name = FOUNDATION_PROBE_LEARNER,
): Turn[] {
  const def = getDef(fixture);
  const turns: Turn[] = [
    ...buildHistoryAtProbe(fixture, name),
    { speaker: 'user', textEn: fixture.wrongAtProbe },
  ];
  const incorrect = pinGeminiAtProbe(
    def,
    fixture,
    fixture.wrongAtProbe,
    'incorrect',
    `ลองพูดตามนะครับ "${fixture.exactAtProbe.replace(/\.$/, '')}"`,
    name,
  );
  turns.push({ speaker: 'ai', textEn: incorrect.textEn ?? '' });
  turns.push({ speaker: 'user', textEn: fixture.wrongAgainAtProbe });
  return turns;
}

/** Assert reply advances to the board after probe step (by expectedSpeech). */
export function assertAdvancedFromProbe(
  fixture: FoundationPoolGateFixture,
  reply: { expectedSpeech?: string | null; textEn?: string | null },
): void {
  const current = boardAtProbe(fixture);
  const next = nextBoardAfterProbeExact(fixture);
  assert.ok(current?.expectedSpeech, `${fixture.lessonId}: missing probe board`);
  assert.ok(next?.expectedSpeech, `${fixture.lessonId}: missing next board`);
  assert.equal(
    reply.expectedSpeech,
    next!.expectedSpeech,
    `${fixture.lessonId}: expectedSpeech should advance`,
  );
  assert.notEqual(
    reply.expectedSpeech,
    current!.expectedSpeech,
    `${fixture.lessonId}: should not stay on probe board`,
  );
}

export type FullHappyPathStep = {
  step: number;
  userText: string;
  aiTextEn: string;
  expectedSpeech: string | null;
  progressAfter: number;
  isLessonComplete: boolean;
};

export type FullHappyPathResult = {
  turns: Turn[];
  steps: FullHappyPathStep[];
  completionText: string;
};

/** Expected in-pool speech for a step (step 1 uses opening name, not replay 'Ben'). */
export function expectedInPoolSpeech(
  def: ChoiceLessonDef,
  step: number,
  turns: Turn[],
  learnerFirstName = FOUNDATION_PROBE_LEARNER,
): string {
  const board = def.boardForStep(step, turns);
  assert.ok(board?.expectedSpeech, `${def.lessonId} step ${step}: missing board`);
  if (step === 1) {
    return (
      def.buildOpening(learnerFirstName).expectedSpeech ?? board.expectedSpeech
    );
  }
  return board.expectedSpeech;
}

/** Replay exact in-pool answers until `clearedSteps` steps are cleared (0 = opening only). */
export function buildExactHistoryThroughProgress(
  def: ChoiceLessonDef,
  clearedSteps: number,
  learnerFirstName = FOUNDATION_PROBE_LEARNER,
): Turn[] {
  const opening = def.buildOpening(learnerFirstName);
  const turns: Turn[] = [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];

  for (let step = 1; step <= clearedSteps; step++) {
    const userText = expectedInPoolSpeech(def, step, turns, learnerFirstName);
    turns.push({ speaker: 'user', textEn: userText });
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName });
    assert.ok(reply, `${def.lessonId}: step ${step} setup reply missing`);
    assert.notEqual(
      reply.deferToAi,
      true,
      `${def.lessonId}: step ${step} setup should be in-pool`,
    );
    turns.push({
      speaker: 'ai',
      textEn: reply.textEn ?? '',
      expectedSpeech: reply.expectedSpeech,
    });
  }

  assert.equal(
    def.progressFn(turns),
    clearedSteps,
    `${def.lessonId}: history should clear ${clearedSteps} steps`,
  );
  return turns;
}

/** Assert each happy-path step cleared progress and chained expectedSpeech to the next board. */
export function assertFullHappyPathStepChain(
  def: ChoiceLessonDef,
  result: FullHappyPathResult,
  learnerFirstName = FOUNDATION_PROBE_LEARNER,
): void {
  assert.equal(result.steps.length, def.maxStep, `${def.lessonId}: step count`);

  const opening = def.buildOpening(learnerFirstName);
  const turns: Turn[] = [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];

  for (const record of result.steps) {
    const { step } = record;
    assert.equal(
      def.progressFn(turns),
      step - 1,
      `${def.lessonId} step ${step}: progress before answer`,
    );

    const board = def.boardForStep(step, turns);
    assert.ok(board?.expectedSpeech, `${def.lessonId} step ${step}: board missing`);
    assert.equal(
      record.userText,
      expectedInPoolSpeech(def, step, turns, learnerFirstName),
      `${def.lessonId} step ${step}: user answer`,
    );

    turns.push({ speaker: 'user', textEn: record.userText });
    assert.equal(
      def.progressFn(turns),
      step,
      `${def.lessonId} step ${step}: progress after answer`,
    );
    assert.equal(
      record.progressAfter,
      step,
      `${def.lessonId} step ${step}: recorded progress`,
    );

    if (step < def.maxStep) {
      const nextBoard = def.boardForStep(step + 1, turns);
      assert.ok(
        nextBoard?.expectedSpeech,
        `${def.lessonId} step ${step}: next board missing`,
      );
      assert.equal(
        record.expectedSpeech,
        nextBoard.expectedSpeech,
        `${def.lessonId} step ${step}: expectedSpeech should preview next board`,
      );
      assert.equal(record.isLessonComplete, false);
    } else {
      assert.equal(record.isLessonComplete, true);
    }

    turns.push({ speaker: 'ai', textEn: record.aiTextEn });
  }

  assert.equal(def.progressFn(turns), def.maxStep);
}

/** Exact in-pool answers for every step 1..maxStep; asserts scripted advance through completion. */
export function runFoundationFullHappyPath(
  def: ChoiceLessonDef,
  learnerFirstName = FOUNDATION_PROBE_LEARNER,
): FullHappyPathResult {
  const opening = def.buildOpening(learnerFirstName);
  const turns: Turn[] = [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];
  const steps: FullHappyPathStep[] = [];

  for (let step = 1; step <= def.maxStep; step++) {
    const progressBefore = def.progressFn(turns);
    assert.equal(
      progressBefore,
      step - 1,
      `${def.lessonId} step ${step}: progress before answer`,
    );

    const userText = expectedInPoolSpeech(def, step, turns, learnerFirstName);
    turns.push({ speaker: 'user', textEn: userText });

    const reply = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName,
    });
    assert.ok(reply, `${def.lessonId} step ${step}: missing reply`);
    assert.notEqual(
      reply.deferToAi,
      true,
      `${def.lessonId} step ${step}: in-pool should not defer`,
    );
    assert.equal(
      reply.assessmentTier ?? 'correct',
      'correct',
      `${def.lessonId} step ${step}: expected correct tier`,
    );

    const progressAfter = def.progressFn(turns);
    assert.equal(
      progressAfter,
      step,
      `${def.lessonId} step ${step}: progress after answer`,
    );

    if (step < def.maxStep) {
      const nextBoard = def.boardForStep(step + 1, turns);
      assert.equal(
        reply.expectedSpeech,
        nextBoard?.expectedSpeech,
        `${def.lessonId} step ${step}: expectedSpeech chain`,
      );
      assert.deepEqual(
        reply.guidedSpeaking?.options,
        nextBoard?.options.length ? nextBoard.options : undefined,
        `${def.lessonId} step ${step}: choices must match next step`,
      );
    }

    steps.push({
      step,
      userText,
      aiTextEn: reply.textEn ?? '',
      expectedSpeech: reply.expectedSpeech ?? null,
      progressAfter,
      isLessonComplete: reply.isLessonComplete ?? false,
    });
    turns.push({
      speaker: 'ai',
      textEn: reply.textEn ?? '',
      expectedSpeech: reply.expectedSpeech,
    });
  }

  const last = steps.at(-1)!;
  assert.equal(
    last.progressAfter,
    def.maxStep,
    `${def.lessonId}: should clear all ${def.maxStep} steps`,
  );
  assert.equal(
    last.isLessonComplete,
    true,
    `${def.lessonId}: final reply should complete lesson`,
  );
  assert.match(
    last.aiTextEn,
    /สุดยอด/,
    `${def.lessonId}: completion should include celebrate copy`,
  );

  const result = { turns, steps, completionText: last.aiTextEn };
  assertFullHappyPathStepChain(def, result, learnerFirstName);
  return result;
}

export function outOfPoolEllipsisAnswer(exact: string): string {
  return exact.replace(/[.!?…]+$/g, '') + '....';
}

/** STT near-miss for Introductions scenario 2: wrong name (Nano) or trailing .... */
export function introductionsOutOfPoolNearMiss(
  exact: string,
  _step?: number,
): string {
  if (/nana/i.test(exact)) {
    return exact.replace(/Nana/gi, 'Nano');
  }
  return outOfPoolEllipsisAnswer(exact);
}

/** Generic close-miss for Foundation scenario 3 (non-Introductions lessons). */
export function foundationOutOfPoolCloseMiss(
  exact: string,
  step: number,
  lessonId: string,
): string {
  if (lessonId === 'introductions') {
    return introductionsOutOfPoolCloseMiss(exact, step);
  }

  if (lessonId === 'greetings') {
    const closeByStep: Record<number, string> = {
      1: 'Helo',
      2: 'Hii',
      3: 'Hii',
      4: 'Good mornin',
      5: 'Good after',
      6: 'Good evenin',
      7: 'Good mornin',
      8: 'Helo',
    };
    return closeByStep[step] ?? 'Helo';
  }

  if (lessonId === 'yes_no_maybe') {
    switch (step) {
      case 1:
        return 'Yeah, I do.';
      case 2:
        return 'Yes I.';
      case 3:
        return 'No, I dont.';
      case 4:
        return 'No I.';
      default:
        return 'Maybee.';
    }
  }

  const closeByLesson: Partial<Record<string, Record<number, string>>> = {
    polite_expressions: { 1: 'Thank you very.', 2: 'You welcome.', 3: 'Excuse.', 4: 'Thank.', 5: 'I sorry.' },
    meet_people: {
      1: 'I new here.',
      2: 'I excited.',
      3: 'You my classmate.',
      4: 'You very kind.',
      5: 'I new here. You my classmate.',
    },
    talk_about_groups: {
      1: 'He my classmate.',
      2: 'She my teacher.',
      3: 'It my bag.',
      4: 'She very kind.',
      5: 'He very kind. It new.',
    },
    ee_about_me_family: { 1: 'brotha', 2: 'motha', 3: 'fatha', 4: 'This my father.', 5: 'This my sister.', 6: 'I have brother.', 7: 'I have two sister.', 8: 'This my father.' },
    numbers: {
      1: 'for',
      2: 'seben',
      3: 'eit',
      4: 'eit',
    },
    fnd_v2_numbers_11_20: {
      1: 'four teen',
      2: 'twentee',
      3: 'eigh teen',
      4: 'six teen',
      5: 'twelb',
    },
    fnd_v2_say_it_again: {
      1: 'Can you say again?',
      2: 'How you say this in English?',
      3: 'Can you say again?',
      4: 'How you say this English?',
      5: 'Can you speak slowly?',
    },
    fnd_v2_buying_something: {
      1: 'I want.',
      2: 'I want waters.',
      3: 'I want blue bag.',
      4: 'I take it.',
      5: 'That too expensive.',
      6: 'I take it.',
    },
    telling_time: { 1: "It's six clock.", 2: "It's seven thirty clock.", 3: "It's seven.", 4: "It's nine.", 5: "It's seven morning." },
    everyday_numbers: {
      1: 'fourty',
      2: 'fivty',
      3: 'eightty',
      4: 'sebenty',
      5: 'thirty fiv',
      6: 'sixty tw',
    },
    money_prices: {
      1: 'How much it is?',
      2: 'How much it is?',
      3: 'five dollar',
      4: 'It five dollars.',
      5: 'It ten dollars.',
      6: 'How much it is?',
      7: 'Thank.',
    },
    likes_dislikes: { 1: 'I like coffee very.', 2: 'I like pizza very.', 3: 'I no like tea.', 4: 'I no like tea.', 5: 'I like coffee very.' },
    wants_needs: { 1: 'I want waters.', 2: 'I need helps.', 3: 'I have dog.', 4: 'I want waters.', 5: 'I want coffees.' },
    can_cant: { 1: 'I swim.', 2: 'I no can drive.', 3: 'I can cooking.', 4: 'I can cooking.' },
    asking_for_help: { 1: 'I not understand.', 2: 'Can speak more slowly?', 3: 'What that mean?', 4: 'I not understand.' },
    asking_questions: { 1: 'Where the bathroom?', 2: 'Who that?', 3: 'How you?', 4: 'What this?', 5: 'What this?' },
  };
  const authoredClose = closeByLesson[lessonId]?.[step];
  if (authoredClose) return authoredClose;

  const t = exact.trim();
  if (/^I'm\b/i.test(t)) return t.replace(/^I'm\b/i, 'I am');
  if (/^I am\b/i.test(t)) return t.replace(/^I am\b/i, "I'm");
  if (/^It's\b/i.test(t)) return t.replace(/^It's\b/i, 'It is');
  if (/^It is\b/i.test(t)) return t.replace(/^It is\b/i, "It's");
  if (/^You're\b/i.test(t)) return t.replace(/^You're\b/i, 'You are');
  if (/^You are\b/i.test(t)) return t.replace(/^You are\b/i, "You're");
  if (/^I can't\b/i.test(t)) return t.replace(/^I can't\b/i, 'I cannot');
  if (/^I cannot\b/i.test(t)) return t.replace(/^I cannot\b/i, "I can't");
  if (/^I don't\b/i.test(t)) return t.replace(/^I don't\b/i, 'I do not');
  if (/^I like /i.test(t)) {
    return `I really like ${t.slice(7).replace(/[.!?]+$/, '')}`;
  }
  if (/^I want /i.test(t)) {
    return `I really want ${t.slice(7).replace(/[.!?]+$/, '')}`;
  }
  if (/^I need /i.test(t)) {
    return `I really need ${t.slice(7).replace(/[.!?]+$/, '')}`;
  }
  if (/^Where is the /i.test(t)) return t.replace(/^Where is the /i, 'Where is ');
  if (/^Can you /i.test(t)) return t.replace(/^Can you /i, 'Could you please ');
  if (/^How much/i.test(t)) return `${t.replace(/\?$/, '')} please`;
  if (/^[a-z-]+$/i.test(t) && !/\s/.test(t)) return `the number ${t}`;
  return outOfPoolEllipsisAnswer(exact);
}

/** Structural close-miss for Introductions scenario 3 — missing function words. */
export function introductionsOutOfPoolCloseMiss(
  exact: string,
  step = 1,
): string {
  const t = exact.trim();
  switch (step) {
    case 1:
      return t.replace(/^My name is /i, 'My name ');
    case 2: {
      const name =
        exact.match(/(?:My name is|I'm)\s+(\w+)/i)?.[1] ?? 'Nana';
      return `I ${name}.`;
    }
    case 3:
      return t.replace(/^Nice to meet you\.?$/i, 'Nice meet you.');
    case 4:
      return t.replace(/^Nice to meet you,? too\.?$/i, 'Nice to meet too.');
    case 5:
      return t.replace(/^I'm from /i, 'I from ');
    case 6:
      return t.replace(/^I live in /i, 'I live ');
    case 7:
      return t
        .replace(/^I'm a /i, 'I a ')
        .replace(/^I work as an /i, 'I work ')
        .replace(/^I work as a /i, 'I work ');
    case 8: {
      let out = t.replace(/^My name is /i, 'My name ');
      out = out.replace(/\bI'm from /gi, 'I from ');
      return out;
    }
    default:
      return t;
  }
}

/** Off-topic wrong answer for out-of-pool wrong scenarios. */
export function introductionsOutOfPoolWrong(_exact: string, _step?: number): string {
  return 'Good morning.';
}

/** Off-topic wrong that is not a valid answer in this lesson. */
export function foundationOutOfPoolWrong(
  exact: string,
  step: number,
  lessonId: string,
): string {
  if (lessonId === 'greetings') return 'Thank you.';
  return introductionsOutOfPoolWrong(exact, step);
}

/** Second wrong while repeating — triggers scripted soft-advance. */
export function introductionsOutOfPoolWrongAgain(
  _exact: string,
  _step?: number,
): string {
  return 'Hello there.';
}

export type OutOfPoolAnswerFn = (exact: string, step: number) => string;

export type GeminiAssessTier = 'correct' | 'close' | 'incorrect';

const DEFAULT_GEMINI_PREFIX: Record<GeminiAssessTier, string> = {
  correct: 'ถูกต้องแล้วครับ! เก่งมากครับ',
  close: 'เกือบถูกแล้วครับ',
  incorrect: 'ยังไม่ใช่นะครับ ลองพูดว่า',
};

function assertIncorrectPinCopy(
  def: ChoiceLessonDef,
  step: number,
  priorTurns: Turn[],
  textEn: string,
  label: string,
): void {
  const board = def.boardForStep(step, priorTurns);
  if (board?.incorrectHintTh?.trim()) {
    assert.doesNotMatch(textEn, /ลองพูดตามนะครับ/u, label);
    return;
  }
  if (isRepeatOnlyBoard(board)) {
    assert.match(textEn, /พูดตาม/u, label);
  }
}

/** Every step: out-of-pool → defer → pinned Gemini assess tier → advance (with exact recovery after incorrect). */
export function runFoundationAllOutOfPoolGeminiAssess(
  def: ChoiceLessonDef,
  outOfPoolFn: OutOfPoolAnswerFn,
  tier: GeminiAssessTier,
  options: {
    learnerFirstName?: string;
    geminiPrefix?: string;
    recoverAfterIncorrect?: boolean;
  } = {},
): FullHappyPathResult {
  const learnerFirstName = options.learnerFirstName ?? FOUNDATION_PROBE_LEARNER;
  const geminiPrefix = options.geminiPrefix ?? DEFAULT_GEMINI_PREFIX[tier];
  const recoverAfterIncorrect =
    tier === 'incorrect' && (options.recoverAfterIncorrect ?? true);

  const opening = def.buildOpening(learnerFirstName);
  const turns: Turn[] = [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];
  const steps: FullHappyPathStep[] = [];
  let sessionProgressTurn = 1;

  for (let step = 1; step <= def.maxStep; step++) {
    const exact = expectedInPoolSpeech(def, step, turns, learnerFirstName);
    const userText = outOfPoolFn(exact, step);
    if (tier === 'close') {
      assert.equal(
        def.scoreStep(step, userText, turns),
        'close',
        `${def.lessonId} step ${step}: authored close input must classify as close`,
      );
    }
    turns.push({ speaker: 'user', textEn: userText });

    const route = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName,
      sessionProgressTurn,
    });
    assert.ok(route, `${def.lessonId} step ${step}: missing route`);
    assert.equal(
      route!.deferToAi,
      true,
      `${def.lessonId} step ${step}: "${userText}" should defer to Gemini`,
    );

    const assessed = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply(tier, geminiPrefix),
      sessionProgressTurn,
      learnerFirstName,
    );
    assert.equal(
      assessed.assessmentTier,
      tier,
      `${def.lessonId} step ${step}: Gemini tier`,
    );

    if (tier === 'incorrect') {
      const currentBoard = def.boardForStep(step, turns, learnerFirstName);
      assert.equal(
        assessed.expectedSpeech,
        currentBoard?.expectedSpeech,
        `${def.lessonId} step ${step}: incorrect target must stay on current step`,
      );
      if (!def.pinWithoutGuidedSteps?.includes(step)) {
        assert.deepEqual(
          assessed.guidedSpeaking?.options,
          currentBoard?.options.length ? currentBoard.options : undefined,
          `${def.lessonId} step ${step}: incorrect choices must stay on current step`,
        );
      }
    }

    turns.push({
      speaker: 'ai',
      textEn: assessed.textEn ?? '',
      expectedSpeech: assessed.expectedSpeech,
      guidedSpeaking: assessed.guidedSpeaking ?? null,
      assessmentTier: assessed.assessmentTier,
    });

    let replyForStep = assessed;
    if (recoverAfterIncorrect) {
      assertIncorrectPinCopy(
        def,
        step,
        turns.slice(0, -1),
        assessed.textEn ?? '',
        `${def.lessonId} step ${step}: incorrect teach copy`,
      );
      const recoveryText = exact;
      turns.push({ speaker: 'user', textEn: recoveryText });
      const recovery = buildChoiceLessonAfterUser(def, {
        turns,
        learnerFirstName,
        sessionProgressTurn,
      });
      assert.ok(recovery, `${def.lessonId} step ${step}: recovery reply`);
      assert.notEqual(
        recovery!.deferToAi,
        true,
        `${def.lessonId} step ${step}: recovery should be in-pool`,
      );
      turns.push({
        speaker: 'ai',
        textEn: recovery!.textEn ?? '',
        expectedSpeech: recovery!.expectedSpeech,
        assessmentTier: recovery!.assessmentTier,
      });
      replyForStep = recovery!;
    }

    const progressAfter = choiceLessonEffectiveProgress(
      def,
      turns,
      sessionProgressTurn,
    );
    steps.push({
      step,
      userText,
      aiTextEn: assessed.textEn ?? '',
      expectedSpeech: assessed.expectedSpeech ?? null,
      progressAfter,
      isLessonComplete: replyForStep.isLessonComplete ?? false,
    });
    sessionProgressTurn++;
  }

  const last = steps.at(-1)!;
  assert.equal(last.isLessonComplete, true, `${def.lessonId}: should complete`);
  assert.match(
    turns.at(-1)?.textEn ?? '',
    tier === 'incorrect' ? /เรียนครบแล้วครับ/ : /สุดยอด|🎉|🍌/,
    `${def.lessonId}: performance-aware completion copy`,
  );
  assert.doesNotMatch(
    turns.at(-1)?.textEn ?? '',
    /(?:ถูกต้อง|ดีมาก|เยี่ยม)ครับ!\s+[^!]+!\s*🎉/u,
    `${def.lessonId}: completion must not prepend a detached praise sentence before the learner name`,
  );
  return { turns, steps, completionText: turns.at(-1)?.textEn ?? '' };
}

/** Every step: out-of-pool user line → defer → pinned Gemini correct → advance to completion. */
export function runFoundationAllOutOfPoolGeminiCorrect(
  def: ChoiceLessonDef,
  outOfPoolFn: OutOfPoolAnswerFn,
  learnerFirstName = FOUNDATION_PROBE_LEARNER,
  geminiPraise = DEFAULT_GEMINI_PREFIX.correct,
): FullHappyPathResult {
  return runFoundationAllOutOfPoolGeminiAssess(def, outOfPoolFn, 'correct', {
    learnerFirstName,
    geminiPrefix: geminiPraise,
  });
}

/** Every step: wrong → พูดตาม (Gemini incorrect) → wrong again → scripted soft-advance → lesson end. */
export function runFoundationAllOutOfPoolWrongThenSoftAdvance(
  def: ChoiceLessonDef,
  wrongFn: OutOfPoolAnswerFn = introductionsOutOfPoolWrong,
  wrongAgainFn: OutOfPoolAnswerFn = introductionsOutOfPoolWrongAgain,
  learnerFirstName = FOUNDATION_PROBE_LEARNER,
): FullHappyPathResult {
  const opening = def.buildOpening(learnerFirstName);
  const turns: Turn[] = [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];
  const steps: FullHappyPathStep[] = [];
  let sessionProgressTurn = 1;

  for (let step = 1; step <= def.maxStep; step++) {
    const exact = expectedInPoolSpeech(def, step, turns, learnerFirstName);
    const wrongText = wrongFn(exact, step);
    turns.push({ speaker: 'user', textEn: wrongText });

    const route = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName,
      sessionProgressTurn,
    });
    assert.ok(route, `${def.lessonId} step ${step}: missing route`);
    assert.equal(
      route!.deferToAi,
      true,
      `${def.lessonId} step ${step}: "${wrongText}" should defer to Gemini`,
    );

    const pinned = pinChoiceLessonAiReply(
      def,
      turns,
      mockGeminiReply('incorrect', DEFAULT_GEMINI_PREFIX.incorrect),
      sessionProgressTurn,
      learnerFirstName,
    );
    assert.equal(pinned.assessmentTier, 'incorrect');
    assertIncorrectPinCopy(
      def,
      step,
      turns.slice(0, -1),
      pinned.textEn ?? '',
      `${def.lessonId} step ${step}: incorrect teach copy`,
    );
    turns.push({
      speaker: 'ai',
      textEn: pinned.textEn ?? '',
      expectedSpeech: pinned.expectedSpeech,
      assessmentTier: pinned.assessmentTier,
    });

    const wrongAgainText = wrongAgainFn(exact, step);
    turns.push({ speaker: 'user', textEn: wrongAgainText });
    const soft = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName,
      sessionProgressTurn,
    });
    assert.ok(soft, `${def.lessonId} step ${step}: missing soft-advance reply`);
    assert.notEqual(
      soft!.deferToAi,
      true,
      `${def.lessonId} step ${step}: 2nd wrong is scripted`,
    );
    assert.match(soft!.textEn ?? '', /ตรงนี้(พูด(ว่า|ได้ว่า)|ใช้โครง)/);
    if (step < def.maxStep) {
      assert.match(soft!.textEn ?? '', /ไปต่อกันเลย —/);
      const nextBoard = def.boardForStep(step + 1, turns, learnerFirstName);
      assert.equal(
        soft!.expectedSpeech,
        nextBoard?.expectedSpeech,
        `${def.lessonId} step ${step}: soft-advance target must match step ${step + 1}`,
      );
      assert.deepEqual(
        soft!.guidedSpeaking?.options,
        nextBoard?.options.length ? nextBoard.options : undefined,
        `${def.lessonId} step ${step}: soft-advance choices must match step ${step + 1}`,
      );
    } else {
      assert.match(soft!.textEn ?? '', /เรียนครบแล้วครับ/);
      assert.doesNotMatch(soft!.textEn ?? '', /ไปต่อกันเลย —/);
      assert.equal(soft!.completionStatus, 'needs_review');
      assert.doesNotMatch(soft!.textEn ?? '', /🎉|สุดยอด|เก่งมาก/);
    }
    assert.equal(soft!.assessmentTier, 'incorrect');
    turns.push({
      speaker: 'ai',
      textEn: soft!.textEn ?? '',
      expectedSpeech: soft!.expectedSpeech,
      assessmentTier: soft!.assessmentTier,
      wasSoftAdvance: soft!.wasSoftAdvance,
    });

    const progressAfter = choiceLessonEffectiveProgress(
      def,
      turns,
      sessionProgressTurn,
    );
    steps.push({
      step,
      userText: wrongText,
      aiTextEn: soft!.textEn ?? '',
      expectedSpeech: soft!.expectedSpeech ?? null,
      progressAfter,
      isLessonComplete: soft!.isLessonComplete ?? false,
    });
    sessionProgressTurn++;
  }

  const last = steps.at(-1)!;
  assert.equal(last.isLessonComplete, true, `${def.lessonId}: should complete`);
  assert.match(
    turns.at(-1)?.textEn ?? '',
    /เรียนครบแล้วครับ/,
    `${def.lessonId}: needs-review completion copy`,
  );
  return { turns, steps, completionText: turns.at(-1)?.textEn ?? '' };
}

/** Two wrong answers on `atStep`, then exact in-pool recovery through lesson end. */
export function runWrongTwiceThenFinishFromStep(
  def: ChoiceLessonDef,
  atStep: number,
  wrongText: string,
  learnerFirstName = FOUNDATION_PROBE_LEARNER,
): FullHappyPathResult {
  assert.ok(atStep >= 1 && atStep <= def.maxStep, `${def.lessonId}: bad atStep`);

  const turns = buildExactHistoryThroughProgress(
    def,
    atStep - 1,
    learnerFirstName,
  );
  const steps: FullHappyPathStep[] = [];
  const currentBoard = def.boardForStep(atStep, turns);
  assert.ok(currentBoard?.expectedSpeech, `${def.lessonId} step ${atStep}: board`);

  for (let attempt = 1; attempt <= 2; attempt++) {
    turns.push({ speaker: 'user', textEn: wrongText });
    const route = buildChoiceLessonAfterUser(def, { turns, learnerFirstName });
    assert.ok(route, `${def.lessonId} step ${atStep} wrong #${attempt}: route`);

    if (attempt === 1) {
      assert.equal(route.deferToAi, true, `${def.lessonId}: 1st wrong defers`);
      const pinned = pinChoiceLessonAiReply(
        def,
        turns,
        mockGeminiReply(
          'incorrect',
          `ลองพูดตามนะครับ "${currentBoard.expectedSpeech.replace(/\.$/, '')}"`,
        ),
        undefined,
        learnerFirstName,
      );
      assert.equal(
        pinned.expectedSpeech,
        currentBoard.expectedSpeech,
        `${def.lessonId}: 1st wrong pins current step`,
      );
      turns.push({
        speaker: 'ai',
        textEn: pinned.textEn ?? '',
        assessmentTier: pinned.assessmentTier,
      });
      continue;
    }

    assert.notEqual(route.deferToAi, true, `${def.lessonId}: 2nd wrong scripted`);
    assert.match(route.textEn ?? '', /ตรงนี้(พูด(ว่า|ได้ว่า)|ใช้โครง)/);
    const softStep = atStep + 1;
    if (atStep < def.maxStep) {
      assert.match(route.textEn ?? '', /ไปต่อกันเลย —/);
    } else {
      assert.match(route.textEn ?? '', /เรียนครบแล้วครับ/);
      assert.doesNotMatch(route.textEn ?? '', /ไปต่อกันเลย —/);
    }
    assert.equal(route.assessmentTier, 'incorrect');
    turns.push({
      speaker: 'ai',
      textEn: route.textEn ?? '',
      assessmentTier: route.assessmentTier,
      wasSoftAdvance: route.wasSoftAdvance,
    });

    if (softStep <= def.maxStep) {
      const nextBoard = def.boardForStep(softStep, turns);
      assert.equal(
        route.expectedSpeech,
        nextBoard?.expectedSpeech,
        `${def.lessonId}: soft-advance previews step ${softStep}`,
      );
    }
  }

  for (let step = atStep + 1; step <= def.maxStep; step++) {
    const userText = expectedInPoolSpeech(def, step, turns, learnerFirstName);
    turns.push({ speaker: 'user', textEn: userText });
    const reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName });
    assert.ok(reply, `${def.lessonId} recovery step ${step}: missing reply`);
    assert.notEqual(reply.deferToAi, true);
    assert.equal(reply.assessmentTier ?? 'correct', 'correct');

    steps.push({
      step,
      userText,
      aiTextEn: reply.textEn ?? '',
      expectedSpeech: reply.expectedSpeech ?? null,
      progressAfter: def.progressFn(turns),
      isLessonComplete: reply.isLessonComplete ?? false,
    });
    turns.push({
      speaker: 'ai',
      textEn: reply.textEn ?? '',
      assessmentTier: reply.assessmentTier,
      wasSoftAdvance: reply.wasSoftAdvance,
    });
  }

  const last = steps.at(-1)!;
  assert.equal(last.progressAfter, def.maxStep);
  assert.equal(last.isLessonComplete, true);
  assert.match(last.aiTextEn, /เรียนครบแล้วครับ/);

  return { turns, steps, completionText: last.aiTextEn };
}

export type ChatReplayLine = {
  userText: string;
  gemini?: {
    textEn: string;
    tier: 'correct' | 'close' | 'incorrect';
  };
  mustMatch?: RegExp;
  mustNotMatch?: RegExp;
};

export type ChatReplayExchange = {
  userText: string;
  aiTextEn: string;
  assessmentTier?: string;
  deferToAi?: boolean;
  expectedSpeech?: string | null;
  effectiveProgressAfter: number;
  isLessonComplete: boolean;
};

/** Replay a prod-style transcript (STT punctuation, Gemini pins, expectedSpeech on AI turns). */
export function replayChoiceLessonChat(
  def: ChoiceLessonDef,
  learnerFirstName: string,
  script: ChatReplayLine[],
): { turns: Turn[]; exchanges: ChatReplayExchange[] } {
  const opening = def.buildOpening(learnerFirstName);
  const turns: Turn[] = [
    {
      speaker: 'ai',
      textEn: opening.textEn ?? '',
      expectedSpeech: opening.expectedSpeech,
    },
  ];
  const exchanges: ChatReplayExchange[] = [];

  for (const line of script) {
    turns.push({ speaker: 'user', textEn: line.userText });
    let reply = buildChoiceLessonAfterUser(def, { turns, learnerFirstName });

    if (reply?.deferToAi) {
      assert.ok(line.gemini, `unexpected defer for "${line.userText}"`);
      reply = pinChoiceLessonAiReply(
        def,
        turns,
        mockGeminiReply(line.gemini.tier, line.gemini.textEn),
        undefined,
        learnerFirstName,
      );
    }

    assert.ok(reply, `missing reply for "${line.userText}"`);
    const aiTextEn = reply.textEn ?? '';

    if (line.mustNotMatch) {
      assert.doesNotMatch(
        aiTextEn,
        line.mustNotMatch,
        `"${line.userText}" must not match ${line.mustNotMatch}`,
      );
    }
    if (line.mustMatch) {
      assert.match(
        aiTextEn,
        line.mustMatch,
        `"${line.userText}" must match ${line.mustMatch}`,
      );
    }

    exchanges.push({
      userText: line.userText,
      aiTextEn,
      assessmentTier: reply.assessmentTier,
      deferToAi: reply.deferToAi,
      expectedSpeech: reply.expectedSpeech ?? null,
      effectiveProgressAfter: choiceLessonEffectiveProgress(def, turns),
      isLessonComplete: reply.isLessonComplete ?? false,
    });

    turns.push({
      speaker: 'ai',
      textEn: aiTextEn,
      expectedSpeech: reply.expectedSpeech,
    });
  }

  return { turns, exchanges };
}

/** Prod screenshot replay: Tim learner with STT trailing dots. */
export const INTRODUCTIONS_TIM_PROD_CHAT: ChatReplayLine[] = [
  { userText: 'My name is Tim..' },
  { userText: "I'm Tim..." },
  {
    userText: 'Nice to meet you..',
    mustNotMatch: /ตรงนี้พูดว่า.*My name is Tim/i,
    mustMatch: /Nice to meet you too/,
  },
  { userText: 'Nice to meet you too.', mustMatch: /I'm from Thailand/ },
  { userText: "I'm from Thailand." },
  { userText: 'I live in Bangkok.' },
  { userText: 'I work as a teacher.' },
  {
    userText: "My name is Tim. I'm from Thailand.",
    gemini: {
      tier: 'correct',
      textEn: 'เยี่ยมมากครับ! แนะนำตัวได้ครบเลยครับ',
    },
    mustMatch: /สุดยอด/,
  },
];
