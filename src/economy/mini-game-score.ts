/**
 * Optional score body shared by mini-game / path complete routes.
 * Old clients may omit both fields — then no MiniGameScoreAttempt is written.
 */
export type MiniGameScoreBody = {
  correctCount?: number;
  totalCount?: number;
  passed?: boolean;
  /** Hint levels revealed during the run; hints never cost stars. */
  hintsUsed?: number;
  assisted?: boolean;
};

export function readMiniGameScoreBody(
  body: MiniGameScoreBody | undefined | null,
): {
  correctCount?: number;
  totalCount?: number;
  passed?: boolean;
  hintsUsed?: number;
  assisted?: boolean;
} {
  if (!body || typeof body !== 'object') return {};
  const hintsUsed =
    typeof body.hintsUsed === 'number' &&
    Number.isInteger(body.hintsUsed) &&
    body.hintsUsed >= 0
      ? body.hintsUsed
      : undefined;
  return {
    correctCount:
      typeof body.correctCount === 'number' ? body.correctCount : undefined,
    totalCount:
      typeof body.totalCount === 'number' ? body.totalCount : undefined,
    passed: typeof body.passed === 'boolean' ? body.passed : undefined,
    hintsUsed,
    assisted:
      typeof body.assisted === 'boolean'
        ? body.assisted
        : hintsUsed !== undefined
          ? hintsUsed > 0
          : undefined,
  };
}
