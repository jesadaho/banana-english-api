import { getLesson } from '../lessons/lessons.data';
import { getSimulation } from '../simulations/simulations.data';
import { foundationSayItDealCount, sayItPoolForTopic, sayItTopicById } from '../say-it/say-it.data';
import { emojiSpeakPoolById } from '../emoji-speak/emoji-speak.data';
import { isValidNewWordsPack, newWordsPoolById } from '../new-words/new-words.data';
import { isValidDescribeItPack, describeItPoolById, DESCRIBE_IT_ENABLED } from '../describe-it/describe-it.data';
import { isValidInfoTaskPack, infoTaskPoolById } from '../info-task/info-task.data';
import { getInteractiveScenario } from '../interactive-scenario/interactive-scenario.data';
import { foundationV7LessonLegacyIds } from '../lessons/foundation-v7-lesson-id-aliases';
import {
  FOUNDATION_V7_CATALOG,
  FOUNDATION_V7_PATH_FINALE,
  foundationV7LastChapterPlayableId,
  type FoundationV7Capability,
  type FoundationV7Node,
} from './foundation-v7-path.data';
import type { FoundationV5ClientNode } from './learn-path.service';

export type FoundationV7ClientNode = FoundationV5ClientNode & {
  nodeType: FoundationV7Node['type'];
  beat: string;
  learningTarget: string;
  backendReady: boolean;
  unavailableReason?:
    | 'mechanic_not_implemented'
    | 'missing_content'
    | 'client_capability_required';
  requiredClientCapabilities: FoundationV7Capability[];
  sayItMode?: 'guided';
  pronunciation?: FoundationV7Node['pronunciation'];
  scenarioId?: string;
};

export type FoundationV7ClientFinale = {
  id: string;
  kind: 'finale';
  titleEn: string;
  titleTh: string;
  emoji: string;
  outcome: string;
  items: FoundationV7ClientNode[];
};

function mapClientNode(
  node: FoundationV7Node,
  previousPlayableId: string | undefined,
  capabilities: readonly FoundationV7Capability[],
): { node: FoundationV7ClientNode; nextPrevious: string | undefined } {
  const backendReady = hasFoundationV7Content(node);
  const requiredClientCapabilities: FoundationV7Capability[] =
    node.sayItMode === 'guided' ? ['say_it_guided'] : [];
  const needsClient = requiredClientCapabilities.some(
    (cap) => !capabilities.includes(cap),
  );
  const unbuilt =
    node.type === 'story_bites' ||
    (node.type === 'describe_it' && !DESCRIBE_IT_ENABLED);
  const comingSoon = !backendReady || needsClient;
  const contentRef =
    node.type === 'describe_it' && !backendReady ? {} : node.contentRef;
  const result: FoundationV7ClientNode = {
    id: node.id,
    code: node.code,
    titleEn: node.titleEn,
    titleTh: node.titleTh,
    type: node.type === 'conversation' ? 'mission' : node.type,
    nodeType: node.type,
    beat: node.beat,
    learningTarget: node.learningTarget,
    countsTowardProgress: !comingSoon,
    comingSoon,
    backendReady,
    unavailableReason: unbuilt
      ? 'mechanic_not_implemented'
      : !backendReady
        ? 'missing_content'
        : needsClient
          ? 'client_capability_required'
          : undefined,
    requiredClientCapabilities,
    estimatedMinutes: Math.ceil(
      (node.estimatedMinutes[0] + node.estimatedMinutes[1]) / 2,
    ),
    unlockAfterNodeIds: previousPlayableId ? [previousPlayableId] : [],
    ...contentRef,
    ...(node.type === 'lesson' && contentRef.lessonId
      ? { legacyLessonIds: foundationV7LessonLegacyIds(contentRef.lessonId) }
      : {}),
    ...(node.legacySimulationIds
      ? { legacySimulationIds: node.legacySimulationIds }
      : {}),
    sayItMode: node.sayItMode,
    pronunciation: node.pronunciation,
  };
  return {
    node: result,
    nextPrevious: comingSoon ? previousPlayableId : node.id,
  };
}

export function hasFoundationV7Content(node: FoundationV7Node): boolean {
  const ref = node.contentRef;
  switch (node.type) {
    case 'lesson':
    case 'pronunciation':
      return Boolean(ref.lessonId && getLesson(ref.lessonId));
    case 'conversation':
      return Boolean(ref.simulationId && getSimulation(ref.simulationId));
    case 'say_it':
      return Boolean(
        ref.topicId &&
          sayItTopicById(ref.topicId) &&
          sayItPoolForTopic(ref.topicId).length >=
            foundationSayItDealCount(ref.topicId),
      );
    case 'emoji_speak':
      return Boolean(
        ref.poolId && (emojiSpeakPoolById(ref.poolId)?.items.length ?? 0) > 0,
      );
    case 'new_words':
      return Boolean(
        ref.poolId && isValidNewWordsPack(newWordsPoolById(ref.poolId)),
      );
    case 'describe_it':
      if (!DESCRIBE_IT_ENABLED) return false;
      return Boolean(
        ref.poolId && isValidDescribeItPack(describeItPoolById(ref.poolId)),
      );
    case 'info_task':
      return Boolean(
        ref.poolId && isValidInfoTaskPack(infoTaskPoolById(ref.poolId)),
      );
    case 'interactive_scenario':
      return Boolean(
        ref.scenarioId && getInteractiveScenario(ref.scenarioId),
      );
    default:
      return false;
  }
}

/** Exact content references only; no title alias or fallback to a different mechanic. */
export function toFoundationV7ClientChapters(
  capabilities: readonly FoundationV7Capability[] = [],
) {
  let previousPlayableId: string | undefined;
  return FOUNDATION_V7_CATALOG.chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.number,
    titleEn: chapter.titleEn,
    titleTh: chapter.titleTh,
    emoji: '🍌',
    outcome: chapter.outcome,
    items: chapter.items.map((node): FoundationV7ClientNode => {
      const mapped = mapClientNode(node, previousPlayableId, capabilities);
      previousPlayableId = mapped.nextPrevious;
      return mapped.node;
    }),
  }));
}

/** Path Finale block — after 16 chapters, not numbered as Chapter 17. */
export function toFoundationV7ClientFinale(
  capabilities: readonly FoundationV7Capability[] = [],
): FoundationV7ClientFinale | null {
  const finale = FOUNDATION_V7_PATH_FINALE;
  if (!finale) return null;
  const unlockAfter = foundationV7LastChapterPlayableId();
  return {
    id: finale.id,
    kind: 'finale',
    titleEn: finale.titleEn,
    titleTh: finale.titleTh,
    emoji: '🎓',
    outcome: finale.outcome,
    items: finale.items.map((node) => {
      const mapped = mapClientNode(node, unlockAfter, capabilities);
      return mapped.node;
    }),
  };
}
