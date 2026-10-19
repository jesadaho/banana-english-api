import { PLACEMENT_STAGES, getPlacementQuestion } from './placement.bank';
import type {
  PlacementGateResults,
  PlacementItemResult,
  PlacementItemStatus,
  PlacementPublicResult,
  PlacementRecommendationType,
  PlacementRuntimeState,
  PlacementScore,
  PlacementSessionResult,
  PlacementStageId,
  PlacementStopReason,
} from './placement.types';
import {
  PLACEMENT_MAPPING_VERSION,
  PLACEMENT_RUBRIC_VERSION,
} from './placement.types';

export function eligibleScore(
  row: PlacementItemResult | undefined,
): PlacementScore | null {
  if (!row || !row.eligibleForPlacement) return null;
  if (row.score === 0 || row.score === 1 || row.score === 2) return row.score;
  return null;
}

export function deriveEligibility(params: {
  status: PlacementItemStatus;
  score: PlacementScore | null;
}): { eligibleForPlacement: boolean; score: PlacementScore | null } {
  if (params.status === 'technical_retry' || params.status === 'needs_review') {
    return { eligibleForPlacement: false, score: null };
  }
  if (params.status === 'assisted') {
    return { eligibleForPlacement: false, score: params.score };
  }
  if (params.status === 'skipped') {
    return { eligibleForPlacement: true, score: 0 };
  }
  if (
    params.status === 'scored' &&
    (params.score === 0 || params.score === 1 || params.score === 2)
  ) {
    return { eligibleForPlacement: true, score: params.score };
  }
  return { eligibleForPlacement: false, score: null };
}

export function stageEligibleScores(
  state: PlacementRuntimeState,
  stageId: PlacementStageId,
): Array<PlacementScore | null> {
  const stage = PLACEMENT_STAGES.find((s) => s.id === stageId)!;
  return stage.questionIds.map((id) => eligibleScore(state.results[id]));
}

function eligibleList(
  scores: Array<PlacementScore | null>,
): PlacementScore[] {
  return scores.filter((s): s is PlacementScore => s !== null);
}

function allAtLeast(
  scores: PlacementScore[],
  min: PlacementScore,
): boolean {
  return scores.length > 0 && scores.every((s) => s >= min);
}

function scoreOf(
  state: PlacementRuntimeState,
  id: string,
): PlacementScore | null {
  return eligibleScore(state.results[id]);
}

export function entryGate(state: PlacementRuntimeState): boolean {
  const scores = eligibleList(stageEligibleScores(state, 'foundation_entry'));
  if (scores.length < 6) return false;
  const twos = scores.filter((s) => s === 2).length;
  return (
    twos >= 5 &&
    allAtLeast(scores, 1) &&
    scoreOf(state, 'Q03') === 2 &&
    scoreOf(state, 'Q04') === 2
  );
}

export function a1Gate(state: PlacementRuntimeState): boolean {
  if (!entryGate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'a1'));
  if (scores.length < 4) return false;
  const twos = scores.filter((s) => s === 2).length;
  return twos >= 3 && allAtLeast(scores, 1) && scoreOf(state, 'Q09') === 2;
}

export function a2Gate(state: PlacementRuntimeState): boolean {
  if (!a1Gate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'a2'));
  if (scores.length < 6) return false;
  const twos = scores.filter((s) => s === 2).length;
  return (
    twos >= 4 &&
    allAtLeast(scores, 1) &&
    scoreOf(state, 'Q11') === 2 &&
    scoreOf(state, 'Q13') === 2 &&
    scoreOf(state, 'Q15') === 2
  );
}

export function a1PlusGate(state: PlacementRuntimeState): boolean {
  if (!a1Gate(state) || a2Gate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'a2'));
  if (scores.length < 6) return false;
  const trio = ['Q12', 'Q13', 'Q14'].map((id) => scoreOf(state, id));
  if (trio.some((s) => s === null || s < 1)) return false;
  return trio.filter((s) => s === 2).length >= 2;
}

export function b1Gate(state: PlacementRuntimeState): boolean {
  if (!a2Gate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'b1'));
  if (scores.length < 4) return false;
  const twos = scores.filter((s) => s === 2).length;
  if (twos < 3 || !allAtLeast(scores, 1)) return false;
  const narr =
    scoreOf(state, 'Q17') === 2 || scoreOf(state, 'Q18') === 2;
  const reason =
    scoreOf(state, 'Q19') === 2 || scoreOf(state, 'Q20') === 2;
  return narr && reason;
}

export function a2PlusGate(state: PlacementRuntimeState): boolean {
  if (!a2Gate(state) || b1Gate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'b1'));
  if (scores.length < 4) return false;
  const twos = scores.filter((s) => s === 2).length;
  return twos >= 2 && allAtLeast(scores, 1);
}

