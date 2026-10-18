import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPlacementQuestion } from './placement.bank';
import {
  bandStatus,
  highestConfirmedBand,
  resultLabelFor,
} from './placement.routing';
import {
  applyPlacementEvaluation,
  buildPlacementOpening,
  heuristicPlacementEval,
  initPlacementRuntime,
  makeItemResult,
} from './placement.runtime';
import type { PlacementRuntimeState, PlacementScore } from './placement.types';

function score(
  state: PlacementRuntimeState,
  value: PlacementScore,
  transcript = 'ok',
) {
  const q = getPlacementQuestion(state.currentQuestionId!)!;
  return applyPlacementEvaluation(
    state,
    makeItemResult(q, state, {
      status: 'scored',
      score: value,
      eligibleForPlacement: true,
      evidence: [transcript],
      reasonCode: value === 2 ? 'target_met' : value === 1 ? 'target_partially_demonstrated' : 'off_topic',
    }),
  );
}

describe('placement band status', () => {
  it('confirms 2,2,2,1', () => {
    assert.equal(bandStatus([2, 2, 2, 1]), 'confirmed');
  });
  it('does not confirm 2,2,2,0', () => {
    assert.equal(bandStatus([2, 2, 2, 0]), 'not_confirmed');
  });
  it('needs four eligible scores', () => {
    assert.equal(bandStatus([2, 2, 2, null]), 'insufficient_evidence');
  });
});

describe('placement routing', () => {
  it('starts Q01 with onboarding opening and the learner name', () => {
    const { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    assert.equal(state.currentQuestionId, 'Q01');
    assert.match(reply.aiResponse, /Teacher Bee/);
    assert.match(reply.aiResponse, /Hi, Maya/);
    assert.match(reply.textTh, /ครูพี่บี/);
    assert.equal(reply.canSkip, true);
  });

  it('uses the settings opening when entrySource is profile_settings', () => {
    const { reply } = buildPlacementOpening(
      initPlacementRuntime({
        entrySource: 'profile_settings',
        learnerName: 'Maya',
      }),
    );
    assert.match(reply.aiResponse, /level check/i);
    assert.doesNotMatch(reply.aiResponse, /Teacher Bee. I help/);
  });

  it('confirms A1 then asks Q05', () => {
    let { state } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    for (const s of [2, 2, 2, 1] as PlacementScore[]) {
      ({ state } = score(state, s));
    }
    assert.equal(highestConfirmedBand(state), 'A1');
    assert.equal(state.currentQuestionId, 'Q05');
    assert.equal(state.finished, false);
  });

  it('stops after A1 is not confirmed and does not claim A1', () => {
    let { state } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    let reply;
    for (const s of [2, 2, 0, 1] as PlacementScore[]) {
      ({ state, reply } = score(state, s));
    }
    assert.equal(state.finished, true);
    assert.equal(state.result?.demonstratedBand, null);
    assert.equal(state.result?.resultLabel, 'เริ่มจากพื้นฐาน');
    assert.equal(state.result?.recommendedStartKey, 'foundation_beginning');
    assert.equal(reply?.isTaskComplete, true);
    assert.doesNotMatch(reply?.textTh ?? '', /20 ข้อ/);
  });

  it('early-stops after three eligible zeros in the band', () => {
    let { state } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    ({ state } = score(state, 0));
    ({ state } = score(state, 0));
    assert.equal(state.finished, false);
    ({ state } = score(state, 0));
    assert.equal(state.finished, true);
    assert.equal(state.result?.stopReason, 'early_zero_streak');
  });

  it('does not treat skip as missing evidence', () => {
    let { state } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    const q = getPlacementQuestion('Q01')!;
    ({ state } = applyPlacementEvaluation(
      state,
      makeItemResult(q, state, {
        status: 'skipped',
        score: 0,
        eligibleForPlacement: true,
        evidence: [],
        reasonCode: 'user_skipped',
      }),
    ));
    assert.equal(state.results.Q01?.eligibleForPlacement, true);
    assert.equal(state.results.Q01?.score, 0);
    assert.equal(state.currentQuestionId, 'Q02');
  });
});

describe('placement heuristics', () => {
  it('gives 2 to Book / Water please / At nine thirty', () => {
    const q03 = getPlacementQuestion('Q03')!;
    const q04 = getPlacementQuestion('Q04')!;
    const q10 = getPlacementQuestion('Q10')!;
    assert.equal(heuristicPlacementEval(q03, 'A book', false)?.score, 2);
    assert.equal(heuristicPlacementEval(q04, 'Water, please.', false)?.score, 2);
    assert.equal(heuristicPlacementEval(q10, 'At nine thirty.', false)?.score, 2);
  });

  it('gives 1 to I went shopping without a companion', () => {
    const q11 = getPlacementQuestion('Q11')!;
    assert.equal(heuristicPlacementEval(q11, 'I went shopping.', false)?.score, 1);
    assert.equal(
      heuristicPlacementEval(q11, 'I went shopping with my friend.', false)?.score,
      2,
    );
  });

  it('gives 1 to Thai-only answers that still show intent', () => {
    const q01 = getPlacementQuestion('Q01')!;
    assert.equal(heuristicPlacementEval(q01, 'เหนื่อยครับ', false)?.score, 1);
  });
});

describe('placement result labels', () => {
  it('maps internal .5 bands for display', () => {
    assert.equal(resultLabelFor('A1.5'), 'A1 · พื้นฐานคล่องขึ้น');
    assert.equal(resultLabelFor('A2.5'), 'A2 · พร้อมต่อยอด');
    assert.equal(resultLabelFor('B1'), 'B1 · สื่อสารในชีวิตประจำวัน');
  });
});
