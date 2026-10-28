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
  seedPlusGate,
  seedStartChapter,
} from './placement.routing';
import {
  applyPlacementEvaluation,
  buildPlacementOpening,
  coercePlacementScore,
  collectPlacementBankLines,
  combineTwoPartScore,
  heuristicPlacementEval,
  initPlacementRuntime,
  makeItemResult,
  mentionedMeetingTime,
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
  ENTRY.forEach((id, i) => putScore(state, id, i === 6 ? 1 : 2));
}

function passA1(state: PlacementRuntimeState) {
  passEntry(state);
  A1.forEach((id, i) => putScore(state, id, i === 2 ? 2 : i === 1 ? 1 : 2));
}

function scoredItem(
  qId: string,
  state: PlacementRuntimeState,
  value: PlacementScore,
  transcript: string,
) {
  const q = getPlacementQuestion(qId)!;
  return makeItemResult(q, state, {
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
  });
}

function scoreWalk(
  state: PlacementRuntimeState,
  value: PlacementScore,
  transcript = 'ok',
) {
  const q = getPlacementQuestion(state.currentQuestionId!)!;
  let result = applyPlacementEvaluation(
    state,
    scoredItem(q.id, state, value, transcript),
  );
  if (
    result.state.pendingFollowUp?.questionId === q.id &&
    result.state.currentQuestionId === q.id
  ) {
    result = applyPlacementEvaluation(
      result.state,
      scoredItem(q.id, result.state, value, 'At ten.'),
    );
  }
  return result;
}

describe('placement bank v3.0', () => {
  it('has 26 staged question IDs in 7+4+10+5 stages (Q01 retired)', () => {
    const ids = PLACEMENT_QUESTIONS.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
    const staged = PLACEMENT_STAGES.flatMap((s) => s.questionIds);
    assert.equal(new Set(staged).size, 26);
    assert.deepEqual(
      PLACEMENT_STAGES.map((s) => s.questionIds.length),
      [7, 4, 10, 5],
    );
    assert.deepEqual(ENTRY, ['S01', 'S03', 'Q02', 'Q04', 'Q03', 'Q05', 'Q06']);
    assert.equal(staged.includes('Q01'), false);
    assert.ok(getPlacementQuestion('Q01'), 'kept for in-flight sessions');
  });

  it('hides NPC English from Q11 and keeps Q01–10 as text+audio', () => {
    for (const q of PLACEMENT_QUESTIONS) {
      const n = Number(q.id.slice(1));
      if (n <= 10) {
        assert.equal(q.delivery === 'audio_only' || q.delivery === 'picture_audio', false, q.id);
      } else {
        assert.ok(
          q.delivery === 'audio_only' || q.delivery === 'picture_audio',
          q.id,
        );
      }
    }
    assert.equal(getPlacementQuestion('Q11')?.transitionTh, undefined);
    assert.equal(getPlacementQuestion('S01')?.npcEn, "What's your name?");
    assert.equal(getPlacementQuestion('S03')?.npcEn, 'How do you feel today?');
  });

  it('banks scripted Teacher B lines as separate acks and questions', () => {
    const lines = collectPlacementBankLines();
    assert.ok(lines.includes("What's your name?"));
    assert.ok(lines.includes('How do you feel today?'));
    assert.ok(lines.includes('Nice to meet you!'));
    assert.equal(lines.includes('Where are you from?'), false);
    assert.ok(lines.includes('Look at the table. How many apples are there?'));
    assert.ok(lines.includes('Thanks!'));
    assert.equal(
      lines.includes('Thanks! Look at the table. How many apples are there?'),
      false,
    );
    assert.ok(lines.includes("What's inside the bag?"));
    assert.ok(lines.includes('Invite me to do something with you this weekend.'));
    assert.ok(lines.includes('What time shall we meet?'));
    assert.ok(lines.includes('Where shall we meet?'));
    assert.ok(
      lines.includes(
        "We don't have another room tonight. What would you like us to do?",
      ),
    );
    assert.equal(
      lines.some((line) => line.includes("We're both free this weekend")),
      false,
    );
    assert.ok(lines.some((line) => line.startsWith('Tell me')));
    assert.ok(
      lines.includes(
        'มาลองวัดระดับภาษาอังกฤษกันครับ ตอบเท่าที่ได้เลย',
      ),
    );
    assert.equal(
      lines.some(
        (line) => line.includes('มาลองวัดระดับ') && line.includes("What's your name"),
      ),
      false,
    );
    assert.ok(lines.some((line) => line.startsWith('Thank you for talking with Teacher Bee')));
    for (const line of lines) {
      assert.equal(line.includes('{name}'), false);
      assert.equal(line.includes('{problem}'), false);
    }
  });
});

