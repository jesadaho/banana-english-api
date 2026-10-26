import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NINA_INTERVIEW } from './nina-interview.data';
import {
  answerLearnerQuestion,
  buildScenarioOpening,
  extractClub,
  extractHobby,
  extractWhen,
  initScenarioRuntime,
  processScenarioTurn,
  softMatchGoal,
} from './interactive-scenario.runtime';

const N = NINA_INTERVIEW;

const HAPPY = [
  'I like playing games.',
  'I play games every day.',
  "It's under the table.",
  'The man with glasses.',
  "They're flying a kite.",
  "I'm good at painting.",
  "I'll join the art club.",
  'Because I like painting.',
  'What are you good at?',
  "Sorry, I'm busy.",
  'How about Saturday evening?',
  "It's 120 baht.",
];

function run(answers: string[]) {
  let s = initScenarioRuntime(N);
  let reply = buildScenarioOpening(N, s);
  const replies = [reply];
  for (const transcript of answers) {
    ({ state: s, reply } = processScenarioTurn({ scenario: N, state: s, transcript }));
    replies.push(reply);
  }
  return { state: s, reply, replies };
}

describe('Adventure A2 Nina interview', () => {
  it('fails wrong answers on fixed-answer picture questions', () => {
    const goal = (id: string) => N.goals.find((g) => g.id === id)!;
    assert.equal(softMatchGoal("It's on the table.", goal('cat_under')), false);
    assert.equal(softMatchGoal("It's 100 baht.", goal('bag_price')), false);
    assert.equal(softMatchGoal('On Friday.', goal('suggest_saturday')), false);
    assert.equal(goal('join_club').requiresPattern, undefined);
    for (const id of ['cat_under', 'yellow_circle', 'flying_kite', 'busy_friday', 'suggest_saturday', 'bag_price']) {
      assert.equal(goal(id).requiresPattern, true, id);
    }
  });

  it('is a 12-beat Teacher Nina Zone 1 boss using A2 picture cards', () => {
    assert.equal(N.id, 'a2_c08n10');
    assert.equal(N.teacher, 'nina');
    assert.equal(N.ttsVoiceProfile, 'teacher_nina');
    assert.equal(N.bananaCost, 3);
    assert.equal(N.beats.length, 12);
    assert.equal(N.goals.length, 12);
    assert.match(N.openingEn, /Hi! I'm Nina/);
    assert.equal(N.beats[8]!.learnerMayAsk, true);
    assert.equal(N.beats.filter((b) => b.learnerMayAsk).length, 1);
    assert.equal(N.beats[10]!.skipWhenSlot?.slot, 'when');
    assert.match(N.beats[9]!.promptEn, /Shall we meet on Friday evening\?/);
    assert.match(N.beats[10]!.promptEn, /When are you free\?/);
    const images = N.beats.filter((b) => b.imagePath).map((b) => b.imagePath);
    assert.deepEqual(images, [
      'describe-it/a2_c03n08/05.webp',
      'describe-it/a2_c04n09/01.webp',
      'describe-it/a2_c05n07/04.webp',
      'describe-it/a2_c06n10/04.webp',
      'describe-it/a2_c07n10/03.webp',
      'describe-it/a2_c07n10/03.webp',
      'describe-it/a2_c08n05/02.webp',
    ]);
  });

  it('happy path: 12 answers, Nina answers her skill', () => {
    const { state, reply, replies } = run(HAPPY);
    assert.equal(reply.isTaskComplete, true);
    assert.ok(Object.values(state.checkpoints).every(Boolean));
    assert.equal(state.slots.hobby, 'playing games');
    assert.equal(state.slots.club, 'art club');
    assert.match(replies[9]!.aiResponse, /I'm good at exploring new places! Great question!/);
    assert.match(reply.aiResponse, /See you in the city/);
    assert.match(reply.textTh, /นะคะ/);
  });

  it('skips the Saturday prompt when the learner already suggested it', () => {
    const early = run(HAPPY.slice(0, 9));
    const r = processScenarioTurn({
      scenario: N,
      state: early.state,
      transcript: "Sorry, I'm busy. How about Saturday evening?",
    });
    assert.equal(r.state.checkpoints.busy_friday, true);
    assert.equal(r.state.checkpoints.suggest_saturday, true);
    assert.match(r.reply.aiResponse, /Saturday evening\? Great!/);
    assert.match(r.reply.aiResponse, /How much is the bag\?/);
    assert.doesNotMatch(r.reply.aiResponse, /When are you free/);
  });

  it('accepts uncertainty for “what are you good at”', () => {
    const early = run(HAPPY.slice(0, 5));
    const r = processScenarioTurn({
      scenario: N,
      state: early.state,
      transcript: "I'm not sure.",
    });
    assert.equal(r.state.checkpoints.good_at, true);
    assert.equal(r.reply.assessmentTier, 'correct');
  });

  it('extracts hobby, club and Saturday from learner turns', () => {
    assert.equal(extractHobby('I like playing games.'), 'playing games');
    assert.equal(extractClub("I'd like to join the art club."), 'art club');
    assert.equal(extractWhen('How about Saturday evening?'), 'Saturday evening');
  });

  it('answers as Nina the seller and the teacher', () => {
    assert.equal(answerLearnerQuestion('What are you good at?', 'nina'), "I'm good at exploring new places!");
    assert.equal(answerLearnerQuestion('How much is the key ring?', 'nina'), "It's 80 baht.");
    assert.equal(answerLearnerQuestion("What's your name?", 'nina'), 'My name is Nina!');
  });
});
