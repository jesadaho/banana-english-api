import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLACEMENT_QUESTIONS,
  PLACEMENT_STAGES,
  getPlacementQuestion,
} from './placement.bank';
import {
  a1Gate,
  a1PlusGate,
  a2Gate,
  a2PlusGate,
  b1Gate,
  buildSessionResult,
  entryGate,
  evaluateGates,
  publicResultFor,
  resultLabelFor,
} from './placement.routing';
import {
  applyPlacementEvaluation,
  buildPlacementOpening,
  heuristicPlacementEval,
  initPlacementRuntime,
  makeItemResult,
} from './placement.runtime';
import type {
  PlacementItemResult,
  PlacementRuntimeState,
  PlacementScore,
} from './placement.types';
import {
  PLACEMENT_MAPPING_VERSION,
  PLACEMENT_RUBRIC_VERSION,
  PLACEMENT_SCENARIO_ID,
} from './placement.types';

function emptyState(): PlacementRuntimeState {
  return initPlacementRuntime({
    entrySource: 'onboarding',
    learnerName: 'Maya',
  });
}

function putScore(
  state: PlacementRuntimeState,
  id: string,
  score: PlacementScore | null,
  opts?: { eligible?: boolean; status?: PlacementItemResult['status'] },
): void {
  const eligible = opts?.eligible ?? score !== null;
  const status =
    opts?.status ??
    (score === null ? 'needs_review' : 'scored');
  state.results[id] = {
    questionId: id,
    attemptId: id,
    status,
    score,
    eligibleForPlacement: eligible,
    evidence: [],
    reasonCode:
      score === 2
        ? 'target_met'
        : score === 1
          ? 'target_partially_demonstrated'
          : score === 0
            ? 'off_topic'
            : 'uncertain_transcription',
    exactPrompt: '',
    variantId: `${id}.base`,
  };
  if (!state.askedQuestionIds.includes(id)) state.askedQuestionIds.push(id);
}

function fill(
  ids: string[],
  scores: Array<PlacementScore | null>,
  opts?: { eligible?: boolean; status?: PlacementItemResult['status'] },
): PlacementRuntimeState {
  const state = emptyState();
  ids.forEach((id, i) => putScore(state, id, scores[i]!, opts));
  return state;
}

const ENTRY = PLACEMENT_STAGES[0]!.questionIds;
const A1 = PLACEMENT_STAGES[1]!.questionIds;
const A2 = PLACEMENT_STAGES[2]!.questionIds;
const B1 = PLACEMENT_STAGES[3]!.questionIds;

function passEntry(state: PlacementRuntimeState) {
  ENTRY.forEach((id, i) => putScore(state, id, i === 5 ? 1 : 2));
}

function passA1(state: PlacementRuntimeState) {
  passEntry(state);
  A1.forEach((id, i) => putScore(state, id, i === 2 ? 2 : i === 1 ? 1 : 2));
}

function scoreWalk(
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
      reasonCode:
        value === 2
          ? 'target_met'
          : value === 1
            ? 'target_partially_demonstrated'
            : 'off_topic',
    }),
  );
}

describe('placement bank v1.5', () => {
  it('has 20 unique question IDs in 6+4+6+4 stages', () => {
    const ids = PLACEMENT_QUESTIONS.map((q) => q.id);
    assert.equal(ids.length, 20);
    assert.equal(new Set(ids).size, 20);
    assert.deepEqual(
      PLACEMENT_STAGES.map((s) => s.questionIds.length),
      [6, 4, 6, 4],
    );
  });

  it('starts audio-only at Q11, not Q09', () => {
    for (const q of PLACEMENT_QUESTIONS) {
      const n = Number(q.id.slice(1));
      if (n <= 10) {
        assert.equal(q.delivery === 'audio_only' || q.delivery === 'picture_audio', false);
      } else {
        assert.ok(
          q.delivery === 'audio_only' || q.delivery === 'picture_audio',
          q.id,
        );
      }
    }
    assert.equal(getPlacementQuestion('Q11')?.transitionTh?.includes('ไม่มีข้อความ'), true);
    assert.equal(getPlacementQuestion('Q09')?.transitionTh, undefined);
  });
});

