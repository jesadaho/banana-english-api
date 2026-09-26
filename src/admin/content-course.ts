import { flattenFoundationV2Nodes } from '../learn-path/foundation-v2-path.data';
import { FOUNDATION_V7_CATALOG, FOUNDATION_V7_NODES } from '../learn-path/foundation-v7-path.data';
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
  'foundation',
  'everyday',
  'pronunciation',
  'minigame',
  'other',
] as const;

export type ContentCourse = (typeof CONTENT_COURSES)[number];

export const EMPTY_COURSE_COUNTS: Record<ContentCourse, number> = {
  foundation: 0,
  everyday: 0,
  pronunciation: 0,
  minigame: 0,
  other: 0,
};

const MINIGAME_TITLES: Record<string, string> = {
  game_say_it: 'Say It',
  game_describe_it: 'See & Say',
  game_explain_it: 'Explain It',
  game_emoji_speak: 'Emoji Speak',
  game_emoji_speak_endless: 'Emoji Speak Endless',
  game_speak_challenge: 'Speak Challenge',
  game_word_choice: 'Word Choice',
  game_story_builder: 'Story Builder',
  game_whats_happen: "What's Happen",
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
    for (const node of FOUNDATION_V7_NODES) {
      foundationTitleById.set(node.id, node.titleEn);
      const ref = node.contentRef;
      if (ref.topicId) foundationTitleById.set(ref.topicId, node.titleEn);
      if (ref.poolId) foundationTitleById.set(ref.poolId, node.titleEn);
      if (ref.lessonId) foundationTitleById.set(ref.lessonId, node.titleEn);
      if (ref.simulationId) {
        foundationTitleById.set(ref.simulationId, node.titleEn);
      }
      if (node.type === 'say_it' && ref.topicId) {
        foundationTitleById.set(`say_it:${ref.topicId}`, node.titleEn);
      }
      if (node.type === 'describe_it' && ref.poolId) {
        foundationTitleById.set(`describe_it:${ref.poolId}`, node.titleEn);
      }
      if (node.type === 'emoji_speak' && ref.poolId) {
        foundationTitleById.set(`emoji_speak:${ref.poolId}`, node.titleEn);
      }
      if (node.type === 'new_words' && ref.poolId) {
        foundationTitleById.set(`new_words:${ref.poolId}`, node.titleEn);
      }
    }
    for (const chapter of FOUNDATION_V7_CATALOG.chapters) {
      foundationTitleById.set(
        `skip_quiz:${chapter.id}`,
        `Skip Quiz · ${chapter.titleEn}`,
      );
    }
  }
  return foundationTitleById;
}

/**
 * Mutually exclusive course bucket for admin Content.
 * Foundation = the live Foundations path (original Basics + fnd_v2_*).
 * Everyday = English Adventure. Minigame = hub games rated as game_*.
 */
export function classifyContentCourse(id: string): ContentCourse {
  const trimmed = id.trim();
  if (!trimmed) return 'other';
  if (trimmed.startsWith('game_')) return 'minigame';
  if (
    trimmed.startsWith('say_it:') ||
    trimmed.startsWith('describe_it:') ||
    trimmed.startsWith('emoji_speak:') ||
    trimmed.startsWith('new_words:') ||
    trimmed.startsWith('skip_quiz:') ||
    trimmed.startsWith('fnd_v2_') ||
    trimmed.startsWith('fnd_v7_') ||
    trimmed.startsWith('v7_') ||
    trimmed.startsWith('foundation_') ||
    BASIC_LESSON_ID_SET.has(trimmed)
  ) {
    return 'foundation';
  }
  if (trimmed.startsWith('pron_') || trimmed.startsWith('fnd_v6_pron_')) {
    return 'pronunciation';
  }
  if (trimmed.startsWith('ee_') || trimmed.startsWith('speak_challenge_ee_')) {
    return 'everyday';
  }
  if (
    trimmed.startsWith('word_choice_ee_') ||
    trimmed.startsWith('story_builder_ee_') ||
    trimmed.startsWith('whats_happen_ee_')
  ) {
    return 'everyday';
  }
  return 'other';
}

export function contentItemTitle(id: string): string {
  if (MINIGAME_TITLES[id]) return MINIGAME_TITLES[id];
  const lesson = getLesson(id);
  if (lesson?.titleEn) return lesson.titleEn;
  const titles = foundationTitles();
  if (titles.has(id)) return titles.get(id)!;
  const colon = id.indexOf(':');
  if (colon > 0) {
    const bare = id.slice(colon + 1);
    if (titles.has(bare)) return titles.get(bare)!;
  }
  return id;
}

export function roundStars(value: number): number {
  return Math.round(value * 100) / 100;
}
