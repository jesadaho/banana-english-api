import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FINAL_INTERVIEW_JOHN } from './interactive-scenario.data';
import {
  answerLearnerQuestion,
  buildScenarioOpening,
  extractCity,
  extractName,
  initScenarioRuntime,
  isScenarioNoise,
  processScenarioTurn,
  scenarioHintForState,
  softMatchGoal,
  type ScenarioRuntimeState,
} from './interactive-scenario.runtime';

const S = FINAL_INTERVIEW_JOHN;

/** One good answer per beat, in order (beat 1 = ungraded "Are you ready?"). */
const HAPPY_ANSWERS = [
  'Yes, I am ready!',
  'Hello! My name is Maya.',
  "I'm from Chiang Mai.",
  'I am twenty years old.',
  'This is my brother. He is a student.',
  'No, it is not. That is your bag.',
  'I have a phone and a key.',
  'There are three apples.',
  'I wake up at seven.',
  'She wakes up at seven. She works at eight.',
  'He is eating.',
  "I like tea. I don't like coffee.",
  'Yes, I can.',
  'Can you cook?',
  'How much is the red shirt?',
  'Go straight and turn left.',
  'Thank you! Goodbye!',
];

function run(answers: string[], state?: ScenarioRuntimeState) {
  let s = state ?? initScenarioRuntime(S);
  let reply = buildScenarioOpening(S, s);
  const replies = [reply];
  for (const transcript of answers) {
    ({ state: s, reply } = processScenarioTurn({ scenario: S, state: s, transcript }));
    replies.push(reply);
  }
  return { state: s, reply, replies };
}

