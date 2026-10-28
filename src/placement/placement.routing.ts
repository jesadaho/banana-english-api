import {
  PLACEMENT_FIRST_QUESTION_ID,
  PLACEMENT_QUESTION_IDS,
  PLACEMENT_STAGES,
  getPlacementQuestion,
} from './placement.bank';
import { resolvePlacementStart } from './placement-catalog';
import type {
  PlacementGateResults,
  PlacementItemResult,
  PlacementItemStatus,
  PlacementPublicResult,
  PlacementQuestionResultRow,
  PlacementRuntimeState,
  PlacementScore,
  PlacementSessionResult,
  PlacementStageId,
  PlacementStopReason,
} from './placement.types';
import {
  PLACEMENT_MAPPING_VERSION,
  PLACEMENT_MODEL_VERSION,
  PLACEMENT_PROMPT_VERSION,
  PLACEMENT_QUESTION_VERSION,
  PLACEMENT_ROUTING_VERSION,
  PLACEMENT_RUBRIC_VERSION,
} from './placement.types';

export function eligibleScore(
  row: PlacementItemResult | undefined,
): PlacementScore | null {
  if (!row || !row.eligibleForPlacement) return null;
  if (row.score === 0 || row.score === 1 || row.score === 2) return row.score;
  return null;
}

/** Progress-bar mark: 0/1/2 scored, -1 unevaluable, null not asked. */
export function displayProgressScore(
  row: PlacementItemResult | undefined,
): PlacementScore | -1 | null {
  if (!row) return null;
  if (row.status === 'skipped') return 0;
  if (row.status === 'needs_review' || row.status === 'technical_retry') {
    return -1;
  }
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

function sumScores(scores: PlacementScore[]): number {
  return scores.reduce((total, score) => total + score, 0);
}

function scoreOf(
  state: PlacementRuntimeState,
  id: string,
): PlacementScore | null {
  return eligibleScore(state.results[id]);
}

function atLeast(state: PlacementRuntimeState, id: string, min: PlacementScore) {
  const score = scoreOf(state, id);
  return score !== null && score >= min;
}

/** Seed+: S01 (My name is …) and S03 (I'm + feeling) both full sentences. */
export function seedPlusGate(state: PlacementRuntimeState): boolean {
  return scoreOf(state, 'S01') === 2 && scoreOf(state, 'S03') === 2;
}

/**
 * Seed++ (start ch.8), same idea as the old Seed+ gate: all 7 entry items
 * sum ≥11/14 (75%, like ≥9/12) with Q05 or Q06 ≥1. Seed+ is not required, so
 * a one-word S03 ("Happy.") cannot sink an otherwise strong learner.
 */
export function entryGate(state: PlacementRuntimeState): boolean {
  const scores = eligibleList(stageEligibleScores(state, 'foundation_entry'));
  if (scores.length < stageQuestionCount('foundation_entry')) return false;
  return (
    sumScores(scores) >= 11 &&
    (atLeast(state, 'Q05', 1) || atLeast(state, 'Q06', 1))
  );
}

export type FoundationStartChapterId =
  | 'v7_u01'
  | 'v7_u02'
  | 'v7_u04'
  | 'v7_u05'
  | 'v7_u06'
  | 'v7_u07';

/**
 * Seed / Seed+ start: the first Foundation chapter whose skill the learner did
 * not show with a full (2) answer. Chapter 2 (please / thank you) is not
 * tested, so S01 without S03 starts there rather than skipping it.
 */
export function seedStartChapter(
  state: PlacementRuntimeState,
): FoundationStartChapterId {
  if (scoreOf(state, 'S01') !== 2) return 'v7_u01';
  if (scoreOf(state, 'S03') !== 2) return 'v7_u02';
  if (scoreOf(state, 'Q02') !== 2) return 'v7_u04';
  if (scoreOf(state, 'Q04') !== 2 || scoreOf(state, 'Q06') !== 2) return 'v7_u05';
  if (scoreOf(state, 'Q03') !== 2) return 'v7_u06';
  return 'v7_u07';
}

/** Q07–Q10: sum ≥6/8 and every item ≥1. */
export function a1Gate(state: PlacementRuntimeState): boolean {
  if (!entryGate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'a1'));
  if (scores.length < 4) return false;
  return sumScores(scores) >= 6 && allAtLeast(scores, 1);
}

/** Q11–Q20: sum ≥15/20, every item ≥1, and ≥2 of Q13/Q16/Q18 are 2. */
export function a2Gate(state: PlacementRuntimeState): boolean {
  if (!a1Gate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'a2'));
  if (scores.length < 10) return false;
  if (sumScores(scores) < 15 || !allAtLeast(scores, 1)) return false;
  const keyTwos = ['Q13', 'Q16', 'Q18'].filter(
    (id) => scoreOf(state, id) === 2,
  ).length;
  return keyTwos >= 2;
}

