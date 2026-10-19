import {
  ADVENTURE_A2_COURSE,
  FOUNDATION_V7_COURSE,
  learnCourseById,
  type FoundationV7Node,
  type LearnCourse,
} from '../learn-path/foundation-v7-path.data';
import { hasFoundationV7Content } from '../learn-path/foundation-v7-path.view';
import type {
  PlacementPublicResult,
  PlacementRecommendationType,
} from './placement.types';

const FOUNDATION_START = {
  pathId: 'foundation_v7',
  chapterId: 'v7_u01',
  nodeId: 'v7_u01n01',
} as const;

type Intended = 'B1' | 'B2' | null;

type DesiredStart = {
  recommendationType: PlacementRecommendationType;
  intendedNextLevel: Intended;
  pathId: string | null;
  chapterId: string | null;
  nodeId: string | null;
  fallbackPathId: string | null;
  fallbackChapterId: string | null;
  fallbackNodeId: string | null;
  fallbackNoticeTh: string | null;
};

export type ResolvedPlacementStart = {
  recommendationType: PlacementRecommendationType;
  intendedNextLevel: Intended;
  recommendedStartKey: string;
  pathId: string | null;
  chapterId: string | null;
  nodeId: string | null;
  titleEn: string | null;
  titleTh: string | null;
  appRoute: string | null;
  contentRef: FoundationV7Node['contentRef'] | null;
  resolvedCatalogVersion: string | null;
  usedFallback: boolean;
  fallbackPathId: string | null;
  fallbackChapterId: string | null;
  fallbackNodeId: string | null;
  fallbackNoticeTh: string | null;
};

function chapterReleased(course: LearnCourse, chapterId: string): boolean {
  const chapter = course.catalog.chapters.find((row) => row.id === chapterId);
  if (!chapter) return false;
  const limit = course.catalog.metadata.releasedChapterCount;
  return limit === undefined || chapter.number <= limit;
}

function lookupNode(
  pathId: string,
  nodeId: string,
): {
  course: LearnCourse;
  chapterId: string;
  node: FoundationV7Node;
  ready: boolean;
} | null {
  const course = learnCourseById(pathId);
  if (!course) return null;
  const chapter = course.catalog.chapters.find((row) =>
    row.items.some((item) => item.id === nodeId),
  );
  const node = chapter?.items.find((item) => item.id === nodeId);
  if (!chapter || !node) return null;
  const ready =
    chapterReleased(course, chapter.id) && hasFoundationV7Content(node);
  return { course, chapterId: chapter.id, node, ready };
}

function appRouteFor(node: FoundationV7Node): string {
  const ref = node.contentRef;
  switch (node.type) {
    case 'new_words':
      return `/learn/new-words/${ref.poolId ?? node.id}/intro`;
    case 'say_it':
      return `/games/say-it-in-english/${ref.topicId ?? node.id}/intro?from=foundation`;
    case 'emoji_speak':
      return `/learn/emoji-speak/${ref.poolId ?? node.id}/intro`;
    case 'conversation':
      return `/mission/${ref.simulationId ?? node.id}`;
    case 'interactive_scenario':
      return `/learn/scenario/${ref.scenarioId ?? node.id}`;
    case 'describe_it':
      return `/games/describe-it/${ref.poolId ?? node.id}/intro?from=foundation`;
    case 'listen_up':
      return `/learn/listen-up/${ref.poolId ?? node.id}/intro`;
    case 'story_bites':
      return `/learn/story-bites/${ref.poolId ?? node.id}`;
    case 'info_task':
      return `/learn/info-task/${ref.poolId ?? node.id}`;
    default:
      return `/learn/lesson/${ref.lessonId ?? node.id}`;
  }
}

