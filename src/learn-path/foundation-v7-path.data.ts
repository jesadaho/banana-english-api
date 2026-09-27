import catalogJson from './foundation-v7-path.catalog.json';
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
  | 'interactive_scenario';

export type FoundationV7Capability = 'say_it_guided';
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

export const FOUNDATION_V7_CATALOG = catalogJson as {
  metadata: {
    sourceVersion: string;
    pathId: string;
    version: number;
    releaseStatus: 'playtest';
    totalNodeCount: number;
  };
  chapters: Array<{
    id: string;
    number: number;
    titleEn: string;
    titleTh: string;
    outcome: string;
    items: FoundationV7Node[];
  }>;
  pathFinale?: FoundationV7PathFinale;
};

export const FOUNDATION_V7_PATH_FINALE = FOUNDATION_V7_CATALOG.pathFinale;

export const FOUNDATION_V7_NODES = [
  ...FOUNDATION_V7_CATALOG.chapters.flatMap((ch) => ch.items),
  ...(FOUNDATION_V7_PATH_FINALE?.items ?? []),
];

export const FOUNDATION_V7_PATH_ID = 'foundation_v7';

export function foundationV7NodeTypeCounts(): Record<
  FoundationV7NodeType,
  number
> {
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
  };
  for (const node of FOUNDATION_V7_NODES) result[node.type]++;
  return result;
}

const rewardAliases = new Map<string, string>();
for (const node of FOUNDATION_V7_NODES) {
  const ref = node.contentRef;
  const canonical =
    node.type === 'say_it' && ref.topicId
      ? `say_it:${ref.topicId}`
      : node.type === 'emoji_speak' && ref.poolId
        ? `emoji_speak:${ref.poolId}`
        : node.type === 'new_words' && ref.poolId
          ? `new_words:${ref.poolId}`
          : node.type === 'describe_it' && ref.poolId
            ? `describe_it:${ref.poolId}`
            : node.type === 'info_task' && ref.poolId
              ? `info_task:${ref.poolId}`
              : node.type === 'interactive_scenario' && ref.scenarioId
                ? `interactive_scenario:${ref.scenarioId}`
                : null;
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
  return FOUNDATION_V7_NODES.some(
    (n) => n.type === 'emoji_speak' && n.contentRef.poolId === id,
  );
}

export function isFoundationV7SimulationId(simulationId: string): boolean {
  return FOUNDATION_V7_NODES.some(
    (n) =>
      n.type === 'conversation' && n.contentRef.simulationId === simulationId,
  );
}

export function isFoundationV7ScenarioId(scenarioId: string): boolean {
  return (
    Boolean(getInteractiveScenario(scenarioId)) ||
    FOUNDATION_V7_NODES.some(
      (n) =>
        n.type === 'interactive_scenario' &&
        n.contentRef.scenarioId === scenarioId,
    )
  );
}

/** Last playable chapter node id — Path Finale unlocks after this. */
export function foundationV7LastChapterPlayableId(): string | undefined {
  const chapters = FOUNDATION_V7_CATALOG.chapters;
  const lastChapter = chapters[chapters.length - 1];
  const items = lastChapter?.items ?? [];
  for (let i = items.length - 1; i >= 0; i--) {
    const node = items[i]!;
    if (node.type !== 'story_bites') return node.id;
  }
  return undefined;
}
