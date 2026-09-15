import { getLesson } from '../lessons/lessons.data';
import { getSimulation } from '../simulations/simulations.data';
import { sayItPoolForTopic, sayItTopicById } from '../say-it/say-it.data';
import { emojiSpeakPoolById } from '../emoji-speak/emoji-speak.data';
import { foundationV7LessonLegacyIds } from '../lessons/foundation-v7-lesson-id-aliases';
import { FOUNDATION_V7_CATALOG, type FoundationV7Capability, type FoundationV7Node } from './foundation-v7-path.data';
import type { FoundationV5ClientNode } from './learn-path.service';

export type FoundationV7ClientNode = FoundationV5ClientNode & {
  nodeType: FoundationV7Node['type']; beat: string; learningTarget: string;
  backendReady: boolean;
  unavailableReason?: 'mechanic_not_implemented' | 'missing_content' | 'client_capability_required';
  requiredClientCapabilities: FoundationV7Capability[];
  sayItMode?: 'guided'; pronunciation?: FoundationV7Node['pronunciation'];
};

export function hasFoundationV7Content(node: FoundationV7Node): boolean {
  const ref = node.contentRef;
  switch(node.type) {
    case 'lesson': case 'pronunciation': return Boolean(ref.lessonId && getLesson(ref.lessonId));
    case 'conversation': return Boolean(ref.simulationId && getSimulation(ref.simulationId));
    case 'say_it': return Boolean(ref.topicId && sayItTopicById(ref.topicId) && sayItPoolForTopic(ref.topicId).length === 5);
    case 'emoji_speak': return Boolean(ref.poolId && (emojiSpeakPoolById(ref.poolId)?.items.length ?? 0) > 0);
    default: return false;
  }
}

/** Exact content references only; no title alias or fallback to a different mechanic. */
export function toFoundationV7ClientChapters(capabilities: readonly FoundationV7Capability[] = []) {
  let previousPlayableId: string | undefined;
  return FOUNDATION_V7_CATALOG.chapters.map(chapter => ({
    id: chapter.id, number: chapter.number, titleEn: chapter.titleEn, titleTh: chapter.titleTh,
    emoji: '🍌', outcome: chapter.outcome,
    items: chapter.items.map((node): FoundationV7ClientNode => {
      const backendReady = hasFoundationV7Content(node);
      const requiredClientCapabilities: FoundationV7Capability[] = node.sayItMode === 'guided' ? ['say_it_guided'] : [];
      const needsClient = requiredClientCapabilities.some(cap => !capabilities.includes(cap));
      const unbuilt = node.type === 'describe_it' || node.type === 'story_bites';
      const comingSoon = !backendReady || needsClient;
      const result: FoundationV7ClientNode = {
        id: node.id, code: node.code, titleEn: node.titleEn, titleTh: node.titleTh,
        type: node.type === 'conversation' ? 'mission' : node.type,
        nodeType: node.type, beat: node.beat, learningTarget: node.learningTarget,
        countsTowardProgress: !comingSoon, comingSoon, backendReady,
        unavailableReason: unbuilt ? 'mechanic_not_implemented' : !backendReady ? 'missing_content' : needsClient ? 'client_capability_required' : undefined,
        requiredClientCapabilities,
        estimatedMinutes: Math.ceil((node.estimatedMinutes[0] + node.estimatedMinutes[1]) / 2),
        unlockAfterNodeIds: previousPlayableId ? [previousPlayableId] : [],
        ...node.contentRef,
        ...(node.type === 'lesson' && node.contentRef.lessonId
          ? { legacyLessonIds: foundationV7LessonLegacyIds(node.contentRef.lessonId) }
          : {}),
        ...(node.legacySimulationIds ? { legacySimulationIds: node.legacySimulationIds } : {}),
        sayItMode: node.sayItMode, pronunciation: node.pronunciation,
      };
      // A placeholder remains visible, but cannot block every later lesson.
      if (!comingSoon) previousPlayableId = node.id;
      return result;
    }),
  }));
}