function pack(
  found: NonNullable<ReturnType<typeof lookupNode>>,
  extra: {
    recommendationType: PlacementRecommendationType;
    intendedNextLevel: Intended;
    startKey: string;
    usedFallback: boolean;
    fallbackPathId: string | null;
    fallbackChapterId: string | null;
    fallbackNodeId: string | null;
    fallbackNoticeTh: string | null;
  },
): ResolvedPlacementStart {
  return {
    recommendationType: extra.recommendationType,
    intendedNextLevel: extra.intendedNextLevel,
    recommendedStartKey: extra.startKey,
    pathId: found.course.pathId,
    chapterId: found.chapterId,
    nodeId: found.node.id,
    titleEn: found.node.titleEn,
    titleTh: found.node.titleTh,
    appRoute: appRouteFor(found.node),
    contentRef: found.node.contentRef,
    resolvedCatalogVersion: found.course.catalog.metadata.sourceVersion,
    usedFallback: extra.usedFallback,
    fallbackPathId: extra.fallbackPathId,
    fallbackChapterId: extra.fallbackChapterId,
    fallbackNodeId: extra.fallbackNodeId,
    fallbackNoticeTh: extra.fallbackNoticeTh,
  };
}

function comingSoon(
  startKey: string,
  intended: Intended,
): ResolvedPlacementStart {
  return {
    recommendationType: 'coming_soon',
    intendedNextLevel: intended,
    recommendedStartKey: startKey,
    pathId: null,
    chapterId: null,
    nodeId: null,
    titleEn: null,
    titleTh: null,
    appRoute: null,
    contentRef: null,
    resolvedCatalogVersion:
      intended === 'B2'
        ? ADVENTURE_A2_COURSE.catalog.metadata.sourceVersion
        : FOUNDATION_V7_COURSE.catalog.metadata.sourceVersion,
    usedFallback: false,
    fallbackPathId: null,
    fallbackChapterId: null,
    fallbackNodeId: null,
    fallbackNoticeTh: null,
  };
}

function desiredFor(result: PlacementPublicResult | null): DesiredStart {
  switch (result) {
    case 'Seed':
      return {
        recommendationType: 'course_start',
        intendedNextLevel: null,
        pathId: FOUNDATION_START.pathId,
        chapterId: FOUNDATION_START.chapterId,
        nodeId: FOUNDATION_START.nodeId,
        fallbackPathId: null,
        fallbackChapterId: null,
        fallbackNodeId: null,
        fallbackNoticeTh: null,
      };
    case 'Seed+':
      return {
        recommendationType: 'chapter_start',
        intendedNextLevel: null,
        pathId: 'foundation_v7',
        chapterId: 'v7_u08',
        nodeId: 'v7_u08n01',
        fallbackPathId: FOUNDATION_START.pathId,
        fallbackChapterId: FOUNDATION_START.chapterId,
        fallbackNodeId: FOUNDATION_START.nodeId,
        fallbackNoticeTh:
          'จุดเข้าบท 8 ยังไม่พร้อม เลยเริ่มที่เส้นทางที่เปิดใช้งานได้ — ระดับยังเป็น Seed+',
      };
    case 'A1':
      return {
        recommendationType: 'course_start',
        intendedNextLevel: null,
        pathId: 'adventure_a2',
        chapterId: 'a2_c01',
        nodeId: 'a2_c01n01',
        fallbackPathId: FOUNDATION_START.pathId,
        fallbackChapterId: FOUNDATION_START.chapterId,
        fallbackNodeId: FOUNDATION_START.nodeId,
        fallbackNoticeTh: null,
      };
    case 'A1+':
      return {
        recommendationType: 'review_checkpoint',
        intendedNextLevel: null,
        pathId: 'adventure_a2',
        chapterId: 'a2_c08',
        nodeId: 'a2_c08n01',
        fallbackPathId: 'adventure_a2',
        fallbackChapterId: 'a2_c01',
        fallbackNodeId: 'a2_c01n01',
        fallbackNoticeTh:
          'จุดทบทวนบท 8 ยังไม่พร้อม เลยเริ่มที่ต้น Adventure A2',
      };
    case 'A2':
    case 'A2+':
      return {
        recommendationType: 'coming_soon',
        intendedNextLevel: 'B1',
        pathId: null,
        chapterId: null,
        nodeId: null,
        fallbackPathId: null,
        fallbackChapterId: null,
        fallbackNodeId: null,
        fallbackNoticeTh: null,
      };
    case 'B1':
      return {
        recommendationType: 'coming_soon',
        intendedNextLevel: 'B2',
        pathId: null,
        chapterId: null,
        nodeId: null,
        fallbackPathId: null,
        fallbackChapterId: null,
        fallbackNodeId: null,
        fallbackNoticeTh: null,
      };
    default:
      return {
        recommendationType: 'course_start',
        intendedNextLevel: null,
        pathId: null,
        chapterId: null,
        nodeId: null,
        fallbackPathId: FOUNDATION_START.pathId,
        fallbackChapterId: FOUNDATION_START.chapterId,
        fallbackNodeId: FOUNDATION_START.nodeId,
        fallbackNoticeTh: null,
      };
  }
}

