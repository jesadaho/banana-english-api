import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAnswer, scoreGreetingVariant } from './engine/answer-scorer';
import { buildChoiceLessonAfterUser } from './scripts/choice-lesson.script';
import { getFoundationChoiceLesson } from './scripts/foundation.registry';
import {
  FOUNDATION_POOLGATE_FIXTURES,
} from './foundation/foundation-poolgate.fixtures';
import {
  buildHistoryAtProbe,
  buildExactHistoryThroughProgress,
  getDef,
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
    assert.match(route!.textEn ?? '', /ตรงนี้พูด(ว่า|ได้ว่า)/);
    assert.equal(route!.expectedSpeech, 'Hi');
  });

  it('completes happy path through 8 steps', () => {
    const result = runFoundationFullHappyPath(def!, 'Nana');
    assert.equal(result.steps.length, 8);
    assert.equal(result.steps.at(-1)?.isLessonComplete, true);
    assert.match(result.completionText, /ทักทาย/);
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
