import { PLACEMENT_BAND_ORDER } from '../admin/admin-placement-summary';
import { placementBandFromResult } from '../placement/placement-band';

/** Below this many testers the percentile is too noisy to show. */
export const PLACEMENT_RANK_MIN_TESTERS = 10;

const BAND_WEIGHT = 1000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Band first, then summed 0/1/2 question scores. Inconclusive results rank lowest. */
export function placementRankScore(band: string | null, points: number): number {
  const index = band
    ? PLACEMENT_BAND_ORDER.indexOf(band.trim() as (typeof PLACEMENT_BAND_ORDER)[number])
    : -1;
  return (index + 1) * BAND_WEIGHT + Math.max(0, Math.round(points));
}

export function placementRankScoreFromResult(value: unknown): number | null {
  const result = asRecord(value);
  if (!result) return null;
  const band = placementBandFromResult(result);
  let points = 0;
  if (Array.isArray(result.questionResults)) {
    for (const item of result.questionResults) {
      const score = asRecord(item)?.score;
      if (score === 0 || score === 1 || score === 2) points += score;
    }
  }
  return placementRankScore(band, points);
}

export type PlacementRank = {
  /** Share of other testers with a lower score (ties count half), 0–99. */
  betterThanPercent: number;
  /** "Top X%" label value, 1–100. */
  topPercent: number;
  testers: number;
};

/**
 * `sortedScores` is ascending and includes the user's own score.
 * Returns null when there are too few testers to compare against.
 */
export function placementRankFor(
  sortedScores: readonly number[],
  myScore: number,
): PlacementRank | null {
  const testers = sortedScores.length;
  if (testers < PLACEMENT_RANK_MIN_TESTERS) return null;
  let lower = 0;
  let equal = 0;
  for (const score of sortedScores) {
    if (score < myScore) lower += 1;
    else if (score === myScore) equal += 1;
    else break;
  }
  const others = testers - 1;
  const tiedOthers = Math.max(0, equal - 1);
  const raw = ((lower + tiedOthers / 2) / others) * 100;
  const betterThanPercent = Math.min(99, Math.max(0, Math.floor(raw)));
  return {
    betterThanPercent,
    topPercent: Math.max(1, 100 - betterThanPercent),
    testers,
  };
}
