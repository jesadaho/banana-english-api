import catalogJson from './foundation-v7-path.catalog.json';
import adventureA2CatalogJson from './adventure-a2-path.catalog.json';
import { getInteractiveScenario } from '../interactive-scenario/interactive-scenario.data';

export type FoundationV7NodeType =
  | 'lesson'
  | 'say_it'
  | 'emoji_speak'
  | 'new_words'
  | 'pronunciation'
  | 'describe_it'
  | 'story_bites'
  | 'conversation'
  | 'info_task'
  | 'interactive_scenario'
  | 'listen_up'
  | 'explain_it';

/** Old app builds omit newer capabilities, so those nodes stay locked for them. */
export const FOUNDATION_V7_CAPABILITIES = [
  'say_it_guided',
  'describe_it',
  'interactive_scenario',
  'listen_up',
  'story_bites',
  'explain_it',
] as const;
export type FoundationV7Capability = (typeof FOUNDATION_V7_CAPABILITIES)[number];
export type FoundationV7ContentRef = {
  lessonId?: string;
  topicId?: string;
  poolId?: string;
  simulationId?: string;
  scenarioId?: string;
};
export interface FoundationV7Node {
  id: string;
  code: string;
  order: number;
  globalOrder: number;
  titleEn: string;
  titleTh: string;
  type: FoundationV7NodeType;
  beat: string;
  learningTarget: string;
  activity: string;
  examples: string[];
  estimatedMinutes: number[];
  difficultyAxes: number[];
  contentRef: FoundationV7ContentRef;
  sayItMode?: 'guided';
  clipId?: string;
  /** Node stays Coming Soon until this flag is listed in LEARN_PATH_FLAGS. */
  featureFlag?: string;
  legacySimulationIds?: string[];
  pronunciation?: {
    sourceCourse: string;
    sourceLessonId: string;
    soundTarget: string;
    mode: string;
    lexicalPreview: string[];
  };
}

export type FoundationV7PathFinale = {
  id: string;
  titleEn: string;
  titleTh: string;
  outcome: string;
  items: FoundationV7Node[];
};

export type LearnPathCatalog = {
  metadata: {
    sourceVersion: string;
    pathId: string;
    version: number;
    releaseStatus: 'playtest' | 'preview' | 'live';
    totalNodeCount: number;
    level?: string;
    chapterEmoji?: string;
    finaleEmoji?: string;
    /** Chapters after this number are Coming Soon even when their content exists. */
    releasedChapterCount?: number;
  };
  chapters: Array<{
    id: string;
    number: number;
    titleEn: string;
    titleTh: string;
    outcome: string;
    zone?: number;
    items: FoundationV7Node[];
  }>;
  pathFinale?: FoundationV7PathFinale;
};

export type LearnCourse = {
  pathId: string;
  /** URL segment, e.g. GET /learn-path/adventure-a2. */
  slug: string;
  catalog: LearnPathCatalog;
  nodes: FoundationV7Node[];
};

function buildCourse(slug: string, catalog: LearnPathCatalog): LearnCourse {
  return {
    pathId: catalog.metadata.pathId,
    slug,
    catalog,
    nodes: [
      ...catalog.chapters.flatMap((ch) => ch.items),
      ...(catalog.pathFinale?.items ?? []),
    ],
  };
}

export const FOUNDATION_V7_CATALOG = catalogJson as LearnPathCatalog;

export const FOUNDATION_V7_PATH_FINALE = FOUNDATION_V7_CATALOG.pathFinale;

export const FOUNDATION_V7_PATH_ID = 'foundation_v7';
export const ADVENTURE_A2_PATH_ID = 'adventure_a2';

export const FOUNDATION_V7_COURSE = buildCourse('foundation-v7', FOUNDATION_V7_CATALOG);
export const ADVENTURE_A2_COURSE = buildCourse(
  'adventure-a2',
  adventureA2CatalogJson as LearnPathCatalog,
);

export const LEARN_COURSES: readonly LearnCourse[] = [
  FOUNDATION_V7_COURSE,
  ADVENTURE_A2_COURSE,
];

export const FOUNDATION_V7_NODES = FOUNDATION_V7_COURSE.nodes;

/** Every node of every catalog-driven course (V7 and later). */
export const ALL_LEARN_PATH_NODES: readonly FoundationV7Node[] = LEARN_COURSES.flatMap(
  (course) => course.nodes,
);

/** Accepts either the pathId (`adventure_a2`) or the URL slug (`adventure-a2`). */
export function learnCourseById(id: string): LearnCourse | undefined {
  return LEARN_COURSES.find((course) => course.pathId === id || course.slug === id);
}

