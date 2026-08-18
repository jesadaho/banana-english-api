import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyRoutineFallbackTrainingReply,
  buildSoftTeachRevealLine,
  dailyRoutineProgress,
  forceAboutMeSoftTeachForLesson,
  scoreDailyRoutineStep,
} from './lessons.data';

type Turn = { speaker: string; textEn?: string };

const LESSON_ID = 'ee_about_me_daily_routine';

/** Simulates stored session history (user + ai turns). */
function replayTurns(steps: Turn[]): Turn[] {
  return steps.map((t) => ({ ...t }));
}

function fallbackAfterUser(
  history: Turn[],
  nextTurn: number,
): NonNullable<ReturnType<typeof buildDailyRoutineFallbackTrainingReply>> {
  const reply = buildDailyRoutineFallbackTrainingReply(
    LESSON_ID,
    history,
    nextTurn,
  );
  assert.ok(reply, `expected scripted reply at API turn ${nextTurn}, progress=${dailyRoutineProgress(history)}`);
  return reply;
}

describe('Daily Routine scripted turns (no Gemini)', () => {
  it('maps progress 1→7 to the correct boards', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: "Welcome! Say I'm ready." },
    ];

    const steps: Array<{
      user: string;
      nextTurn: number;
      expectStem?: string;
      expectComplete?: boolean;
    }> = [
      { user: "I'm ready", nextTurn: 1, expectStem: '...' },
      { user: 'wake up', nextTurn: 2, expectStem: 'I wake up at...' },
      {
        user: "I wake up at 7 o'clock.",
        nextTurn: 3,
        expectStem: 'I go to sleep at...',
      },
      {
        user: "I go to sleep at 11 o'clock.",
        nextTurn: 4,
        expectStem: 'I wake up at 7...',
      },
      { user: 'I wake up at 7 AM.', nextTurn: 5, expectStem: 'I ... every day.' },
      {
        user: 'I drink coffee every day.',
        nextTurn: 6,
        expectComplete: false,
      },
      {
        user: 'I wake up at 7 AM every day.',
        nextTurn: 7,
        expectComplete: true,
      },
    ];

    for (const step of steps) {
      history.push({ speaker: 'user', textEn: step.user });
      const progress = dailyRoutineProgress(history);
      const reply = fallbackAfterUser(history, step.nextTurn);

      if (step.expectComplete) {
        assert.equal(reply.isLessonComplete, true);
        assert.equal(reply.expectsUserSpeech, false);
      } else {
        assert.equal(reply.isLessonComplete, false);
        assert.equal(reply.expectsUserSpeech, true);
        if (step.expectStem) {
          assert.equal(
            reply.guidedSpeaking?.stem,
            step.expectStem,
            `progress=${progress} user="${step.user}"`,
          );
        } else {
          assert.equal(reply.guidedSpeaking, undefined);
        }
      }

      history.push({ speaker: 'ai', textEn: reply.textEn });
    }
  });

  it('never returns null on Core Flow turns 2–7 after a matched user answer', () => {
    const history = replayTurns([
      { speaker: 'ai', textEn: 'Say I\'m ready' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'Vocab quiz' },
      { speaker: 'user', textEn: 'wake up' },
      { speaker: 'ai', textEn: 'Wake time' },
      { speaker: 'user', textEn: "I wake up at 7 o'clock." },
    ]);

    // Core Flow turn 4 = sleep board — this was failing in production.
    const turn4 = buildDailyRoutineFallbackTrainingReply(LESSON_ID, history, 3);
    assert.ok(turn4, 'sleep board must be scripted at API turn 3');
    assert.match(turn4!.textEn, /go to sleep|เข้านอน/i);
    assert.equal(turn4!.guidedSpeaking?.stem, 'I go to sleep at...');
  });

  it('AM/PM board uses the learner wake hour from history', () => {
    const history = replayTurns([
      { speaker: 'ai', textEn: 'intro' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab' },
      { speaker: 'user', textEn: 'wake up' },
      { speaker: 'ai', textEn: 'wake time' },
      { speaker: 'user', textEn: "I wake up at 8 o'clock." },
      { speaker: 'ai', textEn: 'sleep time' },
      { speaker: 'user', textEn: "I go to sleep at 10 o'clock." },
    ]);

    const reply = fallbackAfterUser(history, 4);
    assert.equal(reply.guidedSpeaking?.stem, 'I wake up at 8...');
    assert.equal(reply.expectedSpeech, 'I wake up at 8 AM.');
  });
});