/** Fail A2, but Q14–Q17 all ≥1 and ≥2 of those four are 2. */
export function a1PlusGate(state: PlacementRuntimeState): boolean {
  if (!a1Gate(state) || a2Gate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'a2'));
  if (scores.length < 10) return false;
  const quartet = ['Q14', 'Q15', 'Q16', 'Q17'].map((id) => scoreOf(state, id));
  if (quartet.some((s) => s === null || s < 1)) return false;
  return quartet.filter((s) => s === 2).length >= 2;
}

/** Q21–Q25: ≥8/10, every item ≥1, and Q21 or Q22 is 2. */
export function b1Gate(state: PlacementRuntimeState): boolean {
  if (!a2Gate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'b1'));
  if (scores.length < 5) return false;
  if (sumScores(scores) < 8 || !allAtLeast(scores, 1)) return false;
  return scoreOf(state, 'Q21') === 2 || scoreOf(state, 'Q22') === 2;
}

/** Q21–Q25: ≥7/10 and every item ≥1. */
export function a2PlusGate(state: PlacementRuntimeState): boolean {
  if (!a2Gate(state) || b1Gate(state)) return false;
  const scores = eligibleList(stageEligibleScores(state, 'b1'));
  if (scores.length < 5) return false;
  return sumScores(scores) >= 7 && allAtLeast(scores, 1);
}