describe('placement gates v1.5', () => {
  it('entry [2,2,2,2,2,1] with Q03/Q04=2 passes entry and is not A1', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 2, 1]);
    assert.equal(entryGate(state), true);
    assert.equal(a1Gate(state), false);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed+');
    assert.match(resultLabelFor('Seed+', { incompleteNext: true }), /ยังประเมินระดับถัดไปไม่ครบ/);
  });

  it('entry Q04=1 even if others are 2 fails entry → Seed', () => {
    const state = fill(ENTRY, [2, 2, 2, 1, 2, 2]);
    assert.equal(entryGate(state), false);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed');
  });

  it('entry pass + A1 [2,2,1,2] fails A1Gate because Q09 is not 2 → Seed+', () => {
    const state = emptyState();
    passEntry(state);
    putScore(state, 'Q07', 2);
    putScore(state, 'Q08', 2);
    putScore(state, 'Q09', 1);
    putScore(state, 'Q10', 2);
    assert.equal(entryGate(state), true);
    assert.equal(a1Gate(state), false);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed+');
  });

  it('A2 [1,2,2,2,1,1] is A1+ not A2', () => {
    const state = emptyState();
    passA1(state);
    fillA2(state, [1, 2, 2, 2, 1, 1]);
    assert.equal(a2Gate(state), false);
    assert.equal(a1PlusGate(state), true);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'A1+');
  });

  it('A2 [2,1,2,2,2,1] passes A2Gate', () => {
    const state = emptyState();
    passA1(state);
    fillA2(state, [2, 1, 2, 2, 2, 1]);
    assert.equal(a2Gate(state), true);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'A2');
  });

  it('B1 [2,1,2,1] is A2+; [2,2,2,1] is B1', () => {
    const near = emptyState();
    passA1(near);
    fillA2(near, [2, 1, 2, 2, 2, 1]);
    B1.forEach((id, i) => putScore(near, id, ([2, 1, 2, 1] as PlacementScore[])[i]!));
    assert.equal(b1Gate(near), false);
    assert.equal(a2PlusGate(near), true);
    assert.equal(publicResultFor(near, 'band_not_confirmed'), 'A2+');

    const full = emptyState();
    passA1(full);
    fillA2(full, [2, 1, 2, 2, 2, 1]);
    B1.forEach((id, i) => putScore(full, id, ([2, 2, 2, 1] as PlacementScore[])[i]!));
    assert.equal(b1Gate(full), true);
    assert.equal(publicResultFor(full, 'b1_confirmed'), 'B1');
  });

  it('null and assisted scores are not zeros and do not grant +', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 2, 2]);
    putScore(state, 'Q06', null, { eligible: false, status: 'needs_review' });
    assert.equal(entryGate(state), false);
    assert.equal(evaluateGates(state).a1Plus, false);

    const assisted = fill(ENTRY, [2, 2, 2, 2, 2, 2]);
    putScore(assisted, 'Q06', 2, { eligible: false, status: 'assisted' });
    assert.equal(entryGate(assisted), false);
    assert.equal(publicResultFor(assisted, 'insufficient_evidence'), null);
  });
});

function fillA1(state: PlacementRuntimeState, scores: PlacementScore[]) {
  A1.forEach((id, i) => putScore(state, id, scores[i]!));
}

function fillA2(state: PlacementRuntimeState, scores: PlacementScore[]) {
  A2.forEach((id, i) => putScore(state, id, scores[i]!));
}

