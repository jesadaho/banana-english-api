import { flattenFoundationV2Nodes } from '../learn-path/foundation-v2-path.data';
import { getLesson } from '../lessons/lessons.data';

/** Original 16 Basics catalog lessons (BasicsLessons / BasicsCourse). */
export const BASIC_LESSON_IDS = [
  'greetings',
  'introductions',
  'yes_no_maybe',
  'polite_expressions',
  'meet_people',
  'talk_about_groups',
  'ee_about_me_family',
  'numbers',
  'telling_time',
  'everyday_numbers',
  'money_prices',
  'likes_dislikes',
  'wants_needs',
  'can_cant',
  'asking_for_help',
  'asking_questions',
] as const;

const BASIC_LESSON_ID_SET = new Set<string>(BASIC_LESSON_IDS);

export const CONTENT_COURSES = [
  'basic',
  'foundation',
  'everyday',
  'pronunciation',
  'other',
] as const;

export type ContentCourse = (typeof CONTENT_COURSES)[number];

export const EMPTY_COURSE_COUNTS: Record<ContentCourse, number> = {
  basic: 0,
  foundation: 0,
  everyday: 0,
  pronunciation: 0,
  other: 0,
};

let foundationTitleById: Map<string, string> | null = null;

function foundationTitles(): Map<string, string> {
  if (!foundationTitleById) {
    foundationTitleById = new Map();
    for (const node of flattenFoundationV2Nodes()) {
      foundationTitleById.set(node.id, node.titleEn);
      if (node.simulationId) {
        foundationTitleById.set(node.simulationId, node.titleEn);
      }
    }
  }
  return foundationTitleById;
}

/**
 * Mutually exclusive course bucket for admin Content.
 * Shared Foundation Path IDs that originated in Basics stay in Basic.
 */
export function classifyContentCourse(id: string): ContentCourse {
  const trimmed = id.trim();
  if (!trimmed) return 'other';
  if (trimmed.startsWith('fnd_v2_') || trimmed.startsWith('foundation_')) {
    return 'foundation';
  }
  if (BASIC_LESSON_ID_SET.has(trimmed)) return 'basic';
  if (trimmed.startsWith('pron_')) return 'pronunciation';
  if (trimmed.startsWith('ee_')) return 'everyday';
  return 'other';
}

export function contentItemTitle(id: string): string {
  const lesson = getLesson(id);
  if (lesson?.titleEn) return lesson.titleEn;
  return foundationTitles().get(id) ?? id;
}

export function roundStars(value: number): number {
  return Math.round(value * 100) / 100;
}
