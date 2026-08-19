import type { ChoiceStepTier } from '../../lessons/lessons.data';

/** v2 turn routing — maps scorer output + attempt to an engine lane. */
export type TurnLane =
  | 'scripted' /** exact / in pool → local reply, no LLM */
  | 'aiValidate' /** correct outside pool → short LLM validate + advance */
  | 'scriptedSoftTeach' /** incorrect attempt 1 → local explain + repeat */
  | 'scriptedAdvance'; /** incorrect attempt 2+ → local accept + next step */

export type LaneInput = {
  tier: ChoiceStepTier;
  attempt: number;
  /** When true, `near` means acceptable alternate phrasing (semantic pass). */
  nearMeansSemantic?: boolean;
};

/**
 * Resolve v2 lane from tier + attempt.
 *
 * - exact → scripted (fast)
 * - near + nearMeansSemantic → aiValidate (outside pool but OK)
 * - near (close miss) / wrong attempt 1 → scriptedSoftTeach
 * - wrong attempt 2+ → scriptedAdvance
 */
export function resolveTurnLane(input: LaneInput): TurnLane {
  const { tier, attempt, nearMeansSemantic = false } = input;

  if (tier === 'exact') return 'scripted';

  if (tier === 'near' && nearMeansSemantic) return 'aiValidate';

  if (attempt <= 1) return 'scriptedSoftTeach';

  return 'scriptedAdvance';
}
