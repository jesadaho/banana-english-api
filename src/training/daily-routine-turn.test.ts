import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyRoutineAfterUser,
  buildDailyRoutineOpening,
  pinDailyRoutineAiReply,
  resolveDailyRoutineAssessmentTier,
} from './scripts/daily-routine.script';
import {
  dailyRoutineProgress,
  scoreDailyRoutineStep,
} from '../lessons/lessons.data';
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
    assert.equal(reply!.deferToAi, undefined, `unexpected AI defer at "${userSpeech}"`);
    history.push({ speaker: 'ai', textEn: reply!.textEn });
  }
  return history;
}

describe('training v2 config', () => {
  it('includes Foundation + About Me in default allowlist (registry)', () => {
    resetTrainingV2ConfigCache();
    assert.equal(isTrainingV2Lesson('greetings'), true);
    assert.equal(isTrainingV2Lesson('introductions'), true);
    assert.equal(isTrainingV2Lesson('numbers'), true);
    assert.equal(isTrainingV2Lesson('ee_about_me_daily_routine'), true);
    assert.equal(isTrainingV2Lesson('ee_about_me_home'), true);
    assert.equal(isTrainingV2Lesson('ee_about_me_favorites'), true);
    assert.equal(isTrainingV2Lesson('weather'), false);
  });

  it('registry v2 survives TRAINING_V2_LESSONS env override', () => {
    resetTrainingV2ConfigCache();
    process.env.TRAINING_V2_LESSONS = 'ee_about_me_food';
    resetTrainingV2ConfigCache();
    assert.equal(isTrainingV2Lesson('introductions'), true);
    assert.equal(isTrainingV2Lesson('ee_about_me_food'), true);
    assert.equal(isTrainingV2Lesson('weather'), false);
    delete process.env.TRAINING_V2_LESSONS;
    resetTrainingV2ConfigCache();
  });
});

describe('daily routine v2 lanes (binary pool routing)', () => {
  it('opening asks for I\'m ready without guidedSpeaking', () => {
    const opening = buildDailyRoutineOpening('Nana');
    assert.equal(opening.expectedSpeech, "I'm ready");
    assert.equal(opening.guidedSpeaking, undefined);
  });

  it('exact I\'m ready advances to vocab board (scripted, no AI)', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: "I'm ready" },
    ];
    const reply = buildDailyRoutineAfterUser({
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, undefined);
    assert.ok(reply?.guidedSpeaking?.options?.some((o) => o.speak === 'wake up'));
    assert.equal(reply?.expectedSpeech, 'wake up');
  });

  it('out-of-pool near miss defers to AI assess (not scripted near rules)', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: "I'm ready" },
      {
        speaker: 'ai',
        textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
      },
      { speaker: 'user', textEn: 'get up' },
    ];
    assert.equal(scoreDailyRoutineStep(2, 'get up'), 'near');
    const reply = buildDailyRoutineAfterUser({
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.deferToAi, true);
    assert.equal(reply?.aiMode, 'assess');
  });

  it('second wrong force-advances scripted (no AI)', () => {
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
    assert.equal(reply?.deferToAi, undefined);
    assert.match(reply!.textEn, /ตรงนี้พูดว่า "wake up"/);
    assert.match(reply!.textEn, /ไปต่อกันเลย — What time do you wake up\?/);
    assert.match(reply!.expectedSpeech ?? '', /I wake up at/i);
  });

  it('AI correct tier pins next board', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: "I'm ready" },
      {
        speaker: 'ai',
        textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
      },
      { speaker: 'user', textEn: 'wake up' },
      {
        speaker: 'ai',
        textEn: 'ยอดเยี่ยม! ปกติคุณตื่นกี่โมงครับ?',
      },
      { speaker: 'user', textEn: 'I get up at 7 o\'clock.' },
    ];
    const pinned = pinDailyRoutineAiReply(history, {
      textEn: 'ถูกต้องครับ!',
      textTh: 'Correct!',
      isLessonComplete: false,
      expectsUserSpeech: true,
      assessmentTier: 'correct',
    });
    assert.match(pinned.expectedSpeech ?? '', /go to sleep/i);
  });

  it('AI close tier advances with gentle tweak (no repeat)', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: "I'm ready" },
      {
        speaker: 'ai',
        textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
      },
      { speaker: 'user', textEn: 'get up' },
    ];
    const pinned = pinDailyRoutineAiReply(history, {
      textEn: 'เกือบเป๊ะครับ! ปกติจะพูดว่า "wake up" มากกว่า "get up" ไปต่อกันเลย!',
      textTh: 'Almost! wake up is more common.',
      isLessonComplete: false,
      expectsUserSpeech: true,
      assessmentTier: 'close',
    });
    assert.equal(resolveDailyRoutineAssessmentTier({ assessmentTier: 'close' } as never), 'close');
    assert.match(pinned.expectedSpeech ?? '', /I wake up at/i);
    assert.doesNotMatch(pinned.textEn, /พูดตาม/);
  });

  it('AI incorrect tier pins current board for soft-teach', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
      { speaker: 'user', textEn: "I'm ready" },
      {
        speaker: 'ai',
        textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
      },
      { speaker: 'user', textEn: 'get up' },
    ];
    const pinned = pinDailyRoutineAiReply(history, {
      textEn: 'ใกล้แล้วครับ! ลองพูดว่า "wake up" ชัดๆ อีกครั้งนะ',
      textTh: 'Almost! Try wake up.',
      isLessonComplete: false,
      expectsUserSpeech: true,
      assessmentTier: 'incorrect',
    });
    assert.match(pinned.textEn ?? '', /ลองพูดว่า|พูดตาม/u);
    assert.equal(pinned.expectedSpeech, 'wake up');
    assert.ok(pinned.guidedSpeaking?.options?.some((o) => o.speak === 'wake up'));
  });

  it('happy path reaches completion (all in-pool scripted)', () => {
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
