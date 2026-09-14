import catalogJson from './foundation-v5-path.catalog.json';

export const FOUNDATION_V5_PATH_ID = 'foundation_v5';
export const FOUNDATION_V5_VERSION = 1;

export type FoundationV5NodeType =
  | 'lesson'
  | 'say_it'
  | 'emoji_speak'
  | 'pronunciation'
  | 'story_bites'
  | 'sentence_builder'
  | 'describe_it'
  | 'skill_check'
  | 'conversation';

export type FoundationV5Availability = 'catalog_ready' | 'coming_soon';

export type FoundationV5NodeDef = {
  id: string;
  code: string;
  order: number;
  globalOrder: number;
  titleEn: string;
  type: FoundationV5NodeType;
  learningTarget: string;
  activity: string;
  estimatedMinutes: number;
  newSkillIds: string[];
  reviewedSkillIds: string[];
  prerequisiteNodeIds: string[];
  comingSoon: boolean;
  availability: FoundationV5Availability;
};

export type FoundationV5ChapterDef = {
  id: string;
  number: number;
  titleEn: string;
  phase: 'Ki' | 'Sho' | 'Ten' | 'Ketsu';
  items: FoundationV5NodeDef[];
};

export type FoundationV5Catalog = {
  metadata: {
    sourceVersion: string;
    totalNodeCount: number;
    macroArc: Record<string, string>;
  };
  chapters: FoundationV5ChapterDef[];
};

/**
 * Approved A1 Foundation R6 catalog.
 *
 * This endpoint is intentionally additive while Foundation V2 remains live.
 * `story_bites` is advertised as coming soon until the Flutter renderer ships.
 */
export const FOUNDATION_V5_CATALOG = catalogJson as FoundationV5Catalog;

export function flattenFoundationV5Nodes(): FoundationV5NodeDef[] {
  return FOUNDATION_V5_CATALOG.chapters.flatMap((chapter) => chapter.items);
}

export function foundationV5NodeTypeCounts(): Record<FoundationV5NodeType, number> {
  const counts: Record<FoundationV5NodeType, number> = {
    lesson: 0,
    say_it: 0,
    emoji_speak: 0,
    pronunciation: 0,
    story_bites: 0,
    sentence_builder: 0,
    describe_it: 0,
    skill_check: 0,
    conversation: 0,
  };

  for (const node of flattenFoundationV5Nodes()) counts[node.type] += 1;
  return counts;
}
