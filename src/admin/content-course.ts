import { flattenFoundationV2Nodes } from '../learn-path/foundation-v2-path.data';
import {
  ADVENTURE_A2_COURSE,
  ALL_LEARN_PATH_NODES,
  canonicalFoundationV7RewardId,
  FOUNDATION_V7_CATALOG,
  FOUNDATION_V7_COURSE,
  LEARN_COURSES,
  type FoundationV7Capability,
} from '../learn-path/foundation-v7-path.data';
import { toFoundationV7ClientChapters } from '../learn-path/foundation-v7-path.view';
import { wordCardsNodeForChapter } from '../learn-path/word-cards.data';
import { listenDrillNodeForChapter } from '../learn-path/listen-drill.data';
import { canonicalFoundationV7LessonId } from '../lessons/foundation-v7-lesson-id-aliases';
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
  'adventure_a2',
  'everyday',
  'pronunciation',
  'minigame',
  'other',
] as const;

export type ContentCourse = (typeof CONTENT_COURSES)[number];

export const EMPTY_COURSE_COUNTS: Record<ContentCourse, number> = {
  foundation: 0,
  adventure_a2: 0,
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
  game_word_cards: 'Word Cards',
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
    for (const node of ALL_LEARN_PATH_NODES) {
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
      if (node.type === 'word_cards' && ref.poolId) {
        foundationTitleById.set(`word_cards:${ref.poolId}`, node.titleEn);
      }
      const canonical = canonicalFoundationV7RewardId(node.id);
      if (canonical) foundationTitleById.set(canonical, node.titleEn);
    }
    for (const course of LEARN_COURSES) {
      for (const chapter of course.catalog.chapters) {
        foundationTitleById.set(
          `skip_quiz:${chapter.id}`,
          `Skip Quiz · ${chapter.titleEn}`,
        );
      }
    }
    for (const chapter of FOUNDATION_V7_CATALOG.chapters) {
      const review = wordCardsNodeForChapter(chapter);
      const poolId = review?.contentRef.poolId;
      if (!review || !poolId) continue;
      foundationTitleById.set(review.id, review.titleEn);
      foundationTitleById.set(poolId, review.titleEn);
      foundationTitleById.set(`word_cards:${poolId}`, review.titleEn);
    }
    for (const chapter of FOUNDATION_V7_CATALOG.chapters) {
      const drill = listenDrillNodeForChapter(chapter);
      const poolId = drill?.contentRef.poolId;
      if (!drill || !poolId) continue;
      const title = `${drill.titleEn} (easy) · ${chapter.titleEn}`;
      foundationTitleById.set(drill.id, title);
      foundationTitleById.set(poolId, title);
      foundationTitleById.set(`listen_drill:${poolId}`, title);
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
  const bare = trimmed.includes(':') ? trimmed.slice(trimmed.indexOf(':') + 1) : trimmed;
  if (bare.startsWith('a2_') || bare.startsWith('adventure_a2_')) return 'adventure_a2';
  if (
    trimmed.startsWith('say_it:') ||
    trimmed.startsWith('describe_it:') ||
    trimmed.startsWith('emoji_speak:') ||
    trimmed.startsWith('new_words:') ||
    trimmed.startsWith('word_cards:') ||
    trimmed.startsWith('listen_drill:') ||
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
  const title = baseContentItemTitle(id);
  return isComingSoonStage(id) ? `${title} · coming soon` : title;
}

function baseContentItemTitle(id: string): string {
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

/**
 * What the current app sends as `capabilities` for the Foundations path
 * (`foundation_path_providers.dart`). Admin builds the path from the same
 * view as the app, so generated nodes (Listen Up easy, in·on·at, object
 * pronouns) show up in place and the numbers match the map. Keep in sync.
 */
export const ADMIN_PATH_CAPABILITIES: readonly FoundationV7Capability[] = [
  'say_it_guided',
  'describe_it',
  'interactive_scenario',
  'listen_drill',
  'in_on_at',
  'object_pronouns',
];

/** Same for Adventure A2 (`LearnPathSource.adventureA2` in the app). */
export const ADMIN_A2_PATH_CAPABILITIES: readonly FoundationV7Capability[] = [
  'say_it_guided',
  'describe_it',
  'interactive_scenario',
  'listen_up',
  'story_bites',
];

/** A2 sorts after the whole Foundations path in the stage table. */
const A2_ORDER_OFFSET = 100_000;

type AdminPathCourse = 'foundation' | 'adventure_a2';

type AdminPathNode = {
  course: AdminPathCourse;
  /** Shown as "coming soon" on the map (not playable yet). */
  comingSoon: boolean;
  id: string;
  type: string;
  code: string;
  titleEn: string;
  /** Running order over the whole path (1-based). */
  globalOrder: number;
  /** 1-based position on the chapter map, as the learner sees it. */
  order: number;
  lessonId?: string;
  simulationId?: string;
  chapterNumber: number;
  chapterTitleEn: string;
};

let adminPathNodes: AdminPathNode[] | null = null;

/**
 * The Foundations and Adventure A2 maps exactly as the app shows them (incl.
 * generated nodes and "coming soon" ones), in path order.
 */
export function foundationV7AdminPathNodes(): AdminPathNode[] {
  if (!adminPathNodes) {
    adminPathNodes = [];
    const courses = [
      { course: 'foundation' as const, learn: FOUNDATION_V7_COURSE, caps: ADMIN_PATH_CAPABILITIES, offset: 0 },
      { course: 'adventure_a2' as const, learn: ADVENTURE_A2_COURSE, caps: ADMIN_A2_PATH_CAPABILITIES, offset: A2_ORDER_OFFSET },
    ];
    for (const { course, learn, caps, offset } of courses) {
    let global = offset;
    for (const chapter of toFoundationV7ClientChapters(caps, learn)) {
      chapter.items.forEach((item, index) => {
        const ref = item as { lessonId?: string; simulationId?: string };
        adminPathNodes!.push({
          course,
          comingSoon: item.comingSoon === true,
          id: item.id,
          type: item.nodeType ?? item.type,
          code: item.code,
          titleEn: item.titleEn,
          globalOrder: ++global,
          order: index + 1,
          ...(ref.lessonId ? { lessonId: ref.lessonId } : {}),
          ...(ref.simulationId ? { simulationId: ref.simulationId } : {}),
          chapterNumber: chapter.number,
          chapterTitleEn: chapter.titleEn,
        });
      });
    }
    }
  }
  return adminPathNodes;
}

let comingSoonGameIds: Set<string> | null = null;

/** Stage ids of map nodes that are "coming soon" (0 plays is expected). */
function isComingSoonStage(gameId: string): boolean {
  if (!comingSoonGameIds) {
    comingSoonGameIds = new Set(
      foundationV7AdminPathNodes()
        .filter((n) => n.comingSoon)
        .map((n) => canonicalFoundationV7RewardId(n.id) ?? n.id),
    );
  }
  return comingSoonGameIds.has(gameId);
}

export type FoundationV7PathPosition = {
  order: number;
  /** 1-based position on the chapter map. Skip Quiz is not a map node. */
  nodeOrder: number | null;
  code: string;
  chapterNumber: number;
  chapterTitleEn: string;
  /** Map node id as in the app (`v7_u01n03`), when this is a path node. */
  nodeId: string | null;
};

let v7PositionByRewardId: Map<string, FoundationV7PathPosition> | null = null;

/**
 * Where a stage score's game sits on the V7 path (node globalOrder / code).
 * A chapter's Skip Quiz sorts just before that chapter's first node.
 */
export function foundationV7PathPosition(
  gameId: string,
): FoundationV7PathPosition | null {
  if (!v7PositionByRewardId) {
    v7PositionByRewardId = new Map();
    const firstByChapter = new Map<string, number>();
    for (const node of foundationV7AdminPathNodes()) {
      const gameId = canonicalFoundationV7RewardId(node.id) ?? node.id;
      const chapterKey = `${node.course}:${node.chapterNumber}`;
      if (!firstByChapter.has(chapterKey)) {
        firstByChapter.set(chapterKey, node.globalOrder);
      }
      if (!v7PositionByRewardId.has(gameId)) {
        v7PositionByRewardId.set(gameId, {
          order: node.globalOrder,
          nodeOrder: node.order,
          code: node.code,
          chapterNumber: node.chapterNumber,
          chapterTitleEn: node.chapterTitleEn,
          nodeId: node.id,
        });
      }
      // Sessions / ratings often key off the raw map node id.
      if (gameId !== node.id && !v7PositionByRewardId.has(node.id)) {
        v7PositionByRewardId.set(node.id, {
          order: node.globalOrder,
          nodeOrder: node.order,
          code: node.code,
          chapterNumber: node.chapterNumber,
          chapterTitleEn: node.chapterTitleEn,
          nodeId: node.id,
        });
      }
    }
    const courses: [AdminPathCourse, typeof FOUNDATION_V7_CATALOG][] = [
      ['foundation', FOUNDATION_V7_CATALOG],
      ['adventure_a2', ADVENTURE_A2_COURSE.catalog],
    ];
    for (const [course, catalog] of courses) {
      for (const chapter of catalog.chapters) {
        const first = firstByChapter.get(`${course}:${chapter.number}`) ?? NaN;
        if (Number.isFinite(first)) {
          v7PositionByRewardId.set(`skip_quiz:${chapter.id}`, {
            order: first - 0.5,
            nodeOrder: null,
            code: `${chapter.number}.0`,
            chapterNumber: chapter.number,
            chapterTitleEn: chapter.titleEn,
            nodeId: null,
          });
        }
      }
    }
  }
  const trimmed = gameId.trim();
  return (
    v7PositionByRewardId.get(trimmed) ??
    v7PositionByRewardId.get(canonicalFoundationV7RewardId(trimmed) ?? '') ??
    null
  );
}

export type FoundationV7Stage = {
  gameId: string;
  /** App map node id (`v7_u01n03`); same as gameId for lessons/conversations. */
  nodeId: string;
  kind: string;
  order: number;
  nodeOrder: number | null;
  code: string;
  titleEn: string;
};

let v7StageByLessonId: Map<string, string> | null = null;
let v7StageBySimulationId: Map<string, string> | null = null;

/**
 * V7 map node for a completed lesson / conversation session — those stages
 * log `userSession` rows, not `miniGameScoreAttempt`.
 */
export function foundationV7StageIdForSession(session: {
  lessonId: string | null;
  simulationId: string | null;
}): string | null {
  if (!v7StageByLessonId || !v7StageBySimulationId) {
    v7StageByLessonId = new Map();
    v7StageBySimulationId = new Map();
    for (const node of foundationV7AdminPathNodes()) {
      // Pronunciation nodes are lesson sessions too (`pron_*` lesson ids).
      if (
        (node.type === 'lesson' || node.type === 'pronunciation') &&
        node.lessonId &&
        !v7StageByLessonId.has(node.lessonId)
      ) {
        v7StageByLessonId.set(node.lessonId, node.id);
      }
      if (
        node.type === 'conversation' &&
        node.simulationId &&
        !v7StageBySimulationId.has(node.simulationId)
      ) {
        v7StageBySimulationId.set(node.simulationId, node.id);
      }
    }
  }
  if (session.simulationId) {
    return v7StageBySimulationId.get(session.simulationId.trim()) ?? null;
  }
  if (session.lessonId) {
    const id = session.lessonId.trim();
    return (
      v7StageByLessonId.get(id) ??
      v7StageByLessonId.get(canonicalFoundationV7LessonId(id)) ??
      null
    );
  }
  return null;
}

/**
 * Map a LessonRating.lessonId (catalog lesson, simulation, or reward id)
 * onto the Stage scores `gameId`. Hub minigame ratings (`game_*`) stay unmapped.
 */
export function foundationV7StageIdForRating(lessonId: string): string | null {
  const trimmed = lessonId.trim();
  if (!trimmed || trimmed.startsWith('game_')) return null;
  const canonical = canonicalFoundationV7RewardId(trimmed);
  if (canonical) return canonical;
  const fromSession =
    foundationV7StageIdForSession({
      lessonId: trimmed,
      simulationId: null,
    }) ??
    foundationV7StageIdForSession({
      lessonId: null,
      simulationId: trimmed,
    });
  if (fromSession) {
    return canonicalFoundationV7RewardId(fromSession) ?? fromSession;
  }
  if (foundationV7PathPosition(trimmed)) return trimmed;
  return null;
}

/** Every map node the app shows, plus chapter Skip Quizzes from Ch2, in path order. */
export function foundationV7StageCatalog(): FoundationV7Stage[] {
  const stages: FoundationV7Stage[] = [];
  const seen = new Set<string>();
  for (const node of foundationV7AdminPathNodes()) {
    const canonical = canonicalFoundationV7RewardId(node.id);
    const gameId = canonical ?? node.id;
    if (seen.has(gameId)) continue;
    seen.add(gameId);
    stages.push({
      gameId,
      nodeId: node.id,
      kind: canonical ? canonical.slice(0, canonical.indexOf(':')) : node.type,
      order: node.globalOrder,
      nodeOrder: node.order,
      code: node.code,
      titleEn: node.titleEn,
    });
  }
  for (const chapter of [
    ...FOUNDATION_V7_CATALOG.chapters,
    ...ADVENTURE_A2_COURSE.catalog.chapters,
  ]) {
    if (chapter.number < 2) continue;
    const gameId = `skip_quiz:${chapter.id}`;
    const position = foundationV7PathPosition(gameId);
    if (!position) continue;
    stages.push({
      gameId,
      nodeId: gameId,
      kind: 'skip_quiz',
      order: position.order,
      nodeOrder: null,
      code: position.code,
      titleEn: contentItemTitle(gameId),
    });
  }
  return stages.sort((a, b) => a.order - b.order);
}
