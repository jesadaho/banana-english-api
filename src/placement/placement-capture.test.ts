import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPlacementQuestion } from './placement.bank';
import {
  applyPlacementEvaluation,
  buildPlacementOpening,
  initPlacementRuntime,
  heuristicPlacementEval,
  makeItemResult,
  placementCaptureNoise,
  placementEchoOfTeacher,
  placementSaysCannotAnswer,
} from './placement.runtime';
import type { PlacementRuntimeState } from './placement.types';

describe('placement capture checks', () => {
  it('flags ASR noise on silence', () => {
    for (const t of ['Thank you.', 'Thanks!', "I'm a T", 'T', 'Great!']) {
      assert.equal(placementCaptureNoise(t), true, t);
    }
  });

  it('treats translated Thai "cannot" as a 0, not noise', () => {
    for (const t of [
      "You can't do it.",
      "I don't know.",
      "I don't understand.",
      'I cannot do it.',
      "I don't know the answer.",
      "Sorry, I can't.",
    ]) {
      assert.equal(placementCaptureNoise(t), false, t);
      assert.equal(placementSaysCannotAnswer(t), true, t);
    }
    const q = getPlacementQuestion('Q02')!;
    const row = heuristicPlacementEval(q, "You can't do it.", false);
    assert.equal(row?.score, 0);
    assert.equal(row?.eligibleForPlacement, true);
    assert.equal(row?.reasonCode, 'no_communicative_answer');
  });

  it('flags the learner repeating the teacher line', () => {
    assert.equal(
      placementEchoOfTeacher(
        'Thanks. Tell me about one person in your family or a friend.',
        'Tell me about one person in your family or a friend.',
      ),
      true,
    );
  });

  it('keeps real answers, short ones included', () => {
    const q03 = 'My bag is blue. Is this my bag?';
    for (const t of ['No.', "No, it isn't.", 'My bag is red.', 'No, this is not your bag.']) {
      assert.equal(placementCaptureNoise(t), false, t);
      assert.equal(placementEchoOfTeacher(t, q03), false, t);
      assert.equal(placementSaysCannotAnswer(t), false, t);
    }
    assert.equal(placementEchoOfTeacher("I'm from Thailand.", 'Where are you from?'), false);
    assert.equal(placementSaysCannotAnswer("I'm a Thai."), false);
    assert.equal(placementSaysCannotAnswer("I don't know her name."), false);
  });
});

function opened(): PlacementRuntimeState {
  return buildPlacementOpening(
    initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
  ).state;
}

function retryItem(state: PlacementRuntimeState) {
  const q = getPlacementQuestion(state.currentQuestionId!)!;
  return makeItemResult(q, state, {
    status: 'technical_retry',
    score: null,
    eligibleForPlacement: false,
    evidence: [],
    reasonCode: 'capture_error',
    reason: 'noise',
  });
}

function zeroItem(state: PlacementRuntimeState) {
  const q = getPlacementQuestion(state.currentQuestionId!)!;
  return makeItemResult(q, state, {
    status: 'scored',
    score: 0,
    eligibleForPlacement: true,
    evidence: ['x'],
    reasonCode: 'off_topic',
    reason: 'x',
  });
}

describe('capture failures', () => {
  it('asks once more, then stores 0 that still counts for the stage', () => {
    let state = opened();
    const first = state.currentQuestionId;
    state = applyPlacementEvaluation(state, retryItem(state)).state;
    assert.equal(state.currentQuestionId, first);
    assert.equal(state.results[first!], undefined);
    state = applyPlacementEvaluation(state, retryItem(state)).state;
    const row = state.results[first!]!;
    assert.equal(row.score, 0);
    assert.equal(row.eligibleForPlacement, true);
    assert.equal(row.reasonCode, 'capture_error');
  });

  it('capture failures do not trigger the three-zeros early stop', () => {
    let state = opened();
    for (let i = 0; i < 2; i++) {
      state = applyPlacementEvaluation(state, retryItem(state)).state;
      state = applyPlacementEvaluation(state, retryItem(state)).state;
    }
    state = applyPlacementEvaluation(state, zeroItem(state)).state;
    assert.equal(state.finished, false);
  });
});
