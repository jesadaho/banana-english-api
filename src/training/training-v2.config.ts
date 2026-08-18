/** Lessons routed through Training Engine v2 (hybrid scripted + AI on miss). */
const DEFAULT_V2_LESSONS = ['greetings'];

let cachedAllowlist: Set<string> | null = null;

function parseAllowlist(raw: string | undefined): Set<string> {
  if (raw == null || raw.trim() === '') {
    return new Set(DEFAULT_V2_LESSONS);
  }
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(ids.length > 0 ? ids : DEFAULT_V2_LESSONS);
}

export function trainingV2Allowlist(): Set<string> {
  if (!cachedAllowlist) {
    cachedAllowlist = parseAllowlist(process.env.TRAINING_V2_LESSONS);
  }
  return cachedAllowlist;
}

export function isTrainingV2Lesson(lessonId: string): boolean {
  return trainingV2Allowlist().has(lessonId);
}

/** Test helper — reset env cache between tests. */
export function resetTrainingV2ConfigCache(): void {
  cachedAllowlist = null;
}
