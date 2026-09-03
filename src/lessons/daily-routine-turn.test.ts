import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyRoutineFallbackTrainingReply, dailyRoutineProgress, scoreDailyRoutineStep } from './lessons.data';

type Turn = { speaker: string; textEn?: string };
const answers = [
  "I wake up at seven o'clock.", "I wake up at 8 o'clock.",
  'I go to sleep at eleven.', "I go to sleep at 10 o'clock.",
  'I drink coffee every day.', 'I exercise every day.',
  "I wake up at 8 o'clock. I exercise every day.",
];

describe('Daily Routine teach-then-personalize flow', () => {
  it('scores all seven steps', () => {
    answers.forEach((answer, index) => assert.equal(scoreDailyRoutineStep(index + 1, answer), 'exact'));
  });

  it('alternates taught models with personal questions and completes', () => {
    const history: Turn[] = [{ speaker: 'ai', textEn: 'opening' }];
    for (const answer of answers) {
      history.push({ speaker: 'user', textEn: answer });
      const reply = buildDailyRoutineFallbackTrainingReply('ee_about_me_daily_routine', history, dailyRoutineProgress(history));
      assert.ok(reply);
      history.push({ speaker: 'ai', textEn: reply.textEn });
    }
    assert.equal(dailyRoutineProgress(history), 7);
    assert.match(history.at(-1)?.textEn ?? '', /ตื่นกี่โมง.*เข้านอนกี่โมง.*ทำอะไรทุกวัน/u);
  });
});
