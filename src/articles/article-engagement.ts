/** Medium-style clap cap per visitor per article. */
export const ARTICLE_MAX_CLAPS_PER_VISITOR = 50;

const VISITOR_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function normalizeVisitorId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!VISITOR_ID_RE.test(trimmed)) return null;
  return trimmed;
}

export function clampClapAmount(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  const n = Math.floor(raw);
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}
