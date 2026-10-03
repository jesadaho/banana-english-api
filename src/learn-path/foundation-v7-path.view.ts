import { getLesson } from '../lessons/lessons.data';
import { getSimulation } from '../simulations/simulations.data';
import { foundationSayItDealCount, sayItPoolForTopic, sayItTopicById } from '../say-it/say-it.data';
import { emojiSpeakPoolById } from '../emoji-speak/emoji-speak.data';
import { isValidNewWordsPack, newWordsPoolById } from '../new-words/new-words.data';
import { isValidDescribeItPack, describeItPoolById, DESCRIBE_IT_ENABLED } from '../describe-it/describe-it.data';
import { isValidInfoTaskPack, infoTaskPoolById, INFO_TASK_ENABLED } from '../info-task/info-task.data';
import { getInteractiveScenario } from '../interactive-scenario/interactive-scenario.data';
import { foundationV7LessonLegacyIds } from '../lessons/foundation-v7-lesson-id-aliases';
import { hearItPoolById, isValidHearItPack } from '../hear-it/hear-it.data';
import { isValidStoryBitesPack, storyBitesPoolById } from '../story-bites/story-bites.data';
import {
  FOUNDATION_V7_COURSE,
  foundationV7LastChapterPlayableId,
  type FoundationV7Capability,
  type FoundationV7Node,
  type LearnCourse,
} from './foundation-v7-path.data';
import type { FoundationV5ClientNode } from './learn-path.service';

/** Comma-separated feature flags, e.g. `LEARN_PATH_FLAGS=a2_see_and_say_extra,a2_explain_it`. */
export function enabledLearnPathFlags(): Set<string> {
  return new Set(
    (process.env.LEARN_PATH_FLAGS ?? '')
      .split(',')
      .map((flag) => flag.trim())
      .filter(Boolean),
  );
}

export type FoundationV7ClientNode = FoundationV5ClientNode & {
  nodeType: FoundationV7Node['type'];
  beat: string;
  learningTarget: string;
  backendReady: boolean;
  unavailableReason?:
    | 'mechanic_not_implemented'
    | 'missing_content'
    | 'client_capability_required'
    | 'not_released'
    | 'feature_flag_off';
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

type MapContext = {
  capabilities: readonly FoundationV7Capability[];
  released: boolean;
  flags: Set<string>;
};

const TYPE_CAPABILITY: Partial<Record<FoundationV7Node['type'], FoundationV7Capability>> = {
  describe_it: 'describe_it',
  interactive_scenario: 'interactive_scenario',
  hear_it: 'hear_it',
  story_bites: 'story_bites',
  explain_it: 'explain_it',
};

const POOL_GATED_TYPES: ReadonlySet<FoundationV7Node['type']> = new Set([
  'describe_it',
  'info_task',
  'hear_it',
  'story_bites',
  'explain_it',
]);

function mapClientNode(
  node: FoundationV7Node,
  previousPlayableId: string | undefined,
  context: MapContext,
): { node: FoundationV7ClientNode; nextPrevious: string | undefined } {
  const flagOff = Boolean(node.featureFlag && !context.flags.has(node.featureFlag));
  const backendReady = hasFoundationV7Content(node);
  const typeCapability = TYPE_CAPABILITY[node.type];
  const requiredClientCapabilities: FoundationV7Capability[] = [
    ...(node.sayItMode === 'guided' ? (['say_it_guided'] as const) : []),
    ...(typeCapability ? [typeCapability] : []),
  ];
  const needsClient = requiredClientCapabilities.some(
    (cap) => !context.capabilities.includes(cap),
  );
  const unbuilt =
    (node.type === 'story_bites' && !node.contentRef.poolId) ||
    node.type === 'explain_it' ||
    (node.type === 'describe_it' && !DESCRIBE_IT_ENABLED) ||
    (node.type === 'info_task' && !INFO_TASK_ENABLED);
  const comingSoon = !backendReady || needsClient || !context.released || flagOff;
  const contentRef =
    POOL_GATED_TYPES.has(node.type) && (!backendReady || !context.released || flagOff)
      ? {}
      : node.contentRef;
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
        : !context.released
          ? 'not_released'
          : flagOff
            ? 'feature_flag_off'
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
      if (!INFO_TASK_ENABLED) return false;
      return Boolean(
        ref.poolId && isValidInfoTaskPack(infoTaskPoolById(ref.poolId)),
      );
    case 'interactive_scenario':
      return Boolean(
        ref.scenarioId && getInteractiveScenario(ref.scenarioId),
      );
    case 'hear_it':
      return Boolean(ref.poolId && isValidHearItPack(hearItPoolById(ref.poolId)));
    case 'story_bites':
      return Boolean(
        ref.poolId && isValidStoryBitesPack(storyBitesPoolById(ref.poolId)),
      );
    default:
      return false;
  }
}

function isChapterReleased(course: LearnCourse, chapterNumber: number): boolean {
  const limit = course.catalog.metadata.releasedChapterCount;
  return limit === undefined || chapterNumber <= limit;
}

/** Exact content references only; no title alias or fallback to a different mechanic. */
export function toFoundationV7ClientChapters(
  capabilities: readonly FoundationV7Capability[] = [],
  course: LearnCourse = FOUNDATION_V7_COURSE,
) {
  const flags = enabledLearnPathFlags();
  const emoji = course.catalog.metadata.chapterEmoji ?? '🍌';
  let previousPlayableId: string | undefined;
  return course.catalog.chapters.map((chapter) => {
    const context: MapContext = {
      capabilities,
      released: isChapterReleased(course, chapter.number),
      flags,
    };
    return {
      id: chapter.id,
      number: chapter.number,
      titleEn: chapter.titleEn,
      titleTh: chapter.titleTh,
      emoji,
      outcome: chapter.outcome,
      ...(chapter.zone !== undefined ? { zone: chapter.zone } : {}),
      items: chapter.items.map((node): FoundationV7ClientNode => {
        const mapped = mapClientNode(node, previousPlayableId, context);
        previousPlayableId = mapped.nextPrevious;
        return mapped.node;
      }),
    };
  });
}

/** Path Finale block — after the last chapter, not numbered as a chapter. */
export function toFoundationV7ClientFinale(
  capabilities: readonly FoundationV7Capability[] = [],
  course: LearnCourse = FOUNDATION_V7_COURSE,
): FoundationV7ClientFinale | null {
  const finale = course.catalog.pathFinale;
  if (!finale) return null;
  const unlockAfter = foundationV7LastChapterPlayableId(course);
  const lastChapter = course.catalog.chapters[course.catalog.chapters.length - 1];
  const context: MapContext = {
    capabilities,
    released: lastChapter ? isChapterReleased(course, lastChapter.number) : true,
    flags: enabledLearnPathFlags(),
  };
  return {
    id: finale.id,
    kind: 'finale',
    titleEn: finale.titleEn,
    titleTh: finale.titleTh,
    emoji: course.catalog.metadata.finaleEmoji ?? '🎓',
    outcome: finale.outcome,
    items: finale.items.map((node) => {
      const mapped = mapClientNode(node, unlockAfter, context);
      return mapped.node;
    }),
  };
}
