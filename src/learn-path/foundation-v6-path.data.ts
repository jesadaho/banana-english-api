import catalogJson from './foundation-v6-path.catalog.json';

export const FOUNDATION_V6_PATH_ID = 'foundation_v6';
export const FOUNDATION_V6_VERSION = 1;

export type FoundationV6NodeType =
  | 'lesson'
  | 'say_it'
  | 'emoji_speak'
  | 'pronunciation'
  | 'story_bites'
  | 'sentence_builder'
  | 'describe_it'
  | 'conversation';

export type FoundationV6PronunciationSource = {
  sourceCourse: 'pronunciation';
  sourceSkillIds: string[];
  mode: 'contextual_reuse';
};

export type FoundationV6NodeDef = {
  id: string;
  code: string;
  order: number;
  globalOrder: number;
  titleEn: string;
  type: FoundationV6NodeType;
  learningTarget: string;
  activity: string;
  estimatedMinutes: number;
  newSkillIds: string[];
  reviewedSkillIds: string[];
  prerequisiteNodeIds: string[];
  comingSoon: boolean;
  availability: 'catalog_ready' | 'coming_soon';
  pronunciation?: FoundationV6PronunciationSource;
  sayItMode?: 'guided';
};

export type FoundationV6ChapterDef = {
  id: string;
  number: number;
  titleEn: string;
  phase: 'Ki' | 'Sho' | 'Ten' | 'Ketsu';
  items: FoundationV6NodeDef[];
};

export type FoundationV6Catalog = {
  metadata: {
    sourceVersion: string;
    totalNodeCount: number;
    releaseStatus: 'playtest';
    cadence: string;
    storyBitesAvailability: 'coming_soon';
  };
  chapters: FoundationV6ChapterDef[];
};

export const FOUNDATION_V6_CATALOG = catalogJson as FoundationV6Catalog;

export type FoundationV6ContentRef = { lessonId?: string; topicId?: string; poolId?: string };

/** Existing game engines with V6-specific question pools where needed. */
export const FOUNDATION_V6_CONTENT_REFS: Record<string, FoundationV6ContentRef> = {
  u02n04: { lessonId: 'fnd_v6_pron_catch_slowly' },
  u03n02: { lessonId: 'fnd_v6_pron_be_contractions' },
  u05n02: { lessonId: 'fnd_v6_pron_plural_s' },
  u06n02: { lessonId: 'fnd_v6_pron_this_that' },
  u08n02: { lessonId: 'fnd_v6_pron_five' },
  u09n02: { lessonId: 'fnd_v6_pron_teens_tens' },
  u11n04: { lessonId: 'fnd_v6_pron_can_cant' },
  u12n04: { lessonId: 'fnd_v6_pron_third_person_s' },
  u14n04: { lessonId: 'fnd_v6_pron_question_melody' },
  u03n03: { lessonId: 'fnd_v6_be_not_questions' },
  u01n03: { topicId: 'fnd_v2_first_conversation' },
  u02n02: { topicId: 'fnd_v2_be_polite' },
  u02n05: { topicId: 'fnd_v2_survival' },
  u03n05: { topicId: 'fnd_v6_switch_meaning' },
  u03n04: { topicId: 'fnd_v6_build_be_sentences' },
  u05n01: { lessonId: 'fnd_v6_a_an_one_many' },
  u05n03: { lessonId: 'fnd_v6_one_and_many' },
  u04n02: { poolId: 'fnd_v6_emoji_people_things' },
  u04n05: { topicId: 'fnd_v2_people_family' },
  u05n04: { poolId: 'fnd_v6_emoji_one_or_many' },
  u05n05: { topicId: 'fnd_v6_make_noun_fit' },
  u06n01: { lessonId: 'fnd_v6_this_and_that' },
  u06n03: { lessonId: 'fnd_v6_these_those_details' },
  u06n05: { topicId: 'fnd_v6_small_blue_bag' },
  u07n04: { topicId: 'fnd_v6_owner_thing' },
  u07n01: { lessonId: 'fnd_v6_possessive_adjectives' },
  u07n03: { lessonId: 'fnd_v6_have_has' },
  u07n05: { topicId: 'fnd_v6_my_your_things' },
  u08n05: { topicId: 'fnd_v6_number_spelling' },
  u09n05: { topicId: 'fnd_v6_time_price' },
  u10n02: { poolId: 'fnd_v6_emoji_food_things' },
  u10n05: { topicId: 'fnd_v6_three_lines' },
  u12n01: { lessonId: 'fnd_v6_my_day' },
  u11n02: { poolId: 'fnd_v6_emoji_actions' },
  u13n02: { poolId: 'fnd_v6_emoji_happening_now' },
  u13n01: { lessonId: 'fnd_v6_action_ing' },
  u13n03: { lessonId: 'fnd_v6_be_ing_questions' },
  u12n05: { topicId: 'fnd_v6_change_i_to_she' },
  u13n05: { topicId: 'fnd_v6_now_or_every_day' },
  u14n05: { topicId: 'fnd_v6_match_question_answer' },
  u14n01: { lessonId: 'fnd_v6_what_who' },
  u14n03: { lessonId: 'fnd_v6_where_when_how' },
  u15n05: { topicId: 'fnd_v6_place_correctly' },
  u15n01: { lessonId: 'fnd_v6_there_is_are' },
  u15n03: { lessonId: 'fnd_v6_prepositions_place' },
  u16n02: { poolId: 'fnd_v6_emoji_foundation_warmup' },
  u16n05: { topicId: 'fnd_v2_ask_me' },
};

export function flattenFoundationV6Nodes(): FoundationV6NodeDef[] {
  return FOUNDATION_V6_CATALOG.chapters.flatMap((chapter) => chapter.items);
}

export function foundationV6NodeTypeCounts(): Record<FoundationV6NodeType, number> {
  const counts: Record<FoundationV6NodeType, number> = {
    lesson: 0,
    say_it: 0,
    emoji_speak: 0,
    pronunciation: 0,
    story_bites: 0,
    sentence_builder: 0,
    describe_it: 0,
    conversation: 0,
  };
  for (const node of flattenFoundationV6Nodes()) counts[node.type] += 1;
  return counts;
}

export function isFoundationV6RewardGameId(gameId: string): boolean {
  for (const node of flattenFoundationV6Nodes()) {
    const ref = FOUNDATION_V6_CONTENT_REFS[node.id];
    if (node.id === gameId) return true;
    if (ref?.topicId && [ref.topicId, `say_it:${ref.topicId}`].includes(gameId)) return true;
    if (ref?.poolId && [ref.poolId, `emoji_speak:${ref.poolId}`].includes(gameId)) return true;
  }
  return false;
}