export function learnCourseForChapter(chapterId: string): LearnCourse | undefined {
  return LEARN_COURSES.find((course) =>
    course.catalog.chapters.some((ch) => ch.id === chapterId),
  );
}

export function learnCourseForNodeId(nodeId: string): LearnCourse | undefined {
  return LEARN_COURSES.find((course) => course.nodes.some((n) => n.id === nodeId));
}

export function foundationV7NodeTypeCounts(
  course: LearnCourse = FOUNDATION_V7_COURSE,
): Record<FoundationV7NodeType, number> {
  const result: Record<FoundationV7NodeType, number> = {
    lesson: 0,
    say_it: 0,
    emoji_speak: 0,
    new_words: 0,
    pronunciation: 0,
    describe_it: 0,
    story_bites: 0,
    conversation: 0,
    info_task: 0,
    interactive_scenario: 0,
    listen_up: 0,
    explain_it: 0,
  };
  for (const node of course.nodes) result[node.type]++;
  return result;
}

const CANONICAL_POOL_TYPES: ReadonlySet<FoundationV7NodeType> = new Set([
  'emoji_speak',
  'new_words',
  'describe_it',
  'info_task',
  'listen_up',
  'story_bites',
  'explain_it',
]);

function canonicalRewardIdForNode(node: FoundationV7Node): string | null {
  const ref = node.contentRef;
  if (node.type === 'say_it' && ref.topicId) return `say_it:${ref.topicId}`;
  if (node.type === 'interactive_scenario' && ref.scenarioId) {
    return `interactive_scenario:${ref.scenarioId}`;
  }
  if (CANONICAL_POOL_TYPES.has(node.type) && ref.poolId) {
    return `${node.type}:${ref.poolId}`;
  }
  return null;
}

const rewardAliases = new Map<string, string>();
for (const node of ALL_LEARN_PATH_NODES) {
  const ref = node.contentRef;
  const canonical = canonicalRewardIdForNode(node);
  if (canonical) {
    for (const alias of [node.id, ref.topicId, ref.poolId, ref.scenarioId, canonical]) {
      if (alias) rewardAliases.set(alias, canonical);
    }
  }
}
rewardAliases.set('fnd_v2_say_first_conversation', 'say_it:fnd_v2_first_conversation');
rewardAliases.set('new_words_demo', 'new_words:new_words_demo');
rewardAliases.set('new_words:new_words_demo', 'new_words:new_words_demo');
rewardAliases.set('say_it:fnd_v7_u05n05', 'say_it:fnd_v7_u05n09');
rewardAliases.set('say_it:fnd_v7_u05n06', 'say_it:fnd_v7_u05n09');
rewardAliases.set(
  'info_task:info_task_listen_find',
  'describe_it:fnd_v7_u15n14_look_and_answer',
);

export function canonicalFoundationV7RewardId(id: string): string | undefined {
  return rewardAliases.get(id);
}
export function foundationV7RewardAliases(id: string): string[] {
  const canonical = rewardAliases.get(id);
  return canonical
    ? [...rewardAliases]
        .filter(([, value]) => value === canonical)
        .map(([alias]) => alias)
    : [id];
}
export function isFoundationV7EmojiPool(id: string): boolean {
  return ALL_LEARN_PATH_NODES.some(
    (n) => n.type === 'emoji_speak' && n.contentRef.poolId === id,
  );
}

export function isFoundationV7SimulationId(simulationId: string): boolean {
  return ALL_LEARN_PATH_NODES.some(
    (n) =>
      n.type === 'conversation' && n.contentRef.simulationId === simulationId,
  );
}

export function isFoundationV7ScenarioId(scenarioId: string): boolean {
  return (
    Boolean(getInteractiveScenario(scenarioId)) ||
    ALL_LEARN_PATH_NODES.some(
      (n) =>
        n.type === 'interactive_scenario' &&
        n.contentRef.scenarioId === scenarioId,
    )
  );
}

/** Last playable chapter node id — Path Finale unlocks after this. */
export function foundationV7LastChapterPlayableId(
  course: LearnCourse = FOUNDATION_V7_COURSE,
): string | undefined {
  const chapters = course.catalog.chapters;
  const lastChapter = chapters[chapters.length - 1];
  const items = lastChapter?.items ?? [];
  for (let i = items.length - 1; i >= 0; i--) {
    const node = items[i]!;
    if (node.type !== 'story_bites') return node.id;
  }
  return undefined;
}
