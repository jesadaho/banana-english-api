/** Lessons routed through Training Engine v2 (PoolGate: exact pool → scripted, miss → Gemini assess). */
const DEFAULT_V2_LESSONS = [
  'greetings',
  'ee_about_me_daily_routine',
  'ee_about_me_food',
  'ee_about_me_home',
  'ee_about_me_work_school',
  'ee_about_me_hobbies',
  'ee_about_me_pets',
  'ee_about_me_people',
  'ee_about_me_weather',
  'ee_about_me_friends',
  'ee_about_me_favorites',
];

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