export function evaluateGates(state: PlacementRuntimeState): PlacementGateResults {
  return {
    seedPlus: seedPlusGate(state),
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
  if (stopReason === 'cancelled' && !gates.seedPlus) return null;
  if (stopReason === 'user_finished_after_a2' && gates.a2) return 'A2';
  if (gates.b1) return 'B1';
  // v3.0: no public A2+ band (gates.a2Plus is still recorded for audit).
  if (gates.a2) return 'A2';
  if (gates.a1Plus) return 'A1+';
  if (gates.a1) return 'A1';
  if (gates.entry) return 'Seed++';
  if (gates.seedPlus) return 'Seed+';
  const entryScores = eligibleList(
    stageEligibleScores(state, 'foundation_entry'),
  );
  if (entryScores.length >= stageQuestionCount('foundation_entry')) return 'Seed';
  if (stopReason === 'early_zero_streak' && entryScores.length > 0) return 'Seed';
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
      return 'Seed+ · มีพื้นฐานแล้ว';
    case 'Seed++':
      return opts?.incompleteNext
        ? 'Seed++ · พื้นฐานแน่น · ยังประเมินระดับถัดไปไม่ครบ'
        : 'Seed++ · พื้นฐานแน่น พร้อมต่อยอด';
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

function stageQuestionCount(stageId: PlacementStageId): number {
  return PLACEMENT_STAGES.find((s) => s.id === stageId)?.questionIds.length ?? 0;
}

function baseLevelFor(
  result: PlacementPublicResult | null,
): PlacementSessionResult['baseLevel'] {
  if (result === 'A1' || result === 'A1+') return 'A1';
  if (result === 'A2' || result === 'A2+') return 'A2';
  if (result === 'B1') return 'B1';
  return null;
}

export function debugReasonFor(params: {
  reasonCode: PlacementQuestionResultRow['reasonCode'];
  status?: PlacementQuestionResultRow['status'];
  reason?: string;
  evidence?: string[];
}): string {
  const written = params.reason?.trim();
  if (written) return written;
  if (params.status === 'not_administered') return 'ยังไม่ได้ถามข้อนี้';
  switch (params.reasonCode) {
    case 'target_met':
      return 'ครบหลักฐานที่ข้อนี้ขอ';
    case 'target_partially_demonstrated':
      return 'ตอบได้บางส่วน';
    case 'off_topic':
      return 'นอกเรื่อง หรือไม่ตรงโจทย์';
    case 'no_communicative_answer':
      return 'ยังไม่สื่อความหมาย';
    case 'user_skipped':
      return 'ข้ามข้อ จึงให้ 0';
    case 'capture_error':
      return 'จับเสียงไม่ชัด เลยยังไม่ให้คะแนน';
    case 'uncertain_transcription':
      return 'ถอดความไม่ชัวร์ เลยยังไม่ให้คะแนน';
    case 'assistance_used':
      return 'มีการช่วยตอบ จึงไม่นับเข้าเกต';
    default:
      return params.evidence?.[0]?.trim() || 'ไม่มีเหตุผลเพิ่ม';
  }
}

function questionRows(
  state: PlacementRuntimeState,
): PlacementQuestionResultRow[] {
  return PLACEMENT_QUESTION_IDS.map((id) => {
    const row = state.results[id];
    if (!row) {
      return {
        questionId: id,
        status: 'not_administered' as const,
        score: null,
        eligibleForPlacement: false,
        evidence: [],
        reasonCode: 'no_communicative_answer' as const,
        reason: 'ยังไม่ได้ถามข้อนี้',
      };
    }
    return {
      questionId: row.questionId,
      status: row.status,
      score: row.score,
      eligibleForPlacement: row.eligibleForPlacement,
      evidence: row.evidence,
      reasonCode: row.reasonCode,
      reason: debugReasonFor({
        reasonCode: row.reasonCode,
        status: row.status,
        reason: row.reason,
        evidence: row.evidence,
      }),
    };
  });
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
  const route = resolvePlacementStart(publicResult, {
    foundationChapterId:
      publicResult === 'Seed' || publicResult === 'Seed+'
        ? seedStartChapter(state)
        : undefined,
  });
  const incompleteNext =
    publicResult === 'Seed++' && !gates.a1 && stopReason !== 'cancelled';
  const insufficient =
    publicResult === null &&
    (stopReason === 'insufficient_evidence' ||
      stopReason === 'cancelled' ||
      eligibleList(stageEligibleScores(state, 'foundation_entry')).length === 0);

  let resultStatus: PlacementSessionResult['resultStatus'] = 'completed';
  if (stopReason === 'cancelled') {
    resultStatus = publicResult ? 'provisional' : 'cancelled';
  } else if (insufficient) resultStatus = 'insufficient_evidence';
  else if (stopReason === 'user_finished_after_a2' && gates.a2) {
    resultStatus = 'completed';
  } else if (stopReason === 'early_zero_streak') resultStatus = 'early_exit';
  else if (
    (gates.a1 || gates.a2) &&
    stopReason !== 'b1_confirmed' &&
    !gates.b1 &&
    incompleteNext
  ) {
    resultStatus = 'provisional';
  } else if (publicResult === 'Seed++' && !gates.a1) {
    resultStatus = 'provisional';
  } else if (stopReason === 'band_not_confirmed' && publicResult) {
    resultStatus = 'early_exit';
  }

  const rows = questionRows(state);
  const taskEvidence = [
    ...new Set(
      rows.flatMap((row) => (row.score === 2 ? row.evidence : [])),
    ),
  ];
  const taskGaps = PLACEMENT_QUESTION_IDS.filter((id) => {
    const score = eligibleScore(state.results[id]);
    return score === 0 || score === 1;
  }).map((id) => getPlacementQuestion(id)?.requiredEvidence ?? id);

  return {
    demonstratedBand: highestConfirmedStage(state),
    publicResult,
    baseLevel: baseLevelFor(publicResult),
    gateResults: gates,
    resultStatus,
    resultLabel: resultLabelFor(publicResult, { incompleteNext }),
    recommendedStartKey: route.recommendedStartKey,
    recommendationType: route.recommendationType,
    intendedNextLevel: route.intendedNextLevel,
    recommendedPathId: publicResult === null ? null : route.pathId,
    recommendedChapterId: publicResult === null ? null : route.chapterId,
    recommendedNodeId: publicResult === null ? null : route.nodeId,
    recommendedTitleEn: publicResult === null ? null : route.titleEn,
    recommendedTitleTh: publicResult === null ? null : route.titleTh,
    recommendedAppRoute: publicResult === null ? null : route.appRoute,
    recommendedContentRef:
      publicResult === null || !route.contentRef
        ? null
        : Object.fromEntries(
            Object.entries(route.contentRef).filter(
              (entry): entry is [string, string] => Boolean(entry[1]),
            ),
          ),
    usedFallback: route.usedFallback,
    fallbackPathId: route.fallbackPathId,
    fallbackChapterId: route.fallbackChapterId,
    fallbackNodeId: route.fallbackNodeId,
    fallbackNoticeTh: route.fallbackNoticeTh,
    stopReason: insufficient ? 'insufficient_evidence' : stopReason,
    entrySource: state.entrySource,
    completedQuestionIds,
    questionResults: rows,
    taskEvidence,
    taskGaps,
    progressScores: PLACEMENT_QUESTION_IDS.map((id) =>
      displayProgressScore(state.results[id]),
    ),
    questionVersion: PLACEMENT_QUESTION_VERSION,
    rubricVersion: PLACEMENT_RUBRIC_VERSION,
    routingVersion: PLACEMENT_ROUTING_VERSION,
    mappingVersion: PLACEMENT_MAPPING_VERSION,
    modelVersion: PLACEMENT_MODEL_VERSION,
    promptVersion: PLACEMENT_PROMPT_VERSION,
    resolvedCatalogVersion: route.resolvedCatalogVersion,
  };
}

export function nextQuestionId(state: PlacementRuntimeState): string | null {
  if (state.finished) return null;
  const current = state.currentQuestionId;
  if (!current) return PLACEMENT_FIRST_QUESTION_ID;
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
  // Capture failures are the mic's fault, not the learner's: they do not
  // count toward the three-zeros early stop.
  const scores = asked
    .filter((id) => state.results[id]?.reasonCode !== 'capture_error')
    .map((id) => eligibleScore(state.results[id]))
    .filter((s): s is PlacementScore => s !== null);
  if (scores.length < 3) return false;
  const lastThree = scores.slice(-3);
  return lastThree.length === 3 && lastThree.every((s) => s === 0);
}
