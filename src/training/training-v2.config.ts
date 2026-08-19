import { ABOUT_ME_CHOICE_LESSONS } from './scripts/about-me.registry';
import {
  FOUNDATION_LESSON_IDS,
  isFoundationChoiceLesson,
} from './scripts/foundation.registry';
import { isAboutMeChoiceLesson } from './scripts/about-me.registry';

/** Foundation + About Me lessons use the PoolGate / choice-lesson registry. */

function registryV2LessonIds(): string[] {
  return [
    ...FOUNDATION_LESSON_IDS,
    ...ABOUT_ME_CHOICE_LESSONS.map((d) => d.lessonId),
  ];
}

let cachedExtraAllowlist: Set<string> | null = null;

/** Optional env extras (e.g. staging a non-registry lesson). Registry lessons are always v2. */
function extraV2Allowlist(): Set<string> {
  if (!cachedExtraAllowlist) {
    const raw = process.env.TRAINING_V2_LESSONS;
    const extras =
      raw == null || raw.trim() === ''
        ? []
        : raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    cachedExtraAllowlist = new Set(extras);
  }
  return cachedExtraAllowlist;
}

/** All lesson IDs on engine v2 (registry + env extras). */
export function trainingV2Allowlist(): Set<string> {
  return new Set([...registryV2LessonIds(), ...extraV2Allowlist()]);
}

export function isTrainingV2Lesson(lessonId: string): boolean {
  if (isFoundationChoiceLesson(lessonId)) return true;
  if (isAboutMeChoiceLesson(lessonId)) return true;
  return extraV2Allowlist().has(lessonId);
}

/** Test helper — reset env cache between tests. */
export function resetTrainingV2ConfigCache(): void {
  cachedExtraAllowlist = null;
}