export function resolvePlacementStart(
  publicResult: PlacementPublicResult | null,
): ResolvedPlacementStart {
  const desired = desiredFor(publicResult);
  if (desired.recommendationType === 'coming_soon') {
    return comingSoon(
      publicResult === 'B1' ? 'coming_soon_b2' : 'coming_soon_b1',
      desired.intendedNextLevel,
    );
  }
  if (publicResult === null) {
    return {
      recommendationType: 'course_start',
      intendedNextLevel: null,
      recommendedStartKey: 'retry_or_foundation',
      pathId: null,
      chapterId: null,
      nodeId: null,
      titleEn: null,
      titleTh: null,
      appRoute: null,
      contentRef: null,
      resolvedCatalogVersion: FOUNDATION_V7_COURSE.catalog.metadata.sourceVersion,
      usedFallback: false,
      fallbackPathId: desired.fallbackPathId,
      fallbackChapterId: desired.fallbackChapterId,
      fallbackNodeId: desired.fallbackNodeId,
      fallbackNoticeTh: null,
    };
  }
  if (desired.pathId && desired.nodeId) {
    const found = lookupNode(desired.pathId, desired.nodeId);
    if (found?.ready) {
      return pack(found, {
        recommendationType: desired.recommendationType,
        intendedNextLevel: desired.intendedNextLevel,
        startKey:
          publicResult === 'Seed'
            ? 'foundation_beginning'
            : publicResult === 'Seed+'
              ? 'foundation_ch8'
              : publicResult === 'A1'
                ? 'adventure_a2'
                : 'adventure_a2_ch8',
        usedFallback: false,
        fallbackPathId: desired.fallbackPathId,
        fallbackChapterId: desired.fallbackChapterId,
        fallbackNodeId: desired.fallbackNodeId,
        fallbackNoticeTh: null,
      });
    }
  }
  if (desired.fallbackPathId && desired.fallbackNodeId) {
    const fallback = lookupNode(desired.fallbackPathId, desired.fallbackNodeId);
    if (fallback?.ready) {
      return pack(fallback, {
        recommendationType: desired.recommendationType,
        intendedNextLevel: desired.intendedNextLevel,
        startKey:
          publicResult === 'Seed+'
            ? 'foundation_ch8_fallback'
            : publicResult === 'A1+'
              ? 'adventure_a2_ch8_fallback'
              : 'foundation_beginning',
        usedFallback: true,
        fallbackPathId: desired.fallbackPathId,
        fallbackChapterId: desired.fallbackChapterId,
        fallbackNodeId: desired.fallbackNodeId,
        fallbackNoticeTh: desired.fallbackNoticeTh,
      });
    }
  }
  return comingSoon('retry_or_foundation', null);
}

export function placementUnlockPrefix(
  pathId: string,
  entryNodeId: string,
): string[] {
  const course = learnCourseById(pathId);
  if (!course) return [];
  const ids: string[] = [];
  for (const chapter of course.catalog.chapters) {
    for (const node of chapter.items) {
      if (node.id === entryNodeId) return ids;
      if (hasFoundationV7Content(node) && chapterReleased(course, chapter.id)) {
        ids.push(node.id);
      }
    }
  }
  return ids;
}
