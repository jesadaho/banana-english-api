import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyRoutineAfterUser,
  buildDailyRoutineOpening,
} from './scripts/daily-routine.script';
import { resolveChoiceStepContext } from './engine/choice-step.resolver';
import {
  dailyRoutineProgress,
  scoreDailyRoutineStep,
} from '../lessons/lessons.data';
import { resolveTurnLane } from './engine/turn-lanes';
import { isTrainingV2Lesson, resetTrainingV2ConfigCache } from './training-v2.config';

type Turn = { speaker: string; textEn?: string };

function replayDailyRoutine(steps: string[]): Turn[] {
  const history: Turn[] = [
    { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
  ];
  for (const userSpeech of steps) {
    history.push({ speaker: 'user', textEn: userSpeech });
    const reply = buildDailyRoutineAfterUser({
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.ok(reply, `missing reply for "${userSpeech}"`);
    history.push({ speaker: 'ai', textEn: reply!.textEn });
  }
  return history;
}

describe('training v2 config', () => {
  it('includes Daily Routine in default allowlist', () => {
    resetTrainingV2ConfigCache();
    assert.equal(isTrainingV2Lesson('ee_about_me_daily_routine'), true);
    assert.equal(isTrainingV2Lesson('ee_about_me_home'), false);
  });
});

describe('daily routine v2 lanes', () => {
  it('opening asks for I\'m ready without guidedSpeaking', () => {
    const opening = buildDailyRoutineOpening('Nana');
    assert.equal(opening.expectedSpeech, "I'm ready");
    assert.equal(opening.guidedSpeaking, undefined);
  });

  it('exact I\'m ready advances to vocab board', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: "I'm ready" },
    ];
    const reply = buildDailyRoutineAfterUser({
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.ok(reply?.guidedSpeaking?.options?.some((o) => o.speak === 'wake up'));
    assert.equal(reply?.expectedSpeech, 'wake up');
  });

  it('near miss get up triggers scripted soft-teach (no deferToAi)', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: "I'm ready" },
      {
        speaker: 'ai',
        textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
      },
      { speaker: 'user', textEn: 'get up' },
    ];
    const ctx = resolveChoiceStepContext(
      history,
      7,
      scoreDailyRoutineStep,
      dailyRoutineProgress,
    );
    assert.equal(ctx.tier, 'near');
    assert.equal(
      resolveTurnLane({ tier: ctx.tier, attempt: ctx.attempt }),
      'scriptedSoftTeach',
    );
    const reply = buildDailyRoutineAfterUser({
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined);
    assert.match(reply!.textEn, /พูดตาม|ใช้คำว่า/);
    assert.equal(reply?.expectedSpeech, 'wake up');
    assert.ok(reply?.guidedSpeaking);
  });

  it('second wrong force-advances scripted', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: "I'm ready" },
      {
        speaker: 'ai',
        textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
      },
      { speaker: 'user', textEn: 'go to work' },
      { speaker: 'ai', textEn: 'ลองพูดตามนะครับ wake up' },
      { speaker: 'user', textEn: 'go to sleep' },
    ];
    const reply = buildDailyRoutineAfterUser({
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.match(reply!.textEn, /ไม่เป็นไร|ไปต่อ/i);
    assert.match(reply!.expectedSpeech ?? '', /I wake up at/i);
  });

  it('happy path reaches completion', () => {
    const history = replayDailyRoutine([
      "I'm ready",
      'wake up',
      "I wake up at 7 o'clock.",
      "I go to sleep at 11 o'clock.",
      'I wake up at 7 AM.',
      'I drink coffee every day.',
      'I wake up at 7 AM every day.',
    ]);
    const lastAi = [...history].reverse().find((t) => t.speaker === 'ai');
    assert.ok(lastAi?.textEn?.includes('สุดยอด'));
    assert.equal(dailyRoutineProgress(history), 7);
  });
});