describe('placement gates v3.0', () => {
  // Entry order: S01, S03, Q02, Q04, Q03, Q05, Q06.
  it('Seed++: entry items sum ≥11/14 with Q05 or Q06 ≥1', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 1, 1, 2]);
    assert.equal(seedPlusGate(state), true);
    assert.equal(entryGate(state), true);
    assert.equal(a1Gate(state), false);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed++');
  });

  it('Seed++ needs only one of Q05/Q06 (Q06=0 still passes)', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 2, 2, 0]);
    assert.equal(entryGate(state), true);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed++');
  });

  it('a one-word S03 does not block Seed++ when the total is 13/14', () => {
    const state = fill(ENTRY, [2, 1, 2, 2, 2, 2, 2]);
    assert.equal(seedPlusGate(state), false);
    assert.equal(entryGate(state), true);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed++');
  });

  it('10/14 is not Seed++; with Q05 and Q06 both 0 it is not either', () => {
    assert.equal(entryGate(fill(ENTRY, [2, 2, 2, 2, 2, 0, 0])), false);
    assert.equal(entryGate(fill(ENTRY, [2, 2, 2, 2, 0, 0, 2])), false);
  });

  it('a one-word S03 with a low total is Seed at chapter 2', () => {
    const state = fill(ENTRY, [2, 1, 2, 2, 0, 0, 2]);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed');
    assert.equal(seedStartChapter(state), 'v7_u02');
  });

  it('S01 below 2 starts at chapter 1', () => {
    const state = fill(ENTRY, [1, 2, 2, 0, 0, 2, 2]);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed');
    assert.equal(seedStartChapter(state), 'v7_u01');
  });

  it('Seed+ starts at the first chapter whose skill is not shown', () => {
    const ch4 = fill(ENTRY, [2, 2, 1, 2, 0, 0, 2]);
    assert.equal(publicResultFor(ch4, 'band_not_confirmed'), 'Seed+');
    assert.equal(seedStartChapter(ch4), 'v7_u04');

    const ch5 = fill(ENTRY, [2, 2, 2, 1, 0, 0, 2]);
    assert.equal(publicResultFor(ch5, 'band_not_confirmed'), 'Seed+');
    assert.equal(seedStartChapter(ch5), 'v7_u05');

    const ch5Apples = fill(ENTRY, [2, 2, 2, 2, 0, 1, 1]);
    assert.equal(seedStartChapter(ch5Apples), 'v7_u05');

    const ch6 = fill(ENTRY, [2, 2, 2, 2, 0, 0, 2]);
    assert.equal(publicResultFor(ch6, 'band_not_confirmed'), 'Seed+');
    assert.equal(seedStartChapter(ch6), 'v7_u06');
  });

  it('A1 [2,2,1,1] =6 with no zeros confirms A1', () => {
    const state = emptyState();
    passEntry(state);
    fillA1(state, [2, 2, 1, 1]);
    assert.equal(a1Gate(state), true);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'A1');
  });

  it('A1 fails when any item is 0 → Seed++', () => {
    const state = emptyState();
    passEntry(state);
    fillA1(state, [2, 2, 2, 0]);
    assert.equal(a1Gate(state), false);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed++');
  });

  it('A2 15/20 with only one of Q13/Q16/Q18=2 is A1+', () => {
    const state = emptyState();
    passA1(state);
    fillA2(state, [2, 2, 1, 2, 2, 2, 1, 1, 1, 1]);
    assert.equal(a2Gate(state), false);
    assert.equal(a1PlusGate(state), true);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'A1+');
  });

  it('A2 15/20 with two of Q13/Q16/Q18=2 confirms A2', () => {
    const state = emptyState();
    passA1(state);
    fillA2(state, [2, 1, 2, 1, 1, 2, 2, 2, 1, 1]);
    assert.equal(a2Gate(state), true);
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'A2');
  });

  it('B1 needs narration 2; 8/10 without it stays A2 (no public A2+)', () => {
    const near = emptyState();
    passA1(near);
    fillA2(near, [2, 1, 2, 1, 1, 2, 2, 2, 1, 1]);
    B1.forEach((id, i) => putScore(near, id, ([1, 1, 2, 2, 2] as PlacementScore[])[i]!));
    assert.equal(b1Gate(near), false);
    assert.equal(a2PlusGate(near), true);
    assert.equal(publicResultFor(near, 'band_not_confirmed'), 'A2');

    const full = emptyState();
    passA1(full);
    fillA2(full, [2, 1, 2, 1, 1, 2, 2, 2, 1, 1]);
    B1.forEach((id, i) => putScore(full, id, ([2, 1, 2, 2, 1] as PlacementScore[])[i]!));
    assert.equal(b1Gate(full), true);
    assert.equal(publicResultFor(full, 'b1_confirmed'), 'B1');
  });

  it('null and assisted scores are not zeros and do not grant Seed++', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 2, 2, 2]);
    putScore(state, 'Q06', null, { eligible: false, status: 'needs_review' });
    assert.equal(entryGate(state), false);
    // S01/S03 already show ch.1–3, so the safe answer is Seed+, not Seed++.
    assert.equal(publicResultFor(state, 'band_not_confirmed'), 'Seed+');
    assert.equal(evaluateGates(state).a1Plus, false);

    const assisted = fill(ENTRY, [2, 2, 2, 2, 2, 2, 2]);
    putScore(assisted, 'S03', 2, { eligible: false, status: 'assisted' });
    assert.equal(seedPlusGate(assisted), false);
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
  it('starts S01 with onboarding opening and the learner name', () => {
    const { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    assert.equal(state.currentQuestionId, 'S01');
    assert.match(reply.aiResponse, /ครูพี่บี/);
    assert.match(reply.aiResponse, /What's your name\?/);
    assert.match(reply.speechParts?.lead ?? '', /ครูพี่บี/);
    assert.equal(reply.speechParts?.body, "What's your name?");
    assert.doesNotMatch(reply.aiResponse, /Hello, I am Teacher Bee/);
    assert.doesNotMatch(reply.aiResponse, /Hi, Maya/);
    assert.match(reply.textTh, /ฟังไม่ทัน/);
    assert.equal(reply.canSkip, true);
    assert.equal(reply.progressMax, 26);
    assert.equal(reply.progressTurn, 1);
    assert.equal(reply.progressScores.length, 26);
    assert.ok(reply.progressScores.every((score) => score === null));
  });

  it('colors scored items 0 gray / 1 yellow / 2 green over 26 slots', () => {
    let { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    ({ state, reply } = scoreWalk(state, 2));
    assert.equal(reply.progressMax, 26);
    assert.equal(reply.progressTurn, 2);
    assert.equal(reply.progressScores[0], 2);
    assert.equal(reply.lastDebug?.questionId, 'S01');
    assert.match(reply.aiResponse, /^Nice to meet you! How do you feel today\?$/);
    assert.equal(reply.lastDebug?.score, 2);
    assert.equal(reply.assessmentTier, 'correct');
    assert.ok((reply.lastDebug?.reason ?? '').length > 0);
    ({ state, reply } = scoreWalk(state, 1));
    assert.equal(reply.progressScores[1], 1);
    ({ state, reply } = scoreWalk(state, 0));
    assert.equal(reply.progressScores[2], 0);
    assert.equal(reply.progressScores.filter((s) => s !== null).length, 3);
  });

  it('marks unevaluable answers purple as -1 without faking a 1', () => {
    let { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    const q = getPlacementQuestion('S01')!;
    ({ state, reply } = applyPlacementEvaluation(
      state,
      makeItemResult(q, state, {
        status: 'needs_review',
        score: null,
        eligibleForPlacement: false,
        evidence: ['ok'],
        reasonCode: 'uncertain_transcription',
        reason: 'ผู้ประเมินส่งคะแนนไม่เป็น JSON จึงยังไม่ให้คะแนน',
      }),
    ));
    assert.equal(reply.progressScores[0], -1);
    assert.equal(reply.lastDebug?.score, null);
    assert.match(reply.lastDebug?.reason ?? '', /JSON/);
    assert.equal(state.finished, false);
    assert.equal(state.currentQuestionId, 'S03');
  });

  it('uses the settings opening when entrySource is profile_settings', () => {
    const { reply } = buildPlacementOpening(
      initPlacementRuntime({
        entrySource: 'profile_settings',
        learnerName: 'Maya',
      }),
    );
    assert.match(reply.aiResponse, /มาลองวัดระดับ/);
    assert.match(reply.aiResponse, /What's your name/);
    assert.doesNotMatch(reply.aiResponse, /Let’s try an English level check/);
  });

  it('passes entry then asks Q07, not A1 yet', () => {
    let { state } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    for (const s of [2, 2, 2, 2, 2, 2, 1] as PlacementScore[]) {
      ({ state } = scoreWalk(state, s));
    }
    assert.equal(state.currentQuestionId, 'Q07');
    assert.equal(state.finished, false);
    assert.equal(entryGate(state), true);
    assert.equal(a1Gate(state), false);
  });

  it('stops as Seed at chapter 1 when S01 is only a name', () => {
    let { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    for (const s of [1, 2, 2, 2, 0, 0, 2] as PlacementScore[]) {
      ({ state, reply } = scoreWalk(state, s));
    }
    assert.equal(state.finished, true);
    assert.equal(state.result?.publicResult, 'Seed');
    assert.equal(state.result?.recommendedNodeId, 'v7_u01n01');
    assert.equal(state.result?.recommendedPathId, 'foundation_v7');
    assert.equal(state.result?.recommendationType, 'course_start');
    assert.ok(state.result?.progressScores?.includes(0));
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
    const q = getPlacementQuestion('S01')!;
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
    assert.equal(state.results.S01?.eligibleForPlacement, true);
    assert.equal(state.results.S01?.score, 0);
    assert.equal(state.currentQuestionId, 'S03');
  });

  it('hides NPC transcript from Q11 without a listen-along caption', () => {
    let { state, reply } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    for (const s of [2, 2, 2, 2, 2, 2, 2] as PlacementScore[]) {
      ({ state } = scoreWalk(state, s));
    }
    for (const s of [2, 2, 2, 2] as PlacementScore[]) {
      ({ state, reply } = scoreWalk(state, s));
    }
    assert.equal(state.currentQuestionId, 'Q11');
    assert.equal(reply.hideNpcTranscript, true);
    assert.equal(reply.textTh, '');
    assert.doesNotMatch(reply.aiResponse, /ฟังครูบี|ปิดไว้/);
    assert.equal(getPlacementQuestion('Q11')?.delivery, 'picture_audio');
  });
});

describe('placement two-turn items', () => {
  function walkTo(id: string) {
    let { state } = buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: 'Maya' }),
    );
    while (state.currentQuestionId !== id && !state.finished) {
      ({ state } = scoreWalk(state, 2, "Let's go swimming"));
    }
    return state;
  }

  it('asks Q15 for a time if the invite has no time, else a place', () => {
    let state = walkTo('Q15');
    let reply;
    ({ state, reply } = applyPlacementEvaluation(
      state,
      scoredItem('Q15', state, 2, "Let's go swimming"),
    ));
    assert.equal(state.currentQuestionId, 'Q15');
    assert.equal(state.pendingFollowUp?.prompt, 'What time shall we meet?');
    assert.match(reply.aiResponse, /What time shall we meet/);
    assert.equal(state.results.Q15, undefined);

    state = walkTo('Q15');
    ({ state, reply } = applyPlacementEvaluation(
      state,
      scoredItem('Q15', state, 2, "Let's go swimming at ten"),
    ));
    assert.equal(state.pendingFollowUp?.prompt, 'Where shall we meet?');
    assert.match(reply.aiResponse, /Where shall we meet/);
  });

  it('scores Q15 as 2 only when invite and arranging both land', () => {
    let state = walkTo('Q15');
    ({ state } = applyPlacementEvaluation(
      state,
      scoredItem('Q15', state, 2, "Let's go swimming"),
    ));
    const { state: done, reply } = applyPlacementEvaluation(
      state,
      scoredItem('Q15', state, 2, 'At ten.'),
    );
    assert.equal(done.results.Q15?.score, 2);
    assert.equal(done.pendingFollowUp, null);
    assert.equal(done.currentQuestionId, 'Q16');
    assert.match(reply.aiResponse, /That sounds nice|what's happening/i);
  });

  it('scores Q15 as 1 when the learner skips the arranging turn', () => {
    let state = walkTo('Q15');
    ({ state } = applyPlacementEvaluation(
      state,
      scoredItem('Q15', state, 2, "Let's go swimming"),
    ));
    const q = getPlacementQuestion('Q15')!;
    const { state: done } = applyPlacementEvaluation(
      state,
      makeItemResult(q, state, {
        status: 'skipped',
        score: 0,
        eligibleForPlacement: true,
        evidence: [],
        reasonCode: 'user_skipped',
      }),
    );
    assert.equal(done.results.Q15?.score, 1);
    assert.equal(done.currentQuestionId, 'Q16');
  });

  it('does not follow up when the Q15 invite is 0 or 1', () => {
    for (const score of [0, 1] as const) {
      const state = walkTo('Q15');
      const { state: next, reply } = applyPlacementEvaluation(
        state,
        scoredItem('Q15', state, score, score === 0 ? 'banana' : 'Park?'),
      );
      assert.equal(next.pendingFollowUp, null);
      assert.equal(next.results.Q15?.score, score);
      assert.equal(next.currentQuestionId, 'Q16');
      assert.doesNotMatch(reply.aiResponse, /shall we meet/);
    }
  });

  it('asks Q24 a constraint follow-up after a usable complaint', () => {
    const state = walkTo('Q24');
    const { state: next, reply } = applyPlacementEvaluation(
      state,
      scoredItem('Q24', state, 2, 'My room is noisy. Could I change rooms?'),
    );
    assert.equal(next.currentQuestionId, 'Q24');
    assert.match(reply.aiResponse, /don't have another room/i);
  });

  it('combines part scores as 2 / 1 / 0', () => {
    assert.equal(combineTwoPartScore(2, 2), 2);
    assert.equal(combineTwoPartScore(2, 1), 1);
    assert.equal(combineTwoPartScore(2, 0), 1);
    assert.equal(combineTwoPartScore(0, 0), 0);
    assert.equal(mentionedMeetingTime("Let's go swimming at 10"), true);
    assert.equal(mentionedMeetingTime("Let's go swimming"), false);
  });
});

describe('placement heuristics', () => {
  it('does not regex-award 2; English answers go to the evaluator', () => {
    const q01 = getPlacementQuestion('Q01')!;
    const q04 = getPlacementQuestion('Q04')!;
    assert.equal(heuristicPlacementEval(q01, "I'm from Thailand.", false), null);
    assert.equal(heuristicPlacementEval(q04, 'They have keys.', false), null);
  });

  it('accepts Gemini scores sent as strings', () => {
    assert.equal(coercePlacementScore('2'), 2);
    assert.equal(coercePlacementScore('1'), 1);
    assert.equal(coercePlacementScore(0), 0);
    assert.equal(coercePlacementScore('null'), null);
  });

  it('gives 1 to Thai-only answers that still show intent', () => {
    const q01 = getPlacementQuestion('Q01')!;
    const judged = heuristicPlacementEval(q01, 'มาจากกรุงเทพครับ', false);
    assert.equal(judged?.score, 1);
    assert.match(judged?.reason ?? '', /ไทย/);
  });

  it('keeps a debug reason on skipped answers', () => {
    const q04 = getPlacementQuestion('Q04')!;
    assert.match(
      heuristicPlacementEval(q04, '', true)?.reason ?? '',
      /ข้าม/,
    );
  });
});

describe('placement live catalog mapping', () => {
  it('starts Seed++ at Foundation Ch8 without rewriting the badge', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 2, 2, 1]);
    const result = buildSessionResult(state, 'band_not_confirmed');
    assert.equal(result.publicResult, 'Seed++');
    assert.equal(result.recommendedStartKey, 'foundation_ch8');
    assert.equal(result.recommendedPathId, 'foundation_v7');
    assert.equal(result.recommendedChapterId, 'v7_u08');
    assert.equal(result.recommendedNodeId, 'v7_u08n11');
    assert.equal(result.recommendationType, 'chapter_start');
    assert.equal(result.usedFallback, false);
  });

  it('starts A1 at Adventure Ch1 and A1+ at Ch8 New Words', () => {
    const a1Fail = fill(ENTRY, [2, 2, 2, 2, 2, 2, 2]);
    fillA1(a1Fail, [2, 2, 2, 0]);
    const a1Result = buildSessionResult(a1Fail, 'band_not_confirmed');
    assert.equal(a1Result.publicResult, 'Seed++');
    assert.equal(a1Result.recommendedNodeId, 'v7_u08n11');

    const a1Pass = fill(ENTRY, [2, 2, 2, 2, 2, 2, 2]);
    fillA1(a1Pass, [2, 2, 1, 2]);
    const a1Ok = buildSessionResult(a1Pass, 'band_not_confirmed');
    assert.equal(a1Ok.publicResult, 'A1');
    assert.equal(a1Ok.recommendedNodeId, 'a2_c01n01');

    fillA2(a1Pass, [2, 2, 1, 2, 2, 2, 1, 1, 1, 1]);
    const plus = buildSessionResult(a1Pass, 'band_not_confirmed');
    assert.equal(plus.publicResult, 'A1+');
    assert.equal(plus.recommendedNodeId, 'a2_c08n02');
    assert.equal(plus.recommendationType, 'chapter_start');
  });

  it('starts Seed / Seed+ at the first chapter node of their start chapter', () => {
    const seed2 = buildSessionResult(
      fill(ENTRY, [2, 1, 2, 2, 0, 0, 2]),
      'band_not_confirmed',
    );
    assert.equal(seed2.publicResult, 'Seed');
    assert.equal(seed2.recommendedChapterId, 'v7_u02');
    assert.equal(seed2.recommendedNodeId, 'v7_u02n06');
    assert.equal(seed2.recommendationType, 'chapter_start');
    assert.equal(seed2.recommendedStartKey, 'foundation_ch2');

    const plus = buildSessionResult(
      fill(ENTRY, [2, 2, 1, 2, 0, 0, 2]),
      'band_not_confirmed',
    );
    assert.equal(plus.publicResult, 'Seed+');
    assert.equal(plus.resultLabel, 'Seed+ · มีพื้นฐานแล้ว');
    assert.equal(plus.recommendedChapterId, 'v7_u04');
    assert.equal(plus.recommendedNodeId, 'v7_u04n08');
    assert.equal(plus.recommendedStartKey, 'foundation_ch4');
    assert.equal(plus.usedFallback, false);

    const ch6 = buildSessionResult(
      fill(ENTRY, [2, 2, 2, 2, 0, 0, 2]),
      'band_not_confirmed',
    );
    assert.equal(ch6.recommendedNodeId, 'v7_u06n01');

    const seed1 = buildSessionResult(
      fill(ENTRY, [0, 0, 0, 1, 0, 0, 0]),
      'band_not_confirmed',
    );
    assert.equal(seed1.publicResult, 'Seed');
    assert.equal(seed1.recommendedNodeId, 'v7_u01n01');
    assert.equal(seed1.recommendationType, 'course_start');
    assert.equal(seed1.recommendedStartKey, 'foundation_beginning');
  });

  it('keeps A2/B1 as coming soon until a later catalog exists', () => {
    const state = fill(ENTRY, [2, 2, 2, 2, 2, 2, 2]);
    fillA1(state, [2, 2, 2, 2]);
    fillA2(state, [2, 1, 2, 1, 1, 2, 2, 2, 1, 1]);
    const a2 = buildSessionResult(state, 'band_not_confirmed');
    assert.equal(a2.publicResult, 'A2');
    assert.equal(a2.recommendationType, 'coming_soon');
    assert.equal(a2.intendedNextLevel, 'B1');
    assert.equal(a2.recommendedNodeId, null);
    assert.equal(a2.recommendedPathId, null);
    // A2 / B1 land on the Games tab until their course ships.
    assert.equal(a2.recommendedAppRoute, '/games');
  });
});

describe('placement result labels', () => {
  it('maps public badges without .5 or G-codes', () => {
    assert.equal(resultLabelFor('Seed'), 'Seed · พร้อมเติบโต');
    assert.equal(resultLabelFor('Seed+'), 'Seed+ · มีพื้นฐานแล้ว');
    assert.equal(resultLabelFor('Seed++'), 'Seed++ · พื้นฐานแน่น พร้อมต่อยอด');
    assert.equal(resultLabelFor('A1+'), 'A1+ · พร้อมต่อยอดสู่ A2');
    assert.equal(resultLabelFor('B1'), 'B1 · สนทนาและเล่าเรื่องได้');
    assert.equal(resultLabelFor(null), 'ยังประเมินไม่ได้');
  });

  it('keeps the Teacher Bee scenario id', () => {
    assert.equal(PLACEMENT_SCENARIO_ID, 'onboarding_placement_bee');
  });
});