export function evaluateGates(state: PlacementRuntimeState): PlacementGateResults {
  return {
    entry: entryGate(state),
    a1: a1Gate(state),
    a2: a2Gate(state),
    b1: b1Gate(state),
    a1Plus: a1PlusGate(state),
    a2Plus: a2PlusGate(state),
  };
}

export function publicResultFor(
  state: PlacementRuntimeState,
  stopReason: PlacementStopReason,
): PlacementPublicResult | null {
  const gates = evaluateGates(state);
  if (stopReason === 'cancelled' && !gates.entry) return null;
  if (gates.b1) return 'B1';
  if (gates.a2Plus) return 'A2+';
  if (gates.a2) return 'A2';
  if (gates.a1Plus) return 'A1+';
  if (gates.a1) return 'A1';
  if (gates.entry) return 'Seed+';
  const entryScores = eligibleList(
    stageEligibleScores(state, 'foundation_entry'),
  );
  const entryFailed =
    entryScores.length >= 6 ||
    stopReason === 'early_zero_streak' ||
    stopReason === 'band_not_confirmed';
  if (entryFailed && entryScores.length > 0) return 'Seed';
  return null;
}

export function resultLabelFor(
  publicResult: PlacementPublicResult | null,
  opts?: { incompleteNext?: boolean },
): string {
  switch (publicResult) {
    case 'Seed':
      return 'Seed · พร้อมเติบโต';
    case 'Seed+':
      return opts?.incompleteNext
        ? 'Seed+ · มีพื้นฐานแล้ว · ยังประเมินระดับถัดไปไม่ครบ'
        : 'Seed+ · มีพื้นฐานแล้ว';
    case 'A1':
      return 'A1 · พื้นฐานพร้อมแล้ว';
    case 'A1+':
      return 'A1+ · พร้อมต่อยอดสู่ A2';
    case 'A2':
      return 'A2 · พร้อมต่อยอด';
    case 'A2+':
      return 'A2+ · เริ่มใช้ทักษะ B1 ได้แล้ว';
    case 'B1':
      return 'B1 · สนทนาและเล่าเรื่องได้';
    default:
      return 'ยังประเมินไม่ได้';
  }
}

type RouteMap = {
  startKey: string;
  recommendationType: PlacementRecommendationType;
  intendedNextLevel: 'B1' | 'B2' | null;
  pathId: string | null;
  chapterId: string | null;
  nodeId: string | null;
  baseLevel: 'A1' | 'A2' | 'B1' | null;
};

function routeFor(result: PlacementPublicResult | null): RouteMap {
  switch (result) {
    case 'Seed':
      return {
        startKey: 'foundation_beginning',
        recommendationType: 'course_start',
        intendedNextLevel: null,
        pathId: 'foundation_v7',
        chapterId: 'v7_u01',
        nodeId: 'v7_u01n01',
        baseLevel: null,
      };
    case 'Seed+':
      return {
        startKey: 'foundation_ch8',
        recommendationType: 'chapter_start',
        intendedNextLevel: null,
        pathId: 'foundation_v7',
        chapterId: 'v7_u08',
        nodeId: 'v7_u08n01',
        baseLevel: null,
      };
    case 'A1':
      return {
        startKey: 'adventure_a2',
        recommendationType: 'course_start',
        intendedNextLevel: null,
        pathId: 'adventure_a2',
        chapterId: 'a2_c01',
        nodeId: 'a2_c01n01',
        baseLevel: 'A1',
      };
    case 'A1+':
      return {
        startKey: 'adventure_a2_ch8',
        recommendationType: 'review_checkpoint',
        intendedNextLevel: null,
        pathId: 'adventure_a2',
        chapterId: 'a2_c08',
        nodeId: 'a2_c08n01',
        baseLevel: 'A1',
      };
    case 'A2':
      return {
        startKey: 'coming_soon_b1',
        recommendationType: 'coming_soon',
        intendedNextLevel: 'B1',
        pathId: null,
        chapterId: null,
        nodeId: null,
        baseLevel: 'A2',
      };
    case 'A2+':
      return {
        startKey: 'coming_soon_b1',
        recommendationType: 'coming_soon',
        intendedNextLevel: 'B1',
        pathId: null,
        chapterId: null,
        nodeId: null,
        baseLevel: 'A2',
      };
    case 'B1':
      return {
        startKey: 'coming_soon_b2',
        recommendationType: 'coming_soon',
        intendedNextLevel: 'B2',
        pathId: null,
        chapterId: null,
        nodeId: null,
        baseLevel: 'B1',
      };
    default:
      return {
        startKey: 'retry_or_foundation',
        recommendationType: 'course_start',
        intendedNextLevel: null,
        pathId: 'foundation_v7',
        chapterId: 'v7_u01',
        nodeId: 'v7_u01n01',
        baseLevel: null,
      };
  }
}

