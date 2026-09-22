/**
 * Optional score body shared by mini-game / path complete routes.
 * Old clients may omit both fields — then no MiniGameScoreAttempt is written.
 */
export type MiniGameScoreBody = {
  correctCount?: number;
  totalCount?: number;
  passed?: boolean;
};

export function readMiniGameScoreBody(
  body: MiniGameScoreBody | undefined | null,
): {
  correctCount?: number;
  totalCount?: number;
  passed?: boolean;
} {
  if (!body || typeof body !== 'object') return {};
  return {
    correctCount:
      typeof body.correctCount === 'number' ? body.correctCount : undefined,
    totalCount:
      typeof body.totalCount === 'number' ? body.totalCount : undefined,
    passed: typeof body.passed === 'boolean' ? body.passed : undefined,
  };
}
