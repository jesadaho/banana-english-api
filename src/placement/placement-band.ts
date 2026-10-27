import { resultLabelFor } from './placement.routing';

/**
 * Before v3.0 the band above Seed was called "Seed+" (passed the entry
 * gate, start ch.8). v3.0 renamed it "Seed++" and gave "Seed+" a new,
 * lower meaning (start ch.4–6). Read stored results through these helpers
 * so old rows keep their real level.
 */
function isLegacyVersion(questionVersion: unknown): boolean {
  if (typeof questionVersion !== 'string') return true;
  const m = /^placement-q-v(\d+)/.exec(questionVersion.trim());
  return !m || Number(m[1]) < 3;
}

export function normalizePlacementBand(
  band: string | null | undefined,
  questionVersion: unknown,
): string | null {
  const trimmed = typeof band === 'string' ? band.trim() : '';
  if (!trimmed) return null;
  if (trimmed === 'Seed+' && isLegacyVersion(questionVersion)) return 'Seed++';
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Public band of a stored placementResult JSON, legacy-aware. */
export function placementBandFromResult(value: unknown): string | null {
  const row = asRecord(value);
  if (!row) return null;
  return normalizePlacementBand(
    typeof row.publicResult === 'string' ? row.publicResult : null,
    row.questionVersion,
  );
}

/** Stored placementResult as the app should see it (legacy Seed+ → Seed++). */
export function normalizePlacementResultPayload(value: unknown): unknown {
  const row = asRecord(value);
  if (!row) return value;
  const band = placementBandFromResult(row);
  if (band === row.publicResult) return value;
  return {
    ...row,
    publicResult: band,
    resultLabel: resultLabelFor(band as Parameters<typeof resultLabelFor>[0]),
  };
}