describe('Daily Routine 3-tier scoring', () => {
  it('classifies exact / near / wrong', () => {
    assert.equal(scoreDailyRoutineStep(2, 'wake up'), 'exact');
    assert.equal(scoreDailyRoutineStep(2, 'get up'), 'near');
    assert.equal(scoreDailyRoutineStep(2, 'go to work'), 'wrong');
    assert.equal(scoreDailyRoutineStep(3, "I wake up at 7 o'clock."), 'exact');
    assert.equal(scoreDailyRoutineStep(3, 'I get up at seven'), 'near');
    assert.equal(
      scoreDailyRoutineStep(4, "I go to sleep at 11 o'clock."),
      'exact',
    );
    assert.equal(scoreDailyRoutineStep(4, 'I go to bed at 11'), 'near');
    assert.equal(scoreDailyRoutineStep(5, 'AM'), 'wrong');
    assert.equal(scoreDailyRoutineStep(5, 'seven in the morning'), 'near');
  });

  it('near-miss vocab does not advance progress', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'ready' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab' },
      { speaker: 'user', textEn: 'get up' },
    ];
    assert.equal(dailyRoutineProgress(history), 1);
  });

  it('near-miss sleep does not soft-advance', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'intro' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab' },
      { speaker: 'user', textEn: 'wake up' },
      { speaker: 'ai', textEn: 'wake' },
      { speaker: 'user', textEn: "I wake up at 7 o'clock." },
      { speaker: 'ai', textEn: 'sleep' },
      { speaker: 'user', textEn: 'I go to bed at 11' },
    ];
    assert.equal(dailyRoutineProgress(history), 3);
  });

  it('exact after near-miss sleep advances to AM/PM', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'intro' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab' },
      { speaker: 'user', textEn: 'wake up' },
      { speaker: 'ai', textEn: 'wake' },
      { speaker: 'user', textEn: "I wake up at 7 o'clock." },
      { speaker: 'ai', textEn: 'sleep' },
      { speaker: 'user', textEn: 'I go to bed at 11' },
      {
        speaker: 'ai',
        textEn:
          "ปกติแล้วถ้าจะบอกว่าเข้านอนกี่โมง เราจะพูดว่า I go to sleep at 11 o'clock. ครับ ลองพูดตามนะครับ",
      },
      { speaker: 'user', textEn: "I go to sleep at 11 o'clock." },
    ];
    assert.equal(dailyRoutineProgress(history), 4);
  });
});

describe('Daily Routine unhappy paths (scripted)', () => {
  it('wake-time near-miss still gets explain after earlier vocab soft-teach', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'ready' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab' },
      { speaker: 'user', textEn: 'get up' },
      {
        speaker: 'ai',
        textEn:
          "ปกติแล้ว 'ตื่นนอน' ในภาษาอังกฤษจะใช้คำว่า wake up ครับ ลองพูดตามนะครับ",
      },
      { speaker: 'user', textEn: 'wake up' },
      { speaker: 'ai', textEn: 'wake time board' },
      { speaker: 'user', textEn: 'I get up at seven' },
    ];
    const reply = forceAboutMeSoftTeachForLesson(
      LESSON_ID,
      'thai',
      history,
      {
        textEn: 'wake time board',
        textTh: null,
        guidedSpeaking: { stem: 'I wake up at...', emoji: '⏰', speak: "I wake up at 7 o'clock." },
        expectsUserSpeech: true,
        isTaskComplete: false,
        expectedSpeech: "I wake up at 7 o'clock.",
      },
    );
    assert.ok(reply);
    assert.match(reply!.textEn, /ปกติแล้วถ้าจะบอกว่าตื่นกี่โมง เราจะพูดว่า/);
  });

  it('soft-teach reveal uses natural explain + repeat cue', () => {
    const line = buildSoftTeachRevealLine('wake up', 'thai', 'ตื่นนอน');
    assert.equal(
      line,
      "ปกติแล้ว 'ตื่นนอน' ในภาษาอังกฤษจะใช้คำว่า wake up ครับ ลองพูดตามนะครับ",
    );
  });

  it('wrong vocab answer triggers contextual soft-teach line', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'Say ready' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab quiz' },
      { speaker: 'user', textEn: 'go to work' },
    ];
    const reply = forceAboutMeSoftTeachForLesson(
      LESSON_ID,
      'thai',
      history,
      {
        textEn: 'vocab quiz',
        textTh: null,
        guidedSpeaking: { stem: '...', emoji: '⏰', speak: 'wake up' },
        expectsUserSpeech: true,
        isTaskComplete: false,
        expectedSpeech: 'wake up',
      },
    );
    assert.ok(reply);
    assert.match(
      reply!.textEn,
      /ปกติแล้ว 'ตื่นนอน' ในภาษาอังกฤษจะใช้คำว่า wake up ครับ ลองพูดตามนะครับ/,
    );
    assert.equal(reply!.expectedSpeech, 'wake up');
  });

  it('wrong vocab answer keeps progress at 1 and re-scripts vocab board', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'Say ready' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab quiz' },
      { speaker: 'user', textEn: 'go to work' },
    ];
    assert.equal(dailyRoutineProgress(history), 1);
    const reply = buildDailyRoutineFallbackTrainingReply(LESSON_ID, history, 2);
    assert.ok(reply);
    assert.equal(reply!.guidedSpeaking?.stem, '...');
  });

  it('double wrong answer soft-advances progress to 2', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'ready' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab' },
      { speaker: 'user', textEn: 'go to work' },
      { speaker: 'ai', textEn: 'ลองพูดตาม wake up' },
      { speaker: 'user', textEn: 'go to sleep' },
    ];
    assert.equal(dailyRoutineProgress(history), 2);
    const reply = buildDailyRoutineFallbackTrainingReply(LESSON_ID, history, 3);
    assert.ok(reply);
    assert.equal(reply!.guidedSpeaking?.stem, 'I wake up at...');
  });

  it('standalone AM does not complete AM/PM step (progress stays 4)', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'intro' },
      { speaker: 'user', textEn: "I'm ready" },
      { speaker: 'ai', textEn: 'vocab' },
      { speaker: 'user', textEn: 'wake up' },
      { speaker: 'ai', textEn: 'wake' },
      { speaker: 'user', textEn: "I wake up at 7 o'clock." },
      { speaker: 'ai', textEn: 'sleep' },
      { speaker: 'user', textEn: "I go to sleep at 11 o'clock." },
      { speaker: 'ai', textEn: 'ampm' },
      { speaker: 'user', textEn: 'AM' },
    ];
    assert.equal(dailyRoutineProgress(history), 4);
    const reply = buildDailyRoutineFallbackTrainingReply(LESSON_ID, history, 5);
    assert.ok(reply);
    assert.equal(reply!.guidedSpeaking?.stem, 'I wake up at 7...');
  });
});
