import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyRoutineAfterUser, buildDailyRoutineOpening } from './scripts/daily-routine.script';
import { dailyRoutineProgress } from '../lessons/lessons.data';
import { isTrainingV2Lesson, resetTrainingV2ConfigCache } from './training-v2.config';

type Turn = { speaker: string; textEn?: string };
const answers = [
  "I wake up at seven o'clock.", "I wake up at 8 o'clock.",
  'I go to sleep at eleven.', "I go to sleep at 10 o'clock.",
  'I drink coffee every day.', 'I exercise every day.',
  "I wake up at 8 o'clock. I exercise every day.",
];

describe('training v2 config', () => {
  it('keeps Daily Routine enabled', () => {
    resetTrainingV2ConfigCache();
    assert.equal(isTrainingV2Lesson('ee_about_me_daily_routine'), true);
  });
});

describe('Daily Routine v2 flow', () => {
  it('opens with a taught sentence and no choice cards', () => {
    const opening = buildDailyRoutineOpening('Nana');
    assert.equal(opening.expectedSpeech, "I wake up at seven o'clock.");
    assert.equal(opening.guidedSpeaking, undefined);
    assert.doesNotMatch(opening.textEn, /ready/i);
  });

  it('asks the learner wake time after the model sentence', () => {
    const turns: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: answers[0] },
    ];
    const reply = buildDailyRoutineAfterUser({ turns, learnerFirstName: 'Nana' });
    assert.equal(reply?.guidedSpeaking?.stem, 'I wake up at...');
    assert.match(reply?.textEn ?? '', /ปกติคุณตื่นกี่โมง/u);
  });

  it('reaches completion through teach, personalize, and synthesis', () => {
    const turns: Turn[] = [{ speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn }];
    for (const answer of answers) {
      turns.push({ speaker: 'user', textEn: answer });
      const reply = buildDailyRoutineAfterUser({ turns, learnerFirstName: 'Nana' });
      assert.ok(reply);
      turns.push({ speaker: 'ai', textEn: reply.textEn });
    }
    assert.equal(dailyRoutineProgress(turns), 7);
    assert.match(turns.at(-1)?.textEn ?? '', /สุดยอด/u);
  });
});
