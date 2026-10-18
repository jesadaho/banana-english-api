import { PLACEMENT_BANDS, getPlacementQuestion } from './placement.bank';
import type {
  PlacementBandId,
  PlacementItemResult,
  PlacementRuntimeState,
  PlacementScore,
  PlacementSessionResult,
  PlacementStopReason,
} from './placement.types';
import { PLACEMENT_RUBRIC_VERSION } from './placement.types';

export function eligibleScore(
  row: PlacementItemResult | undefined,
): PlacementScore | null {
  if (!row || !row.eligibleForPlacement) return null;
  if (row.score === 0 || row.score === 1 || row.score === 2) return row.score;
  return null;
}

export function bandEligibleScores(
  state: PlacementRuntimeState,
  bandId: PlacementBandId,
): Array<PlacementScore | null> {
  const band = PLACEMENT_BANDS.find((b) => b.id === bandId)!;
  return band.questionIds.map((id) => eligibleScore(state.results[id]));
}

export function bandStatus(
  scores: Array<PlacementScore | null>,
): 'confirmed' | 'not_confirmed' | 'insufficient_evidence' {
  const eligible = scores.filter((s): s is PlacementScore => s !== null);
  if (eligible.length < 4) return 'insufficient_evidence';
  const twos = eligible.filter((s) => s === 2).length;
  const min = Math.min(...eligible);
  if (twos >= 3 && min >= 1) return 'confirmed';
  return 'not_confirmed';
}

export function highestConfirmedBand(
  state: PlacementRuntimeState,
): PlacementBandId | null {
  let found: PlacementBandId | null = null;
  for (const band of PLACEMENT_BANDS) {
    if (bandStatus(bandEligibleScores(state, band.id)) === 'confirmed') {
      found = band.id;
    }
  }
  return found;
}

export function resultLabelFor(band: PlacementBandId | null): string {
  switch (band) {
    case 'A1':
      return 'A1';
    case 'A1.5':
      return 'A1 · พื้นฐานคล่องขึ้น';
    case 'A2':
      return 'A2';
    case 'A2.5':
      return 'A2 · พร้อมต่อยอด';
    case 'B1':
      return 'B1 · สื่อสารในชีวิตประจำวัน';
    default:
      return 'ยังประเมินไม่ได้';
  }
}

export function recommendedStartKey(
  band: PlacementBandId | null,
  a1NotConfirmed: boolean,
): string {
  if (a1NotConfirmed && !band) return 'foundation_beginning';
  switch (band) {
    case 'A1':
      return 'foundation_a1';
    case 'A1.5':
      return 'foundation_a1_fluent';
    case 'A2':
      return 'adventure_a2';
    case 'A2.5':
      return 'adventure_a2_stretch';
    case 'B1':
      return 'adventure_a2';
    default:
      return 'retry_or_foundation';
  }
}

export function buildSessionResult(
  state: PlacementRuntimeState,
  stopReason: PlacementStopReason,
): PlacementSessionResult {
  const demonstrated = highestConfirmedBand(state);
  const a1Scores = bandEligibleScores(state, 'A1');
  const a1Status = bandStatus(a1Scores);
  const completedQuestionIds = state.askedQuestionIds.filter(
    (id) => state.results[id] && state.results[id]!.status !== 'not_administered',
  );

  if (stopReason === 'cancelled') {
    return {
      demonstratedBand: null,
      resultStatus: 'cancelled',
      resultLabel: 'ยังประเมินไม่ได้',
      recommendedStartKey: 'retry_or_foundation',
      stopReason,
      completedQuestionIds,
      rubricVersion: PLACEMENT_RUBRIC_VERSION,
    };
  }

  if (!demonstrated) {
    const a1HasEvidence = a1Scores.some((s) => s !== null);
    if (a1Status === 'not_confirmed' || a1HasEvidence) {
      return {
        demonstratedBand: null,
        resultStatus:
          stopReason === 'early_zero_streak' ? 'early_exit' : 'completed',
        resultLabel: 'เริ่มจากพื้นฐาน',
        recommendedStartKey: 'foundation_beginning',
        stopReason,
        completedQuestionIds,
        rubricVersion: PLACEMENT_RUBRIC_VERSION,
      };
    }
    return {
      demonstratedBand: null,
      resultStatus: 'insufficient_evidence',
      resultLabel: 'ยังประเมินไม่ได้',
      recommendedStartKey: 'retry_or_foundation',
      stopReason: 'insufficient_evidence',
      completedQuestionIds,
      rubricVersion: PLACEMENT_RUBRIC_VERSION,
    };
  }

  const lastBand = PLACEMENT_BANDS.find(
    (b) => b.id === demonstrated,
  )!;
  const lastStatus = bandStatus(bandEligibleScores(state, lastBand.id));
  const resultStatus =
    stopReason === 'early_zero_streak'
      ? 'early_exit'
      : lastStatus === 'confirmed' && demonstrated === 'B1'
        ? 'completed'
        : stopReason === 'band_not_confirmed'
          ? 'early_exit'
          : 'completed';

  return {
    demonstratedBand: demonstrated,
    resultStatus,
    resultLabel: resultLabelFor(demonstrated),
    recommendedStartKey: recommendedStartKey(demonstrated, false),
    stopReason,
    completedQuestionIds,
    rubricVersion: PLACEMENT_RUBRIC_VERSION,
  };
}

export function nextQuestionId(
  state: PlacementRuntimeState,
): string | null {
  if (state.finished) return null;
  const current = state.currentQuestionId;
  if (!current) return 'Q01';
  const q = getPlacementQuestion(current);
  if (!q) return null;
  const bandIdx = PLACEMENT_BANDS.findIndex((b) => b.id === q.band);
  const band = PLACEMENT_BANDS[bandIdx]!;
  const scores = bandEligibleScores(state, band.id);
  const status = bandStatus(scores);
  const askedInBand = band.questionIds.filter((id) =>
    state.askedQuestionIds.includes(id),
  );
  const nextInBand = band.questionIds.find(
    (id) => !state.askedQuestionIds.includes(id),
  );

  if (status === 'confirmed') {
    const nextBand = PLACEMENT_BANDS[bandIdx + 1];
    return nextBand?.questionIds[0] ?? null;
  }

  if (askedInBand.length >= 4 || !nextInBand) {
    return null;
  }

  const lastTwo = askedInBand
    .slice(-2)
    .map((id) => eligibleScore(state.results[id]));
  const twoZeros =
    lastTwo.length === 2 && lastTwo[0] === 0 && lastTwo[1] === 0;

  if (twoZeros) {
    // One confirmation slot, then stop if it is also 0 (handled by caller).
    return nextInBand;
  }

  return nextInBand;
}

export function shouldEarlyStopAfter(
  state: PlacementRuntimeState,
  justScoredId: string,
): boolean {
  const q = getPlacementQuestion(justScoredId);
  if (!q) return false;
  const band = PLACEMENT_BANDS.find((b) => b.id === q.band)!;
  const asked = band.questionIds.filter((id) =>
    state.askedQuestionIds.includes(id),
  );
  const scores = asked.map((id) => eligibleScore(state.results[id]));
  if (scores.length < 3) return false;
  const lastThree = scores.slice(-3);
  return lastThree.length === 3 && lastThree.every((s) => s === 0);
}
