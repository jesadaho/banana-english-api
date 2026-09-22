import catalogJson from './foundation-v7-path.catalog.json';

export type FoundationV7NodeType = 'lesson' | 'say_it' | 'emoji_speak' | 'new_words' | 'pronunciation' | 'describe_it' | 'story_bites' | 'conversation';
export type FoundationV7Capability = 'say_it_guided';
export type FoundationV7ContentRef = { lessonId?: string; topicId?: string; poolId?: string; simulationId?: string };
export interface FoundationV7Node {
  id: string; code: string; order: number; globalOrder: number; titleEn: string; titleTh: string;
  type: FoundationV7NodeType; beat: string; learningTarget: string; activity: string;
  examples: string[]; estimatedMinutes: number[]; difficultyAxes: number[];
  contentRef: FoundationV7ContentRef; sayItMode?: 'guided'; clipId?: string;
  legacySimulationIds?: string[];
  pronunciation?: { sourceCourse: string; sourceLessonId: string; soundTarget: string; mode: string; lexicalPreview: string[] };
}
export const FOUNDATION_V7_CATALOG = catalogJson as {
  metadata: { sourceVersion: string; pathId: string; version: number; releaseStatus: 'playtest'; totalNodeCount: number };
  chapters: Array<{ id: string; number: number; titleEn: string; titleTh: string; outcome: string; items: FoundationV7Node[] }>;
};
export const FOUNDATION_V7_NODES = FOUNDATION_V7_CATALOG.chapters.flatMap(ch => ch.items);
export const FOUNDATION_V7_PATH_ID = 'foundation_v7';
export function foundationV7NodeTypeCounts(): Record<FoundationV7NodeType, number> {
  const result = { lesson: 0, say_it: 0, emoji_speak: 0, new_words: 0, pronunciation: 0, describe_it: 0, story_bites: 0, conversation: 0 };
  for (const node of FOUNDATION_V7_NODES) result[node.type]++;
  return result;
}

// Only real mini-games may claim mini-game rewards. In particular, never
// accept a lesson, simulation or coming-soon media node through this route.
const rewardAliases = new Map<string, string>();
for (const node of FOUNDATION_V7_NODES) {
  const ref = node.contentRef;
  const canonical = node.type === 'say_it' && ref.topicId ? `say_it:${ref.topicId}`
    : node.type === 'emoji_speak' && ref.poolId ? `emoji_speak:${ref.poolId}`
    : node.type === 'new_words' && ref.poolId ? `new_words:${ref.poolId}`
    : node.type === 'describe_it' && ref.poolId ? `describe_it:${ref.poolId}` : null;
  if (canonical) {
    for (const alias of [node.id, ref.topicId, ref.poolId, canonical]) {
      if (alias) rewardAliases.set(alias, canonical);
    }
  }
}
// Frozen Chapter 1 was also completed using the old path node ID.
rewardAliases.set('fnd_v2_say_first_conversation', 'say_it:fnd_v2_first_conversation');
rewardAliases.set('new_words_demo', 'new_words:new_words_demo');
rewardAliases.set('new_words:new_words_demo', 'new_words:new_words_demo');
// Say It "The Right Amount" topic ids used before Describe It claimed fnd_v7_u05n05.
rewardAliases.set('say_it:fnd_v7_u05n05', 'say_it:fnd_v7_u05n09');
rewardAliases.set('say_it:fnd_v7_u05n06', 'say_it:fnd_v7_u05n09');
export function canonicalFoundationV7RewardId(id: string): string | undefined {
  return rewardAliases.get(id);
}
export function foundationV7RewardAliases(id: string): string[] {
  const canonical = rewardAliases.get(id);
  return canonical ? [...rewardAliases].filter(([, value]) => value === canonical).map(([alias]) => alias) : [id];
}
export function isFoundationV7EmojiPool(id: string): boolean {
  return FOUNDATION_V7_NODES.some(n => n.type === 'emoji_speak' && n.contentRef.poolId === id);
}

/** Conversations on the V7 path — not in the Adventure series catalog. */
export function isFoundationV7SimulationId(simulationId: string): boolean {
  return FOUNDATION_V7_NODES.some(
    (n) => n.type === 'conversation' && n.contentRef.simulationId === simulationId,
  );
}
