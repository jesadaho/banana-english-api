import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FINAL_INTERVIEW_JOHN } from './interactive-scenario.data';
import {
  buildScenarioOpening,
  initScenarioRuntime,
  processScenarioTurn,
  scenarioHintForState,
  softMatchGoal,
} from './interactive-scenario.runtime';

describe('interactive scenario runtime', () => {
  it('soft-matches meaning without exact script', () => {
    const name = FINAL_INTERVIEW_JOHN.goals.find((g) => g.id === 'name')!;
    assert.equal(softMatchGoal('My name is Bee', name), true);
    assert.equal(softMatchGoal("I'm Luna", name), true);
    assert.equal(softMatchGoal('banana', name), false);
  });

  it('keeps checkpoints sticky across wrong answers and hints', () => {
    let state = initScenarioRuntime(FINAL_INTERVIEW_JOHN);
    const open = buildScenarioOpening(FINAL_INTERVIEW_JOHN, state);
    assert.ok(open.visual?.sceneId);

    ({ state } = processScenarioTurn({
      scenario: FINAL_INTERVIEW_JOHN,
      state,
      transcript: 'Hello!',
    }));
    assert.equal(state.checkpoints.greet, true);

    ({ state } = processScenarioTurn({
      scenario: FINAL_INTERVIEW_JOHN,
      state,
      transcript: 'zzz',
    }));
    assert.equal(state.checkpoints.greet, true);

    const hinted = scenarioHintForState(FINAL_INTERVIEW_JOHN, state);
    state = hinted.nextState;
    assert.ok(hinted.hints.length >= 1);
    assert.equal(state.checkpoints.greet, true);
  });

  it('completes when all goals pass without fixed turn count', () => {
    let state = initScenarioRuntime(FINAL_INTERVIEW_JOHN);
    const answers = [
      'Hi',
      'My name is Maya',
      "I'm from Thailand",
      'I like coffee',
      'I can swim',
      'How are you?',
      'See you tomorrow',
    ];
    let reply = buildScenarioOpening(FINAL_INTERVIEW_JOHN, state);
    for (const transcript of answers) {
      ({ state, reply } = processScenarioTurn({
        scenario: FINAL_INTERVIEW_JOHN,
        state,
        transcript,
      }));
    }
    assert.equal(reply.isTaskComplete, true);
    assert.ok(Object.values(state.checkpoints).every(Boolean));
  });

  it('does not put Thai into NPC speech on incorrect retry', () => {
    let state = initScenarioRuntime(FINAL_INTERVIEW_JOHN);
    ({ state } = processScenarioTurn({
      scenario: FINAL_INTERVIEW_JOHN,
      state,
      transcript: 'asdf',
    }));
    const { reply } = processScenarioTurn({
      scenario: FINAL_INTERVIEW_JOHN,
      state,
      transcript: 'asdf',
    });
    assert.doesNotMatch(reply.aiResponse, /[\u0E00-\u0E7F]/);
    assert.match(reply.textTh, /[\u0E00-\u0E7F]/);
  });
});