describe('final interview (17 turns) — authoring', () => {
  it('ungraded intro + 16 scored beats covering chapters 1–16', () => {
    assert.equal(S.beats.length, 17);
    assert.equal(S.beats[0]!.ungraded, true);
    assert.deepEqual(S.beats[0]!.focusGoalIds, []);
    assert.equal(S.goals.length, 16);
    const used = S.beats.flatMap((b) => b.focusGoalIds);
    assert.deepEqual([...used].sort(), S.goals.map((g) => g.id).sort());
    const chapters = new Set(S.goals.flatMap((g) => g.measuresChapters ?? []));
    assert.deepEqual([...chapters].sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it('asks one question per turn', () => {
    for (const b of S.beats) {
      assert.ok((b.promptEn.match(/\?/g) ?? []).length <= 1, `${b.id}: ${b.promptEn}`);
    }
  });

  it('shows a picture card instead of emoji cards on stimulus beats', () => {
    const withImage = S.beats.filter((b) => b.imagePath).map((b) => b.focusGoalIds[0]);
    assert.deepEqual(withImage, [
      'this_that', 'plural', 'her_day', 'happening_now', 'ask_price', 'directions',
    ]);
    for (const b of S.beats) {
      if (b.imagePath) assert.equal(b.emojiChoice, undefined, b.id);
    }
  });

  it('opens with the final-boss "Are you ready?" intro', () => {
    const open = buildScenarioOpening(S, initScenarioRuntime(S));
    assert.match(open.aiResponse, /Are you ready\?/);
    assert.match(open.aiResponse, /Finally/);
    assert.ok(open.visual?.sceneId);
  });

  it('keeps NPC speech English-only and every beat has praise or is the last', () => {
    for (const b of S.beats) {
      assert.doesNotMatch(b.promptEn, /[฀-๿]/, b.id);
      for (const p of b.praiseEn) assert.doesNotMatch(p, /[฀-๿]/, b.id);
    }
    for (const b of S.beats.slice(0, -1)) assert.ok(b.praiseEn.length > 0, b.id);
  });

  it('uses no flag emoji (they do not render on web)', () => {
    const flags = /[\u{1F1E6}-\u{1F1FF}]/u;
    for (const b of S.beats) {
      for (const o of b.emojiChoice?.options ?? []) assert.doesNotMatch(o.emoji, flags, b.id);
      if (b.retryGuided) assert.doesNotMatch(b.retryGuided.emoji, flags, b.id);
    }
  });

  it('every accept example passes its own goal locally', () => {
    for (const g of S.goals) {
      for (const ex of g.acceptExamples) {
        assert.equal(softMatchGoal(ex, g), true, `${g.id}: ${ex}`);
      }
    }
  });

  it('every retry scaffold answer passes its beat', () => {
    for (const b of S.beats) {
      if (!b.focusGoalIds.length) continue;
      const g = S.goals.find((x) => x.id === b.focusGoalIds[0])!;
      if (b.retryGuided) assert.equal(softMatchGoal(b.retryGuided.speak, g), true, b.id);
    }
  });
});

describe('final interview (17 turns) — runtime', () => {
  it('happy path: 17 answers → complete, all goals, praise before next prompt', () => {
    const { state, reply, replies } = run(HAPPY_ANSWERS);
    assert.equal(reply.isTaskComplete, true);
    assert.ok(Object.values(state.checkpoints).every(Boolean));
    assert.equal(state.slots.name, 'Maya');
    assert.equal(state.slots.city, 'Chiang Mai');
    assert.match(replies[1]!.aiResponse, /^Ha! I like that\. Let's begin\. Hello! I am Teacher John/);
    assert.match(replies[2]!.aiResponse, /^Nice to meet you, Maya! Where are you from\?$/);
    assert.match(replies[3]!.aiResponse, /^Oh, Chiang Mai! Cool! How old are you\?$/);
    // John answers the learner's question before praising.
    assert.match(replies[14]!.aiResponse, /^Yes, I can! Great question!/);
    // Price answer is given.
    assert.match(replies[15]!.aiResponse, /fifty baht/);
    // Closing uses the name.
    assert.match(replies[16]!.aiResponse, /^Thank you! Very clear! Maya… you passed my test!/);
    assert.match(reply.aiResponse, /Goodbye, Maya!/);
    assert.equal(reply.expectsUserSpeech, false);
  });

  it('intro accepts anything (even noise) and scores nothing', () => {
    const r = processScenarioTurn({ scenario: S, state: initScenarioRuntime(S), transcript: 'uh' });
    assert.equal(r.state.beatIndex, 1);
    assert.equal(r.reply.assessmentTier, 'correct');
    assert.ok(Object.values(r.state.checkpoints).every((v) => v === false));
    assert.match(r.reply.aiResponse, /What is your name\?$/);
  });

  it('wrong answer (assessment): short reveal and move on at once', () => {
    let state = initScenarioRuntime(S);
    ({ state } = processScenarioTurn({ scenario: S, state, transcript: 'Yes' }));
    const r = processScenarioTurn({ scenario: S, state, transcript: 'I like coffee' });
    assert.equal(r.reply.assessmentTier, 'incorrect');
    assert.equal(r.reply.wasSoftAdvance, true);
    assert.equal(r.state.beatIndex, 2);
    assert.equal(r.state.checkpoints.name, false);
    assert.equal(r.state.goalOutcomes.name, 'skipped');
    assert.equal(r.reply.aiResponse, 'You can say: My name is Maya. Next! Where are you from?');
    assert.match(r.reply.textTh, /^เฉลย: “My name is Maya\.” · /);
    assert.equal(r.reply.guidedSpeaking ?? null, null);
  });

  it('AI judge "close" passes and recasts the learner\'s own sentence', () => {
    let state = initScenarioRuntime(S);
    for (const t of HAPPY_ANSWERS.slice(0, 8)) {
      ({ state } = processScenarioTurn({ scenario: S, state, transcript: t }));
    }
    assert.equal(S.beats[state.beatIndex]!.focusGoalIds[0], 'wake_time');
    const r = processScenarioTurn({
      scenario: S,
      state,
      transcript: 'I wake up in morning',
      judge: 'close',
      judgeCorrected: 'I wake up in the morning',
    });
    assert.equal(r.state.checkpoints.wake_time, true);
    assert.equal(r.state.goalOutcomes.wake_time, 'close');
    assert.equal(r.reply.assessmentTier, 'close');
    assert.match(r.reply.aiResponse, /We say: I wake up in the morning\. This is May's day/);
    assert.match(r.reply.textTh, /^เกือบถูกแล้ว! พูดว่า “I wake up in the morning\.”/);
  });

  it('all wrong answers still finish in exactly 17 turns with all goals skipped', () => {
    const { reply, state, replies } = run(Array(17).fill('zzz'));
    assert.equal(replies.length, 18);
    assert.equal(reply.isTaskComplete, true);
    assert.equal(state.finished, true);
    assert.ok(Object.values(state.checkpoints).every((v) => v === false));
    assert.match(reply.aiResponse, /^You can say: Thank you! Goodbye! See you! Goodbye, my friend!/);
  });

  it('keeps NPC speech English-only on a wrong answer', () => {
    let state = initScenarioRuntime(S);
    ({ state } = processScenarioTurn({ scenario: S, state, transcript: 'yes' }));
    const { reply } = processScenarioTurn({ scenario: S, state, transcript: 'asdf' });
    assert.doesNotMatch(reply.aiResponse, /[฀-๿]/);
    assert.match(reply.textTh, /[฀-๿]/);
  });

  it('flags noise so the controller skips the AI judge', () => {
    assert.equal(isScenarioNoise(''), true);
    assert.equal(isScenarioNoise('uh'), true);
    assert.equal(isScenarioNoise('I like tea'), false);
  });

  it('hints follow the current scored beat', () => {
    let state = initScenarioRuntime(S);
    assert.deepEqual(scenarioHintForState(S, state).hints, []);
    ({ state } = processScenarioTurn({ scenario: S, state, transcript: 'Yes!' }));
    const hinted = scenarioHintForState(S, state);
    assert.ok(hinted.hints.length >= 1);
    assert.equal(hinted.hints[0]!.id, 'name_intent');
    assert.equal(hinted.nextState.hintsUsed, 1);
  });

  it('tolerates legacy in-memory state without new fields', () => {
    const legacy = {
      scenarioId: S.id,
      beatIndex: 0,
      checkpoints: {},
      attemptCount: 0,
      hintsUsed: 0,
      goalHintLevels: {},
    } as unknown as ScenarioRuntimeState;
    const r = processScenarioTurn({ scenario: S, state: legacy, transcript: 'yes' });
    assert.equal(r.state.beatIndex, 1);
  });
});

describe('final interview — helpers', () => {
  it('extracts names and cities', () => {
    assert.equal(extractName('My name is maya'), 'Maya');
    assert.equal(extractName("I'm Max."), 'Max');
    assert.equal(extractName('Somchai'), 'Somchai');
    assert.equal(extractName("I'm ready"), null);
    assert.equal(extractName('Hi'), null);
    assert.equal(extractName('Thailand'), null);
    assert.equal(extractName("I'm from Thailand"), null);
    assert.equal(extractCity('I live in Chiang Mai and I am happy'), 'Chiang Mai');
    assert.equal(extractCity("I'm from Thailand."), 'Thailand');
    assert.equal(extractCity('hello'), null);
  });

  it('answers common learner questions', () => {
    assert.equal(answerLearnerQuestion('How are you?'), "I'm great, thank you!");
    assert.equal(answerLearnerQuestion('What is your name?'), 'My name is John. I am your teacher!');
    assert.equal(answerLearnerQuestion('Where are you from?'), "I'm from Canada.");
    assert.equal(answerLearnerQuestion('Do you like coffee?'), 'Yes, I do!');
    assert.equal(answerLearnerQuestion('Can you swim?'), 'Yes, I can!');
  });

  it('matches whole words only in accept examples', () => {
    const g = S.goals.find((x) => x.id === 'like')!;
    assert.equal(softMatchGoal('likely', g), false);
    assert.equal(softMatchGoal('I like tea', g), true);
  });
});