describe('placement routing walk', () => {
  it('starts Q01 with onboarding opening and the learner name', () => {
    const { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    assert.equal(state.currentQuestionId, 'Q01');
    assert.match(reply.aiResponse, /Teacher Bee/);
    assert.match(reply.aiResponse, /Hi, Maya/);
    assert.match(reply.aiResponse, /where do you live/i);
    assert.match(reply.textTh, /ครูพี่บี/);
    assert.equal(reply.canSkip, true);
    assert.equal(reply.progressMax, 20);
    assert.equal(reply.progressTurn, 1);
    assert.equal(reply.progressScores.length, 20);
    assert.ok(reply.progressScores.every((score) => score === null));
  });

  it('colors scored items 0 gray / 1 yellow / 2 green over 20 slots', () => {
    let { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    ({ state, reply } = scoreWalk(state, 2));
    assert.equal(reply.progressMax, 20);
    assert.equal(reply.progressTurn, 2);
    assert.equal(reply.progressScores[0], 2);
    assert.equal(reply.lastDebug?.questionId, 'Q01');
    assert.equal(reply.lastDebug?.score, 2);
    assert.ok((reply.lastDebug?.reason ?? '').length > 0);
    ({ state, reply } = scoreWalk(state, 1));
    assert.equal(reply.progressScores[1], 1);
    ({ state, reply } = scoreWalk(state, 0));
    assert.equal(reply.progressScores[2], 0);
    assert.equal(reply.progressScores.filter((s) => s !== null).length, 3);
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

  it('passes entry then asks Q07, not A1 yet', () => {
    let { state } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    for (const s of [2, 2, 2, 2, 2, 1] as PlacementScore[]) {
      ({ state } = scoreWalk(state, s));
    }
    assert.equal(state.currentQuestionId, 'Q07');
    assert.equal(state.finished, false);
    assert.equal(entryGate(state), true);
    assert.equal(a1Gate(state), false);
  });

  it('stops as Seed when Q04 is only 1', () => {
    let { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    for (const s of [2, 2, 2, 1, 2, 2] as PlacementScore[]) {
      ({ state, reply } = scoreWalk(state, s));
    }
    assert.equal(state.finished, true);
    assert.equal(state.result?.publicResult, 'Seed');
    assert.equal(state.result?.recommendedNodeId, 'v7_u01n01');
    assert.equal(state.result?.recommendedPathId, 'foundation_v7');
    assert.equal(state.result?.recommendationType, 'course_start');
    assert.ok(state.result?.progressScores?.includes(1));
    assert.equal(state.result?.rubricVersion, PLACEMENT_RUBRIC_VERSION);
    assert.equal(state.result?.mappingVersion, PLACEMENT_MAPPING_VERSION);
    assert.doesNotMatch(reply?.textTh ?? '', /20 ข้อ/);
  });

  it('early-stops after two zeros plus a confirming zero', () => {
    let { state } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    ({ state } = scoreWalk(state, 0));
    ({ state } = scoreWalk(state, 0));
    assert.equal(state.finished, false);
    ({ state } = scoreWalk(state, 0));
    assert.equal(state.finished, true);
    assert.equal(state.result?.stopReason, 'early_zero_streak');
    assert.equal(state.result?.publicResult, 'Seed');
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

  it('hides NPC transcript from Q11 and announces once', () => {
    let { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    for (const s of [2, 2, 2, 2, 2, 2] as PlacementScore[]) {
      ({ state } = scoreWalk(state, s));
    }
    for (const s of [2, 2, 2, 2] as PlacementScore[]) {
      ({ state, reply } = scoreWalk(state, s));
    }
    assert.equal(state.currentQuestionId, 'Q11');
    assert.equal(reply.hideNpcTranscript, true);
    assert.match(reply.textTh, /ไม่มีข้อความ/);
    assert.equal(getPlacementQuestion('Q11')?.delivery, 'audio_only');
  });
});

describe('placement heuristics', () => {
  it('scores keys ownership, colour, and past+companion', () => {
    const q04 = getPlacementQuestion('Q04')!;
    const q06 = getPlacementQuestion('Q06')!;
    const q11 = getPlacementQuestion('Q11')!;
    assert.equal(heuristicPlacementEval(q04, 'They have keys.', false)?.score, 2);
    assert.equal(heuristicPlacementEval(q06, "No, it's blue.", false)?.score, 2);
    assert.equal(heuristicPlacementEval(q06, "Yes, it's red.", false)?.score, 0);
    assert.equal(heuristicPlacementEval(q11, 'I went shopping.', false), null);
    assert.equal(
      heuristicPlacementEval(q11, 'I went shopping with my friend.', false)?.score,
      2,
    );
  });

  it('gives 1 to Thai-only answers that still show intent', () => {
    const q01 = getPlacementQuestion('Q01')!;
    const judged = heuristicPlacementEval(q01, 'เหนื่อยครับ', false);
    assert.equal(judged?.score, 1);
    assert.match(judged?.reason ?? '', /ไทย/);
  });

  it('scores Q01 feeling plus home without calling the evaluator', () => {
    const q01 = getPlacementQuestion('Q01')!;
    assert.equal(
      heuristicPlacementEval(q01, "I'm good. I'm from Bangkok.", false)?.score,
      2,
    );
    assert.equal(heuristicPlacementEval(q01, "I'm good.", false), null);
  });

  it('scores Q02 locally only when relationship and trait are both obvious', () => {
    const q02 = getPlacementQuestion('Q02')!;
    assert.equal(
      heuristicPlacementEval(
        q02,
        'My father is a teacher. He is handsome.',
        false,
      )?.score,
      2,
    );
    assert.equal(
      heuristicPlacementEval(q02, 'My father is a teacher.', false),
      null,
    );
  });

  it('scores Q05 polite book requests locally', () => {
    const q05 = getPlacementQuestion('Q05')!;
    assert.equal(
      heuristicPlacementEval(q05, 'Can I borrow the book please?', false)?.score,
      2,
    );
    assert.equal(heuristicPlacementEval(q05, 'Book.', false), null);
  });

  it('keeps a debug reason on skipped and heuristic keys answers', () => {
    const q04 = getPlacementQuestion('Q04')!;
    assert.match(
      heuristicPlacementEval(q04, '', true)?.reason ?? '',
      /ข้าม/,
    );
    assert.match(
      heuristicPlacementEval(q04, 'They have keys.', false)?.reason ?? '',
      /keys/,
    );
  });
});

describe('placement live catalog mapping', () => {
  it('starts Seed+ at Foundation Ch8 without rewriting the badge', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 2, 1]);
    const result = buildSessionResult(state, 'band_not_confirmed');
    assert.equal(result.publicResult, 'Seed+');
    assert.equal(result.recommendedPathId, 'foundation_v7');
    assert.equal(result.recommendedChapterId, 'v7_u08');
    assert.equal(result.recommendedNodeId, 'v7_u08n01');
    assert.equal(result.recommendationType, 'chapter_start');
    assert.equal(result.usedFallback, false);
  });

  it('starts A1 at Adventure Ch1 and A1+ at Ch8 warm-up', () => {
    const a1 = fill(ENTRY, [2, 2, 2, 2, 2, 2]);
    fillA1(a1, [2, 2, 1, 2]);
    const a1Result = buildSessionResult(a1, 'band_not_confirmed');
    assert.equal(a1Result.publicResult, 'Seed+');

    const a1Pass = fill(ENTRY, [2, 2, 2, 2, 2, 2]);
    fillA1(a1Pass, [2, 2, 2, 2]);
    const a1Ok = buildSessionResult(a1Pass, 'band_not_confirmed');
    assert.equal(a1Ok.publicResult, 'A1');
    assert.equal(a1Ok.recommendedNodeId, 'a2_c01n01');

    fillA2(a1Pass, [1, 2, 2, 2, 1, 1]);
    const plus = buildSessionResult(a1Pass, 'band_not_confirmed');
    assert.equal(plus.publicResult, 'A1+');
    assert.equal(plus.recommendedNodeId, 'a2_c08n01');
    assert.equal(plus.recommendationType, 'review_checkpoint');
  });

  it('keeps A2/B1 as coming soon until a later catalog exists', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 2, 2]);
    fillA1(state, [2, 2, 2, 2]);
    fillA2(state, [2, 1, 2, 2, 2, 1]);
    const a2 = buildSessionResult(state, 'band_not_confirmed');
    assert.equal(a2.publicResult, 'A2');
    assert.equal(a2.recommendationType, 'coming_soon');
    assert.equal(a2.intendedNextLevel, 'B1');
    assert.equal(a2.recommendedNodeId, null);
  });
});

describe('placement result labels', () => {
  it('maps public badges without .5 or G-codes', () => {
    assert.equal(resultLabelFor('Seed'), 'Seed · พร้อมเติบโต');
    assert.equal(resultLabelFor('A1+'), 'A1+ · พร้อมต่อยอดสู่ A2');
    assert.equal(resultLabelFor('B1'), 'B1 · สนทนาและเล่าเรื่องได้');
    assert.equal(resultLabelFor(null), 'ยังประเมินไม่ได้');
  });

  it('keeps the Teacher Bee scenario id', () => {
    assert.equal(PLACEMENT_SCENARIO_ID, 'onboarding_placement_bee');
  });
});
