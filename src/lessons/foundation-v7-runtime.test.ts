import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TrainingTurnEngine } from '../training/engine/training-turn.engine';
import type { TrainingAiGate } from '../training/engine/ai-gate';
import type { ChatTurn } from '../session-store/session-store.service';
import { FOUNDATION_V7_LESSONS } from './foundation-v7-lessons.data';
import { FOUNDATION_V7_CHOICE_BEATS } from './foundation-v7-choice-beats.data';
import { scriptedAiDebug } from '../common/ai-debug';

function harness(id: string) {
  let tier: 'correct' | 'close' | 'incorrect' = 'correct';
  let calls = 0;
  const engine = new TrainingTurnEngine({
    runChoiceLessonAssess: async () => {
      calls++;
      return { reply: { textEn: 'Great! Now repeat wrong content', textTh: '', isLessonComplete: true,
        expectsUserSpeech: false, assessmentTier: tier }, aiDebug: scriptedAiDebug() };
    },
  } as unknown as TrainingAiGate);
  const config = FOUNDATION_V7_LESSONS.find(c => c.lessonId === id)!;
  let reply = engine.buildOpening(config, 'Nana').reply;
  const turns: ChatTurn[] = [{ speaker: 'ai', ...reply }];
  return {
    get reply() { return reply; },
    get calls() { return calls; },
    config,
    setTier(value: typeof tier) { tier = value; },
    async say(text: string) {
      turns.push({ speaker: 'user', textEn: text });
      reply = (await engine.runTurn({ config, turns, userText: text, originalText: text,
        learnerFirstName: 'Nana', sessionProgressTurn: reply.v7Step })).reply;
      turns.push({ speaker: 'ai', ...reply });
      return reply;
    },
  };
}

describe('Foundation V7 server-owned runtime', () => {
  for (const lesson of FOUNDATION_V7_LESSONS) {
    for (const scenario of ['correct', 'close', 'off-topic', 'wrong-twice'] as const) {
      it(lesson.lessonId + ' / ' + scenario + ': progress, recovery and completion', async () => {
        const h = harness(lesson.lessonId);
        let injected = false;
        let count = 0;
        while (!h.reply.isLessonComplete && count++ < lesson.maxTurns) {
          const before = h.reply.v7Step!;
          if (!h.reply.expectsUserSpeech) {
            await h.say('[continue]');
            assert.equal(h.reply.v7Step, before + 1);
            continue;
          }
          const answer = h.reply.expectedSpeech!;
          assert.ok(answer);
          if (!injected && scenario !== 'correct') {
            injected = true;
            h.setTier(scenario === 'close' ? 'close' : 'incorrect');
            await h.say(scenario === 'close' ? 'recognizable near answer' : 'I like spaceships');
            if (scenario === 'close') {
              assert.equal(h.reply.v7Step, before + 1);
            } else {
              assert.equal(h.reply.v7Step, before);
              assert.equal(h.reply.v7Retry, true);
              if (scenario === 'wrong-twice') {
                const calls = h.calls;
                await h.say('still unrelated');
                assert.equal(h.calls, calls + 1, 'retry still accepts meaningful out-of-pool answers');
                assert.equal(h.reply.wasSoftAdvance, true);
              } else await h.say(answer);
              assert.equal(h.reply.v7Step, before + 1);
            }
            h.setTier('correct');
          } else {
            await h.say(answer);
            assert.equal(h.reply.v7Step, before + 1);
          }
          assert.doesNotMatch(h.reply.textEn, /Great!|wrong content/);
          assert.equal(h.reply.ttsText, h.reply.textEn);
        }
        assert.equal(h.reply.isLessonComplete, true);
        assert.equal(h.reply.v7Step, lesson.progressMax);
        assert.equal(h.reply.expectsUserSpeech, false);
      });
    }
  }

  it('keeps PoolGate Good morning / Hello there probes off-topic without asking Gemini', async () => {
    const h = harness('fnd_v7_say_that_again');
    while (!h.reply.expectsUserSpeech) {
      await h.say('[continue]');
    }
    const step = h.reply.v7Step;
    const calls = h.calls;
    await h.say('Good morning.');
    assert.equal(h.calls, calls);
    assert.equal(h.reply.v7Step, step);
    assert.equal(h.reply.v7Retry, true);
    assert.equal(h.reply.assessmentTier, 'incorrect');
    await h.say('Hello there.');
    assert.equal(h.calls, calls);
    assert.equal(h.reply.wasSoftAdvance, true);
    assert.equal(h.reply.v7Step, step! + 1);
  });

  it('Here you are opens speech and stale Continue never advances or traps a listen screen', async () => {
    const h = harness('fnd_v7_prices_and_paying');
    while (h.reply.expectedSpeech !== 'Here you are') {
      assert.equal(h.reply.isLessonComplete, false);
      await h.say(h.reply.expectsUserSpeech ? h.reply.expectedSpeech! : '[continue]');
    }
    assert.equal(h.reply.expectsUserSpeech, true);
    const step = h.reply.v7Step;
    await h.say('[continue]');
    assert.equal(h.reply.expectsUserSpeech, true);
    assert.equal(h.reply.expectedSpeech, 'Here you are');
    assert.equal(h.reply.v7Step, step);
    await h.say('Here you are');
    assert.equal(h.reply.v7Step, step! + 1);
  });

  for (const [id, choice] of Object.entries(FOUNDATION_V7_CHOICE_BEATS)) {
    for (const option of choice.options) {
      it(id + ' choice ' + option.label, async () => {
        const h = harness(id);
        while (!h.reply.guidedSpeaking) {
          assert.equal(h.reply.isLessonComplete, false);
          await h.say(h.reply.expectsUserSpeech ? h.reply.expectedSpeech! : '[continue]');
        }
        const board = h.reply.guidedSpeaking;
        const step = h.reply.v7Step!;
        assert.equal(h.reply.expectsUserSpeech, true);
        assert.ok(h.reply.textEn.includes(choice.promptTh));
        await h.say(option.speak);
        if (choice.answerMode === 'any' || option.speak === choice.expectedSpeech) {
          assert.equal(h.reply.v7Step, step + 1);
          if (choice.answerMode === 'any') assert.equal(h.reply.v7Choice, option.speak);
        } else {
          assert.equal(h.reply.v7Step, step);
          assert.deepEqual(h.reply.guidedSpeaking, board);
        }
      });
    }
  }
});
