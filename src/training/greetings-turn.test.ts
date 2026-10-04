import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAnswer, scoreGreetingVariant } from './engine/answer-scorer';
import { TrainingTurnEngine } from './engine/training-turn.engine';
import type { TrainingAiGate } from './engine/ai-gate';
import { LESSON_SKIP_TURN_TEXT } from '../common/api.types';
import type { LessonConfig } from '../lessons/lessons.data';
import type { ChatTurn } from '../session-store/session-store.service';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';
import { getFoundationChoiceLesson } from './scripts/foundation.registry';
import {
  FOUNDATION_POOLGATE_FIXTURES,
} from './foundation/foundation-poolgate.fixtures';
import {
  buildHistoryAtProbe,
  buildExactHistoryThroughProgress,
  foundationOutOfPoolCloseMiss,
  getDef,
  runFoundationAllOutOfPoolGeminiAssess,
  runFoundationAllOutOfPoolGeminiCorrect,
  runFoundationFullHappyPath,
  withProbeUser,
} from './foundation/foundation-poolgate.harness';

const def = getFoundationChoiceLesson('greetings');
assert.ok(def, 'greetings foundation def');

const fixture = FOUNDATION_POOLGATE_FIXTURES.find((f) => f.lessonId === 'greetings');
assert.ok(fixture, 'greetings fixture');

describe('answer-scorer', () => {
  it('matches near-miss Hello', () => {
    assert.equal(scoreAnswer('helo', ['Hello']).matchedPhrase, 'Hello');
  });

  it('accepts Morning variant for Good morning', () => {
    assert.equal(
      scoreGreetingVariant('morning', 'Good morning').matchedPhrase,
      'Good morning',
    );
  });
});

describe('greetings PoolGate flow', () => {
  it('opening asks for Hello', () => {
    const opening = def!.buildOpening('Nana');
    assert.equal(opening.expectedSpeech, 'Hello');
    assert.equal(opening.isLessonComplete, false);
  });

  it('recognition step 3 rejects Hello when Hi expected', () => {
    assert.equal(def!.scoreStep(3, 'Hello', buildHistoryAtProbe(fixture!)), 'wrong');
  });

  it('recognition step 3 accepts Hi', () => {
    const history = buildHistoryAtProbe(fixture!);
    assert.equal(def!.scoreStep(3, 'Hi', history), 'exact');
  });

  it('wrong answer on Hello defers to Gemini assess', () => {
    const turns = [
      { speaker: 'ai', textEn: def!.buildOpening('Nana').textEn, expectedSpeech: 'Hello' },
      { speaker: 'user', textEn: 'hey there' },
    ];
    const route = buildChoiceLessonAfterUser(def!, {
      turns,
      learnerFirstName: 'Nana',
    });
    assert.equal(route?.deferToAi, true);
    assert.equal(route?.aiMode, 'assess');
  });

  it('second wrong soft-advances scripted', () => {
    const turns = [
      { speaker: 'ai', textEn: def!.buildOpening('Nana').textEn, expectedSpeech: 'Hello' },
      { speaker: 'user', textEn: 'goodbye' },
      { speaker: 'ai', textEn: 'ลองพูดตามนะครับ "Hello"' },
      { speaker: 'user', textEn: 'see you' },
    ];
    const route = buildChoiceLessonAfterUser(def!, {
      turns,
      learnerFirstName: 'Nana',
    });
    assert.notEqual(route?.deferToAi, true);
    assert.match(route!.textEn ?? '', /ตรงนี้(พูด(ว่า|ได้ว่า)|ใช้โครง)/);
    assert.equal(route!.expectedSpeech, 'Hi');
  });

  it('completes happy path through 8 steps', () => {
    const result = runFoundationFullHappyPath(def!, 'Nana');
    assert.equal(result.steps.length, 8);
    assert.equal(result.steps.at(-1)?.isLessonComplete, true);
    assert.match(result.completionText, /ทักทาย/);
  });

  it('classifies a real typo as close on every step', () => {
    const history = buildExactHistoryThroughProgress(def!, 0, 'Nana');
    for (let step = 1; step <= def!.maxStep; step++) {
      const board = def!.boardForStep(step, history, 'Nana')!;
      const typo = foundationOutOfPoolCloseMiss(
        board.expectedSpeech,
        step,
        'greetings',
      );
      assert.equal(def!.scoreStep(step, typo, history), 'close', `step ${step}: ${typo}`);
    }
  });

  it('close flow stays inside greeting content and never teaches farewells', () => {
    const result = runFoundationAllOutOfPoolGeminiAssess(
      def!,
      (exact, step) => foundationOutOfPoolCloseMiss(exact, step, 'greetings'),
      'close',
    );
    for (const record of result.steps) {
      assert.doesNotMatch(record.aiTextEn, /กล่าวลา|goodbye|good night/i);
    }
  });

  it('scenario 2 uses no more than one short praise per step', () => {
    const result = runFoundationAllOutOfPoolGeminiCorrect(
      def!,
      (exact) => `${exact}....`,
    );
    for (const record of result.steps) {
      const praise = record.aiTextEn.match(
        /ยอดเยี่ยม|ถูกต้อง|เก่งมาก|ดีมาก|เยี่ยมครับ/g,
      );
      assert.ok((praise?.length ?? 0) <= 1, `step ${record.step}: duplicate praise`);
    }
  });

  it('recognition step 5 rejects Good morning when Good afternoon expected', () => {
    const history = buildExactHistoryThroughProgress(def!, 4, 'Nana');
    assert.equal(def!.scoreStep(5, 'Good morning', history), 'wrong');
  });

  it('probe wrong defers; exact advances', () => {
    const probeDef = getDef(fixture!);
    const wrongRoute = buildChoiceLessonAfterUser(probeDef, {
      turns: withProbeUser(fixture!, fixture!.outOfPoolAtProbe),
      learnerFirstName: 'Nana',
    });
    assert.equal(wrongRoute?.deferToAi, true);

    const exactRoute = buildChoiceLessonAfterUser(probeDef, {
      turns: withProbeUser(fixture!, fixture!.exactAtProbe),
      learnerFirstName: 'Nana',
    });
    assert.notEqual(exactRoute?.deferToAi, true);
    assert.equal(exactRoute?.assessmentTier, 'correct');
  });
});

