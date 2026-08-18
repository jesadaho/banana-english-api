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
  greetingsEmojiChoiceForStep,
} from './scripts/greetings.script';
import { pinGreetingsReplyChrome } from './engine/pin-greetings-chrome';

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
    assert.ok(reply, `step=${step} attempt=${attempt}`);
    assert.ok(!reply!.deferToAi, `happy path should not defer at step=${step}`);
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

  it('first wrong on Hello defers to Gemini soft-teach', () => {
    const reply = buildGreetingsAfterUser({
      step: 1,
      attempt: 1,
      matched: false,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, true);
    assert.equal(reply?.aiMode, 'softTeach');
  });

  it('second wrong on Hello force-advances scripted', () => {
    const reply = buildGreetingsAfterUser({
      step: 1,
      attempt: 2,
      matched: false,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined);
    assert.match(reply!.textEn, /ไม่เป็นไร|ไปต่อ/i);
    assert.equal(reply!.expectedSpeech, 'Hi');
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
    assert.ok(lastAi?.textEn?.includes('ยอดเยี่ยม'));
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

describe('pinned greetings chrome', () => {
  it('pins emojiChoice on step 3 and strips AI boards', () => {
    const pinned = pinGreetingsReplyChrome(
      {
        textEn: 'ใกล้แล้วครับ!',
        textTh: 'Almost!',
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: 'Hi',
        emojiChoice: {
          options: [{ emoji: '🐶', speak: 'wrong' }],
        },
        guidedSpeaking: { stem: 'bad' },
      },
      3,
    );
    assert.equal(pinned.emojiChoice?.options?.length, 2);
    assert.equal(pinned.emojiChoice?.options?.[1]?.speak, 'Hi');
    assert.equal(pinned.guidedSpeaking, undefined);
    assert.deepEqual(
      pinned.emojiChoice?.options?.map((o) => o.speak),
      greetingsEmojiChoiceForStep(3)?.options.map((o) => o.speak),
    );
  });

  it('clears emojiChoice off recognition steps', () => {
    const pinned = pinGreetingsReplyChrome(
      {
        textEn: 'เยี่ยม!',
        textTh: 'Great!',
        isLessonComplete: false,
        expectsUserSpeech: true,
        expectedSpeech: 'Hi',
        emojiChoice: { options: [{ emoji: '👋', speak: 'Hello' }] },
      },
      2,
    );
    assert.equal(pinned.emojiChoice, undefined);
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

  it('advances step after two wrong attempts', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'Say Hello' },
      { speaker: 'user', textEn: 'hey' },
      { speaker: 'ai', textEn: 'Try Hello' },
      { speaker: 'user', textEn: 'bye' },
    ];
    const ctx = resolveGreetingsStep(history);
    assert.equal(ctx.step, 2);
    assert.equal(ctx.attempt, 0);
  });
});