export function highestConfirmedStage(
  state: PlacementRuntimeState,
): PlacementStageId | null {
  const gates = evaluateGates(state);
  if (gates.b1 || gates.a2) return gates.b1 ? 'b1' : 'a2';
  if (gates.a1) return 'a1';
  if (gates.entry) return 'foundation_entry';
  return null;
}

function stagePassed(state: PlacementRuntimeState, stageId: PlacementStageId): boolean {
  if (stageId === 'foundation_entry') return entryGate(state);
  if (stageId === 'a1') return a1Gate(state);
  if (stageId === 'a2') return a2Gate(state);
  return b1Gate(state);
}

export function buildSessionResult(
  state: PlacementRuntimeState,
  stopReason: PlacementStopReason,
): PlacementSessionResult {
  const gates = evaluateGates(state);
  const completedQuestionIds = state.askedQuestionIds.filter(
    (id) => state.results[id] && state.results[id]!.status !== 'not_administered',
  );
  const publicResult =
    stopReason === 'cancelled' && !gates.entry
      ? null
      : publicResultFor(state, stopReason);
  const route = routeFor(publicResult);
  const incompleteNext =
    publicResult === 'Seed+' && !gates.a1 && stopReason !== 'cancelled';
  const insufficient =
    publicResult === null &&
    (stopReason === 'insufficient_evidence' ||
      stopReason === 'cancelled' ||
      eligibleList(stageEligibleScores(state, 'foundation_entry')).length === 0);

  let resultStatus: PlacementSessionResult['resultStatus'] = 'completed';
  if (stopReason === 'cancelled') {
    resultStatus = publicResult ? 'provisional' : 'cancelled';
  } else if (insufficient) resultStatus = 'insufficient_evidence';
  else if (stopReason === 'early_zero_streak') resultStatus = 'early_exit';
  else if (
    (gates.a1 || gates.a2) &&
    stopReason !== 'b1_confirmed' &&
    !gates.b1 &&
    incompleteNext
  ) {
    resultStatus = 'provisional';
  } else if (publicResult === 'Seed+' && !gates.a1) {
    resultStatus = 'provisional';
  } else if (stopReason === 'band_not_confirmed' && publicResult) {
    resultStatus = 'early_exit';
  }

  return {
    demonstratedBand: highestConfirmedStage(state),
    publicResult,
    baseLevel: route.baseLevel,
    gateResults: gates,
    resultStatus,
    resultLabel: resultLabelFor(publicResult, { incompleteNext }),
    recommendedStartKey:
      publicResult === null ? 'retry_or_foundation' : route.startKey,
    recommendationType: route.recommendationType,
    intendedNextLevel: route.intendedNextLevel,
    recommendedPathId: publicResult === null ? null : route.pathId,
    recommendedChapterId: publicResult === null ? null : route.chapterId,
    recommendedNodeId: publicResult === null ? null : route.nodeId,
    stopReason: insufficient ? 'insufficient_evidence' : stopReason,
    completedQuestionIds,
    rubricVersion: PLACEMENT_RUBRIC_VERSION,
    mappingVersion: PLACEMENT_MAPPING_VERSION,
  };
}

export function nextQuestionId(state: PlacementRuntimeState): string | null {
  if (state.finished) return null;
  const current = state.currentQuestionId;
  if (!current) return 'Q01';
  const q = getPlacementQuestion(current);
  if (!q) return null;
  const stageIdx = PLACEMENT_STAGES.findIndex((s) => s.id === q.stage);
  const stage = PLACEMENT_STAGES[stageIdx]!;
  const askedInStage = stage.questionIds.filter((id) =>
    state.askedQuestionIds.includes(id),
  );
  const nextInStage = stage.questionIds.find(
    (id) => !state.askedQuestionIds.includes(id),
  );

  if (stagePassed(state, stage.id)) {
    return PLACEMENT_STAGES[stageIdx + 1]?.questionIds[0] ?? null;
  }

  if (askedInStage.length >= stage.questionIds.length || !nextInStage) {
    return null;
  }

  return nextInStage;
}

export function shouldEarlyStopAfter(
  state: PlacementRuntimeState,
  justScoredId: string,
): boolean {
  const q = getPlacementQuestion(justScoredId);
  if (!q) return false;
  const stage = PLACEMENT_STAGES.find((s) => s.id === q.stage)!;
  const asked = stage.questionIds.filter((id) =>
    state.askedQuestionIds.includes(id),
  );
  const scores = asked
    .map((id) => eligibleScore(state.results[id]))
    .filter((s): s is PlacementScore => s !== null);
  if (scores.length < 3) return false;
  const lastThree = scores.slice(-3);
  return lastThree.length === 3 && lastThree.every((s) => s === 0);
}