describe('greetings Skip on repeat turns', () => {
  const engine = new TrainingTurnEngine({} as unknown as TrainingAiGate);
  const config = { lessonId: 'greetings', titleEn: 'Greetings' } as LessonConfig;

  it('offers Skip on ลองพูดตาม turns and advances to the next board', async () => {
    const opening = engine.buildOpening(config, 'Nana').reply;
    assert.equal(opening.canSkip, true);
    const turns = [
      { speaker: 'ai', ...opening },
      { speaker: 'user', textEn: LESSON_SKIP_TURN_TEXT },
    ] as ChatTurn[];
    const { reply } = await engine.runTurn({
      config, turns, userText: LESSON_SKIP_TURN_TEXT,
      originalText: LESSON_SKIP_TURN_TEXT, learnerFirstName: 'Nana',
    });
    assert.equal(reply.expectedSpeech, 'Hi');
    assert.equal(reply.wasSoftAdvance, true);
    assert.equal(reply.canSkip, true);
  });

  it('never offers Skip on a question with choices', async () => {
    const opening = engine.buildOpening(config, 'Nana').reply;
    const hi = (await engine.runTurn({
      config, learnerFirstName: 'Nana', userText: 'Hello', originalText: 'Hello',
      turns: [{ speaker: 'ai', ...opening }, { speaker: 'user', textEn: 'Hello' }] as ChatTurn[],
    })).reply;
    const question = (await engine.runTurn({
      config, learnerFirstName: 'Nana', userText: 'Hi', originalText: 'Hi',
      turns: [
        { speaker: 'ai', ...opening }, { speaker: 'user', textEn: 'Hello' },
        { speaker: 'ai', ...hi }, { speaker: 'user', textEn: 'Hi' },
      ] as ChatTurn[],
    })).reply;
    assert.match(question.textEn, /เพื่อนสนิท/);
    assert.equal(question.canSkip, undefined);
  });
});
