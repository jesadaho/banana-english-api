import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAnswer, scoreGreetingVariant } from './engine/answer-scorer';
import {
  resolveGreetingsStep,
  scoreGreetingsUserTurn,
} from './engine/lesson-step.resolver';
import {
  buildGreetingsAfterUser,
  buildGreetingsOpening,
} from './scripts/greetings.script';

type Turn = { speaker: string; textEn?: string };

function replayGreetings(steps: string[]): Turn[] {
  const history: Turn[] = [
    { speaker: 'ai', textEn: buildGreetingsOpening('Nana').textEn },
  ];
  for (const userSpeech of steps) {
    history.push({ speaker: 'user', textEn: userSpeech });
    const prior = history.slice(0, -1);
    const { step, attempt: priorAttempt } = resolveGreetingsStep(prior);
    const attempt = priorAttempt + 1;
    const matched = scoreGreetingsUserTurn(step, userSpeech, userSpeech)
      .matched;
    const reply = buildGreetingsAfterUser({
      step,
      attempt,
      matched,
      learnerFirstName: 'Nana',
    });
    assert.ok(reply && !reply.deferToAi, `step=${step} attempt=${attempt}`);
    history.push({ speaker: 'ai', textEn: reply!.textEn });
  }
  return history;
}

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

describe('greetings scripted flow', () => {
  it('opening asks for Hello', () => {
    const opening = buildGreetingsOpening('Nana');
    assert.equal(opening.expectedSpeech, 'Hello');
    assert.equal(opening.isLessonComplete, false);
  });

  it('first wrong on Hello returns soft hint without AI', () => {
    const reply = buildGreetingsAfterUser({
      step: 1,
      attempt: 1,
      matched: false,
      learnerFirstName: 'Nana',
    });
    assert.ok(reply);
    assert.equal(reply!.deferToAi, undefined);
    assert.equal(reply!.expectedSpeech, 'Hello');
  });

  it('second wrong on Hello defers to AI', () => {
    const reply = buildGreetingsAfterUser({
      step: 1,
      attempt: 2,
      matched: false,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, true);
  });

  it('completes core flow 1→9 on matched answers', () => {
    const history = replayGreetings([
      'Hello',
      'Hi',
      'Hi',
      'Good morning',
      'Good afternoon',
      'Good evening',
      'Good morning',
      'Hello',
    ]);
    const lastAi = [...history].reverse().find((t) => t.speaker === 'ai');
    assert.ok(lastAi?.textEn.includes('ยอดเยี่ยม'));
    const { step } = resolveGreetingsStep(history);
    assert.equal(step, 9);
  });

  it('step 3 recognition board expects Hi', () => {
    const reply = buildGreetingsAfterUser({
      step: 2,
      attempt: 1,
      matched: true,
      learnerFirstName: 'Nana',
    });
    assert.ok(reply?.emojiChoice?.options?.some((o) => o.speak === 'Hi'));
    assert.equal(reply?.expectedSpeech, 'Hi');
  });
});

describe('resolveGreetingsStep', () => {
  it('tracks attempt count across retries', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'Hello' },
      { speaker: 'user', textEn: 'hey' },
    ];
    const ctx = resolveGreetingsStep(history);
    assert.equal(ctx.step, 1);
    assert.equal(ctx.attempt, 1);
  });
});
