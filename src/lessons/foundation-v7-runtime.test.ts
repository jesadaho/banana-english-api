import assert from 'node:assert/strict';
import { V7_LEGACY_FLOWS } from './foundation-v7-legacy-flows';
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
  it('uses authored success transitions without duplicate automatic praise', async () => {
    const h = harness('fnd_v7_he_she_it_we_they');
    await h.say('He is a teacher.');
    assert.match(h.reply.textEn, /^ดีครับ /);
    assert.doesNotMatch(h.reply.textEn, /^ดีครับ ดี/);
    assert.doesNotMatch(h.reply.textEn, /He is a teacher\. แปลว่า/);
    assert.match(h.reply.textEn, /Anna เป็นครูผู้หญิง/);
  });
  it('recaps the selected family member and closes without a silent reuse turn', async () => {
    const h = harness('fnd_v7_my_family');
    while (h.reply.v7Step! < 5) await h.say(h.reply.expectedSpeech!);
    await h.say('This is my sister.');
    assert.equal(h.reply.v7Choice, 'This is my sister.');
    assert.match(h.reply.textEn, /พี่สาวหรือน้องสาว/);
    assert.equal(h.reply.isLessonComplete, true);
  });
  it('makes question-word answers reveal the next piece of information', async () => {
    const h = harness('fnd_v7_where_when_how_much_and_how_many');
    await h.say('Where is the class?');
    assert.match(h.reply.textEn, /ห้องข้าง/);
    await h.say('When is the class?');
    assert.match(h.reply.textEn, /On Monday/);
    await h.say('Where is the class?');
    await h.say('When is the class?');
    await h.say('How much is it?');
    assert.match(h.reply.textEn, /Thirty baht|สามสิบบาท/);
  });
  it('accepts non-first Do/Does personal choices and keeps direct address as Do you', async () => {
    const h = harness('fnd_v7_do_does_every_day');
    await h.say('Do you work every day?');
    assert.match(h.reply.textEn, /Yes, I do/);
    await h.say('Does he work every day?');
    assert.match(h.reply.textEn, /Yes, he does/);
    await h.say('Do you work every day?');
    assert.equal(h.reply.expectedSpeech, 'Does he work every day?');
    await h.say('Does he work every day?');
    await h.say('Does he work every day?');
    assert.equal(h.reply.expectedSpeech, 'Does she cook every day?');
  });
  it('uses emoji direction cues and transfers to an unaided two-step route', () => {
    const steps = V7_LEGACY_FLOWS.fnd_v7_go_straight_turn_left;
    assert.deepEqual(steps[3].presentation!.options.map(o => o.emoji), ['⬆️', '↩️', '↪️']);
    assert.equal(steps.at(-2)!.expectedSpeech, 'Go straight, then turn right.');
    assert.equal(steps.at(-2)!.presentation!.options.length, 0);
  });
  it('preserves V7 repair phrases and closes after the NPC repeats their name', async () => {
    const h = harness('fnd_v7_say_that_again');
    const answers: string[] = [];
    while (!h.reply.isLessonComplete) {
      answers.push(h.reply.expectedSpeech!);
      await h.say(h.reply.expectedSpeech!);
    }
    assert.deepEqual([...new Set(answers)].sort(), ['I do not understand', 'Please say that again', 'Please speak slowly'].sort());
    assert.match(h.reply.textEn, /My name is Teacher B.*จบบท/);
    assert.equal(h.reply.expectsUserSpeech, false);
  });
  it('connects asking for a ticket, asking its price and handing over payment', async () => {
    const h = harness('fnd_v7_prices_and_paying');
    while (h.reply.v7Step! < 6) await h.say(h.reply.expectedSpeech!);
    assert.equal(h.reply.expectedSpeech, 'One ticket, please.');
    await h.say('One ticket, please.');
    assert.equal(h.reply.expectedSpeech, 'How much is it?');
    await h.say('How much is it?');
    assert.match(h.reply.textEn, /It is forty baht/);
    assert.equal(h.reply.expectedSpeech, 'Here you are.');
    const before = h.reply.v7Step;
    await h.say('[continue]');
    assert.equal(h.reply.v7Step, before);
    await h.say('Here you are.');
    assert.equal(h.reply.isLessonComplete, true);
    assert.match(h.reply.textEn, /Thank you/);
  });
  it('practises Sorry before applying it to accidentally bumping into someone', () => {
    const steps = V7_LEGACY_FLOWS.fnd_v7_please_and_thank_you;
    assert.equal(steps[3].expectedSpeech, 'Sorry');
    assert.equal(steps[4].expectedSpeech, 'Sorry');
    assert.match(steps[4].presentation!.text, /เผลอชน/);
    assert.equal(steps[6].expectedSpeech, 'Excuse me');
    assert.equal(steps[6].presentation!.options.length, 0);
  });
  for (const [id, steps] of Object.entries(V7_LEGACY_FLOWS)) {
    steps.forEach((step, index) => {
      for (const option of step.presentation!.options) {
        it(`${id} step ${index + 1}: ${option.label}`, async () => {
          const h = harness(id);
          while (h.reply.v7Step! < index + 1) await h.say(h.reply.expectedSpeech!);
          const before = h.reply.v7Step!;
          await h.say('[continue]');
          assert.equal(h.reply.v7Step, before);
          const valid = step.presentation!.answerMode === 'any' || option.speak === step.expectedSpeech;
          await h.say(option.speak);
          assert.equal(h.reply.v7Step, before + (valid ? 1 : 0));
          assert.equal(h.calls, 0, 'card answers use deterministic assessment');
        });
      }
    });
  }
  it('teaches I am then You are across six speaking turns', async () => {
    const steps = V7_LEGACY_FLOWS.fnd_v7_i_am_you_are;
    assert.equal(steps[0].expectedSpeech, 'I am ready.');
    assert.equal(steps[0].presentation!.options.length, 0);
    assert.equal(steps[1].expectedSpeech, 'I am happy.');
    assert.deepEqual(steps[1].presentation!.options.map(o => o.label), ['am', 'are']);
    assert.equal(steps[1].presentation!.stem, 'I ... happy.');
    assert.equal(steps[2].expectedSpeech, 'You are ready.');
    assert.equal(steps[2].presentation!.options.length, 0);
    assert.equal(steps[3].expectedSpeech, 'You are tired.');
    assert.equal(steps[4].expectedSpeech, 'I am hungry.');
    assert.equal(steps[4].presentation!.stem, '... hungry.');
    assert.deepEqual(steps[4].presentation!.options.map(o => o.label), ['I am', 'You are']);
    assert.equal(steps[5].presentation!.answerMode, 'any');
    assert.deepEqual(steps[5].presentation!.options.map(o => o.label), ['happy', 'tired', 'hungry', 'ready']);

    const h = harness('fnd_v7_i_am_you_are');
    assert.equal(h.reply.guidedSpeaking, undefined);
    await h.say('I am ready.');
    assert.match(h.reply.textEn, /^ถูกต้องครับ /);
    assert.doesNotMatch(h.reply.textEn, /I am ready\. แปลว่า/);
    assert.match(h.reply.textEn, /ฉันมีความสุข/);
    await h.say('I am happy.');
    assert.match(h.reply.textEn, /^I am happy\. แปลว่า “ฉันมีความสุข”/);
    await h.say('You are ready.');
    assert.match(h.reply.textEn, /^ดีครับ /);
    assert.doesNotMatch(h.reply.textEn, /You are ready\. แปลว่า/);
    await h.say('You are tired.');
    assert.match(h.reply.textEn, /^You are tired\. แปลว่า “คุณเหนื่อย”/);
    await h.say('I am hungry.');
    assert.match(h.reply.textEn, /^I am hungry\. แปลว่า “ฉันหิว”/);
    assert.equal(h.reply.guidedSpeaking?.stem, 'I am ...');
    await h.say('I am tired.');
    assert.match(h.reply.textEn, /^I am tired\. แปลว่า “ฉันเหนื่อย”/);
    assert.match(h.reply.textEn, /จบบทแล้วครับ/);
    assert.equal(h.reply.isLessonComplete, true);
  });
  it('teaches not, Are you questions and short yes/no answers', async () => {
    const steps = V7_LEGACY_FLOWS.fnd_v7_not_and_are_you;
    assert.equal(steps[0].expectedSpeech, 'I am not tired.');
    assert.equal(steps[0].presentation!.options.length, 0);
    assert.equal(steps[1].expectedSpeech, 'I am not hungry.');
    assert.deepEqual(steps[1].presentation!.options.map(o => o.label), ['hungry', 'tired']);
    assert.equal(steps[2].expectedSpeech, 'Are you tired?');
    assert.equal(steps[2].presentation!.options.length, 0);
    assert.equal(steps[3].expectedSpeech, 'Are you ready?');
    assert.deepEqual(steps[3].presentation!.options.map(o => o.label), ['ready', 'hungry']);
    assert.equal(steps[4].expectedSpeech, 'Yes, I am.');
    assert.equal(steps[4].presentation!.options.length, 0);
    assert.equal(steps[5].expectedSpeech, 'No, I am not.');
    assert.equal(steps[5].presentation!.options.length, 0);
    assert.equal(steps[6].presentation!.answerMode, 'any');
    assert.deepEqual(steps[6].presentation!.options.map(o => o.label), ['Yes', 'No']);

    const yes = harness('fnd_v7_not_and_are_you');
    await yes.say('I am not tired.');
    assert.match(yes.reply.textEn, /^ถูกต้องครับ /);
    await yes.say('I am not hungry.');
    assert.match(yes.reply.textEn, /^I am not hungry\. แปลว่า “ฉันไม่หิว”/);
    await yes.say('Are you tired?');
    assert.match(yes.reply.textEn, /^ถูกต้องครับ /);
    await yes.say('Are you ready?');
    assert.match(yes.reply.textEn, /^Are you ready\? แปลว่า “คุณพร้อมไหม”/);
    await yes.say('Yes, I am.');
    assert.match(yes.reply.textEn, /^ถูกต้องครับ /);
    await yes.say('No, I am not.');
    assert.match(yes.reply.textEn, /^ดีครับ /);
    await yes.say('Yes, I am.');
    assert.match(yes.reply.textEn, /^Yes, I am\. ในคำถามนี้หมายถึง “ใช่ ฉันเหนื่อย”/);
    assert.equal(yes.reply.isLessonComplete, true);

    const no = harness('fnd_v7_not_and_are_you');
    while (no.reply.v7Step! < 7) await no.say(no.reply.expectedSpeech!);
    await no.say('No, I am not.');
    assert.match(no.reply.textEn, /^No, I am not\. ในคำถามนี้หมายถึง “ไม่ ฉันไม่เหนื่อย”/);
    assert.equal(no.reply.isLessonComplete, true);
  });
  it('does not use correct-answer praise on a first miss', async () => {
    const h = harness('fnd_v7_i_am_you_are');
    await h.say('I am ready.');
    await h.say('I are happy.');
    assert.equal(h.reply.v7Retry, true);
    assert.doesNotMatch(h.reply.textEn, /แปลว่า “ฉันมีความสุข”/);
    assert.match(h.reply.textEn, /ใช้ am กับ I/);
  });
  it('keeps the age transfer, rice and new composed number without answer leakage', () => {
    const age = V7_LEGACY_FLOWS.fnd_v7_eleven_to_twenty;
    assert.equal(age.at(-2)!.expectedSpeech, 'I am twenty years old.');
    const numbers = V7_LEGACY_FLOWS.fnd_v7_twenty_to_one_hundred;
    assert.equal(numbers.at(-2)!.expectedSpeech, 'sixty-two');
    assert.doesNotMatch(numbers.at(-2)!.presentation!.text, /sixty.two/i);
    assert.equal(numbers.at(-2)!.presentation!.options.length, 0);
    const likes = V7_LEGACY_FLOWS.fnd_v7_i_like_i_dont_like;
    assert.equal(likes[4].expectedSpeech, 'I like rice.');
    assert.equal(likes.at(-2)!.presentation!.answerMode, 'any');
  });
  it('accepts contractions, optional o\'clock, and asks for the full sentence after a label-only try', async () => {
    const likes = harness('fnd_v7_i_like_i_dont_like');
    await likes.say('I like coffee.');
    await likes.say('I like tea.');
    await likes.say('I do not like tea.');
    assert.equal(likes.reply.v7Step, 4);
    const time = harness('fnd_v7_what_time_is_it');
    await time.say('It is seven.');
    assert.equal(time.reply.v7Step, 2);
    await time.say('It is eight.');
    assert.equal(time.reply.v7Step, 3);
    const pronouns = harness('fnd_v7_he_she_it_we_they');
    await pronouns.say('He is a teacher.');
    await pronouns.say('She is a teacher.');
    await pronouns.say('She');
    assert.equal(pronouns.reply.v7Retry, true);
    assert.match(pronouns.reply.textEn, /ประโยคเต็ม/);
    await pronouns.say('She is a teacher.');
    assert.equal(pronouns.reply.v7Step, 4);
  });
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
    while (h.reply.expectedSpeech !== 'Here you are.') {
      assert.equal(h.reply.isLessonComplete, false);
      await h.say(h.reply.expectsUserSpeech ? h.reply.expectedSpeech! : '[continue]');
    }
    assert.equal(h.reply.expectsUserSpeech, true);
    const step = h.reply.v7Step;
    await h.say('[continue]');
    assert.equal(h.reply.expectsUserSpeech, true);
    assert.equal(h.reply.expectedSpeech, 'Here you are.');
    assert.equal(h.reply.v7Step, step);
    await h.say('Here you are.');
    assert.equal(h.reply.v7Step, step! + 1);
  });

  for (const [id, choice] of Object.entries(FOUNDATION_V7_CHOICE_BEATS)) {
    if (V7_LEGACY_FLOWS[id]) continue;
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
