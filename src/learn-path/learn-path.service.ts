import { Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LessonsService } from '../lessons/lessons.service';
import { FOUNDATION_V7_CATALOG, FOUNDATION_V7_PATH_ID, foundationV7NodeTypeCounts, type FoundationV7Capability } from './foundation-v7-path.data';
import { toFoundationV7ClientChapters } from './foundation-v7-path.view';
import { canonicalFoundationV7RewardId } from './foundation-v7-path.data';
import {
  FOUNDATION_V2_CHAPTERS,
  FOUNDATION_V2_PATH_ID,
  FOUNDATION_V2_VERSION,
  flattenFoundationV2Nodes,
  foundationV2CoreTotal,
  type FoundationV2NodeDef,
} from './foundation-v2-path.data';
import {
  FOUNDATION_V5_CATALOG,
  FOUNDATION_V5_PATH_ID,
  FOUNDATION_V5_VERSION,
  flattenFoundationV5Nodes,
  foundationV5NodeTypeCounts,
  type FoundationV5NodeType,
} from './foundation-v5-path.data';
import {
  FOUNDATION_V6_CATALOG,
  FOUNDATION_V6_CONTENT_REFS,
  FOUNDATION_V6_PATH_ID,
  FOUNDATION_V6_VERSION,
  flattenFoundationV6Nodes,
  foundationV6NodeTypeCounts,
  type FoundationV6NodeDef,
  type FoundationV6NodeType,
} from './foundation-v6-path.data';

export type FoundationV2PathView = {
  pathId: string;
  version: number;
  chapters: typeof FOUNDATION_V2_CHAPTERS;
  progress: {
    completedNodeIds: string[];
    currentNodeId: string | null;
    completedCount: number;
    totalCount: number;
  };
};

export type FoundationClientNodeType =
  | FoundationV2NodeDef['type']
  | 'story_bites'
  | 'pronunciation'
  | 'new_words';

export type FoundationV5ClientNode = {
  id: string;
  code: string;
  titleEn: string;
  titleTh: string;
  type: FoundationClientNodeType;
  nodeType?: string;
  countsTowardProgress: boolean;
  comingSoon: boolean;
  estimatedMinutes: number;
  unlockAfterNodeIds: string[];
  topicId?: string;
  poolId?: string;
  simulationId?: string;
  lessonId?: string;
  legacyLessonIds?: string[];
  legacySimulationIds?: string[];
};

export type FoundationV5ClientChapter = {
  id: string;
  number: number;
  emoji: string;
  titleEn: string;
  titleTh: string;
  items: FoundationV5ClientNode[];
};

export type FoundationV5CatalogView = {
  pathId: string;
  version: number;
  sourceVersion: string;
  releaseStatus: 'preview';
  chapters: FoundationV5ClientChapter[];
  progress: FoundationV2PathView['progress'];
  summary: {
    chapterCount: number;
    nodeCount: number;
    nodeTypeCounts: ReturnType<typeof foundationV5NodeTypeCounts>;
    comingSoonNodeIds: string[];
  };
};

export type FoundationV6ClientNode = FoundationV5ClientNode & {
  nodeType: FoundationV6NodeType;
  learningTarget: string;
  activity: string;
  pronunciation?: FoundationV6NodeDef['pronunciation'];
  sayItMode?: FoundationV6NodeDef['sayItMode'];
};

export type FoundationV6CatalogView = {
  pathId: string;
  version: number;
  sourceVersion: string;
  releaseStatus: 'playtest';
  chapters: Array<Omit<FoundationV5ClientChapter, 'items'> & { items: FoundationV6ClientNode[] }>;
  progress: FoundationV2PathView['progress'];
  summary: {
    chapterCount: number;
    nodeCount: number;
    nodeTypeCounts: ReturnType<typeof foundationV6NodeTypeCounts>;
    comingSoonNodeIds: string[];
  };
};

const V5_PHASE_EMOJI: Record<string, string> = {
  Ki: '🌱',
  Sho: '🌿',
  Ten: '🔥',
  Ketsu: '⭐',
};

function mapV5NodeType(type: FoundationV5NodeType): FoundationClientNodeType {
  switch (type) {
    case 'say_it':
      return 'say_it';
    case 'emoji_speak':
      return 'emoji_speak';
    case 'describe_it':
      return 'describe_it';
    case 'conversation':
      return 'mission';
    case 'skill_check':
    case 'story_bites':
    case 'sentence_builder':
      return 'review';
    case 'pronunciation':
      return 'pronunciation';
    case 'lesson':
    default:
      return 'lesson';
  }
}

function mapV6NodeType(type: FoundationV6NodeType): FoundationClientNodeType {
  return mapV5NodeType(type as FoundationV5NodeType);
}

function isLessonLikeType(type: FoundationClientNodeType): boolean {
  return type === 'lesson' || type === 'pronunciation';
}

function shippedContentForMappedType(
  titleEn: string,
  type: FoundationClientNodeType,
): FoundationV2NodeDef | undefined {
  if (type === 'story_bites' || type === 'new_words') return undefined;
  return v2ContentForV5Title(
    titleEn,
    type === 'pronunciation' ? 'lesson' : type,
  );
}

const V5_TITLE_ALIASES: Record<string, string> = {
  'first conversation': 'introduce yourself',
  'meet max': 'first conversation',
  'i am / you are': 'i am / you are',
  "i'm / you're": 'i am / you are',
  'he / she / it / we / they': 'we / they',
  'family': 'family',
  'color and size': 'basic colors',
  'numbers 11–20 and age': 'numbers 11–20',
  'numbers 11-20 and age': 'numbers 11–20',
  'money and prices': 'money & prices',
  'likes and dislikes': 'likes & dislikes',
  'want, need, have': 'wants / needs / have',
  'action verbs': 'daily actions',
  'my day': 'daily actions',
  'do / does questions': 'asking questions',
  'i need help': 'use survival english',
  'meet my family': 'talk about family',
  'buy one thing': 'buy something',
  'talk about yourself': 'three things about me',
  'three lines about me': 'about me',
  'people & family': 'people, feelings & family',
  'people and family': 'people, feelings & family',
  'these, those & details': 'these and those',
  'age and spelling': 'numbers 11–20',
  'time and prices': 'money & prices',
  'likes and questions': 'likes & dislikes',
  'he / she and do / does': 'asking questions',
  'be + ing and questions': 'is she...? what are they doing?',
  'what are they doing?': 'is she...? what are they doing?',
  'where, when and how': 'where or when',
  'ask me': 'ask the right question',
};

function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function v2ContentForV5Title(
  titleEn: string,
  type: FoundationV2NodeDef['type'],
): FoundationV2NodeDef | undefined {
  const nodes = flattenFoundationV2Nodes();
  const wanted = normalizeTitle(V5_TITLE_ALIASES[normalizeTitle(titleEn)] ?? titleEn);
  const typed = nodes.find(
    (node) => node.type === type && normalizeTitle(node.titleEn) === wanted,
  );
  if (typed) return typed;
  return nodes.find((node) => normalizeTitle(node.titleEn) === wanted);
}

function toFoundationV5ClientChapters(): FoundationV5ClientChapter[] {
  return FOUNDATION_V5_CATALOG.chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.number,
    emoji: V5_PHASE_EMOJI[chapter.phase] ?? '🍌',
    titleEn: chapter.titleEn,
    titleTh: chapter.titleEn,
    items: chapter.items.map((node) => {
      const type = mapV5NodeType(node.type);
      const shipped = shippedContentForMappedType(node.titleEn, type);
      const lessonId = isLessonLikeType(type) ? shipped?.id : undefined;
      const hasContent = Boolean(
        (isLessonLikeType(type) && lessonId) ||
          shipped?.topicId ||
          shipped?.poolId ||
          shipped?.simulationId,
      );
      return {
        id: node.id,
        code: node.code,
        titleEn: node.titleEn,
        titleTh: node.titleEn,
        type,
        nodeType: node.type,
        countsTowardProgress: true,
        comingSoon: node.comingSoon || !hasContent,
        estimatedMinutes: node.estimatedMinutes,
        unlockAfterNodeIds: node.prerequisiteNodeIds,
        topicId: shipped?.topicId,
        poolId: shipped?.poolId,
        simulationId: shipped?.simulationId,
        lessonId,
      };
    }),
  }));
}

export function toFoundationV6ClientChapters(): FoundationV6CatalogView['chapters'] {
  return FOUNDATION_V6_CATALOG.chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.number,
    emoji: V5_PHASE_EMOJI[chapter.phase] ?? '🍌',
    titleEn: chapter.titleEn,
    titleTh: chapter.titleEn,
    items: chapter.items.map((node) => {
      const type = mapV6NodeType(node.type);
      const shipped = shippedContentForMappedType(node.titleEn, type);
      const contentRef = FOUNDATION_V6_CONTENT_REFS[node.id];
      const lessonId = isLessonLikeType(type)
        ? (contentRef?.lessonId ?? shipped?.id)
        : undefined;
      const hasContent = Boolean(
        (isLessonLikeType(type) && lessonId) ||
          contentRef?.topicId ||
          contentRef?.poolId ||
          shipped?.topicId ||
          shipped?.poolId ||
          shipped?.simulationId,
      );
      return {
        id: node.id,
        code: node.code,
        titleEn: node.titleEn,
        titleTh: node.titleEn,
        type,
        nodeType: node.type,
        countsTowardProgress: true,
        comingSoon: node.comingSoon || !hasContent,
        estimatedMinutes: node.estimatedMinutes,
        unlockAfterNodeIds: node.prerequisiteNodeIds,
        topicId: contentRef?.topicId ?? shipped?.topicId,
        poolId: contentRef?.poolId ?? shipped?.poolId,
        simulationId: shipped?.simulationId,
        lessonId,
        learningTarget: node.learningTarget,
        activity: node.activity,
        pronunciation: node.pronunciation,
        sayItMode: node.sayItMode,
      };
    }),
  }));
}

@Injectable()
export class LearnPathService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
  ) {}

  async getFoundationV7(userId: string, capabilities: readonly FoundationV7Capability[] = []) {
    const chapters = toFoundationV7ClientChapters(capabilities);
    const nodes = chapters.flatMap(chapter => chapter.items);
    const playable = nodes.filter(node => !node.comingSoon);
    const completed = await this.resolveCompletedV5NodeIds(userId, playable);
    return {
      pathId: FOUNDATION_V7_PATH_ID, version: FOUNDATION_V7_CATALOG.metadata.version,
      sourceVersion: FOUNDATION_V7_CATALOG.metadata.sourceVersion, releaseStatus: 'playtest' as const,
      chapters,
      progress: {
        completedNodeIds: [...completed], currentNodeId: this.resolveCurrentNodeId(nodes, completed),
        completedCount: completed.size, totalCount: playable.length,
      },
      summary: {
        chapterCount: chapters.length, nodeCount: nodes.length, nodeTypeCounts: foundationV7NodeTypeCounts(),
        backendReadyCount: nodes.filter(node => node.backendReady).length,
        playableCount: playable.length, comingSoonNodeIds: nodes.filter(node => node.comingSoon).map(node => node.id),
      },
    };
  }

  async getFoundationV5(userId: string): Promise<FoundationV5CatalogView> {
    const sourceNodes = flattenFoundationV5Nodes();
    const chapters = toFoundationV5ClientChapters();
    const nodes = chapters.flatMap((chapter) => chapter.items);
    const completed = await this.resolveCompletedV5NodeIds(userId, nodes);
    const completedCore = [...completed];
    const currentNodeId = this.resolveCurrentNodeId(nodes, completed);

    return {
      pathId: FOUNDATION_V5_PATH_ID,
      version: FOUNDATION_V5_VERSION,
      sourceVersion: FOUNDATION_V5_CATALOG.metadata.sourceVersion,
      releaseStatus: 'preview',
      chapters,
      progress: {
        completedNodeIds: completedCore,
        currentNodeId,
        completedCount: completedCore.length,
        totalCount: nodes.filter((node) => !node.comingSoon).length,
      },
      summary: {
        chapterCount: FOUNDATION_V5_CATALOG.chapters.length,
        nodeCount: sourceNodes.length,
        nodeTypeCounts: foundationV5NodeTypeCounts(),
        comingSoonNodeIds: sourceNodes
          .filter((node) => node.comingSoon)
          .map((node) => node.id),
      },
    };
  }

  async getFoundationV6(userId: string): Promise<FoundationV6CatalogView> {
    const sourceNodes = flattenFoundationV6Nodes();
    const chapters = toFoundationV6ClientChapters();
    const nodes = chapters.flatMap((chapter) => chapter.items);
    const completed = await this.resolveCompletedV5NodeIds(userId, nodes);
    const currentNodeId = this.resolveCurrentNodeId(nodes, completed);

    return {
      pathId: FOUNDATION_V6_PATH_ID,
      version: FOUNDATION_V6_VERSION,
      sourceVersion: FOUNDATION_V6_CATALOG.metadata.sourceVersion,
      releaseStatus: 'playtest',
      chapters,
      progress: {
        completedNodeIds: [...completed],
        currentNodeId,
        completedCount: completed.size,
        totalCount: nodes.filter((node) => !node.comingSoon).length,
      },
      summary: {
        chapterCount: chapters.length,
        nodeCount: sourceNodes.length,
        nodeTypeCounts: foundationV6NodeTypeCounts(),
        comingSoonNodeIds: nodes
          .filter((node) => node.comingSoon)
          .map((node) => node.id),
      },
    };
  }

  async getFoundationV2(userId: string): Promise<FoundationV2PathView> {
    const nodes = flattenFoundationV2Nodes();
    const completed = await this.resolveCompletedNodeIds(userId, nodes);
    const coreIds = new Set(
      nodes.filter((n) => n.countsTowardProgress).map((n) => n.id),
    );
    const completedCore = [...completed].filter((id) => coreIds.has(id));
    const currentNodeId = this.resolveCurrentNodeId(nodes, completed);

    return {
      pathId: FOUNDATION_V2_PATH_ID,
      version: FOUNDATION_V2_VERSION,
      chapters: FOUNDATION_V2_CHAPTERS,
      progress: {
        completedNodeIds: [...completed],
        currentNodeId,
        completedCount: completedCore.length,
        totalCount: foundationV2CoreTotal(),
      },
    };
  }

  private async resolveCompletedNodeIds(
    userId: string,
    nodes: FoundationV2NodeDef[],
  ): Promise<Set<string>> {
    const completedLessonIds = await this.lessons.getCompletedLessonIds(userId);

    const completedSimulationIds = await this.getCompletedSimulationIds(userId);
    const completedMiniGameIds = await this.getCompletedMiniGameIds(userId);

    const completed = new Set<string>();

    for (const node of nodes) {
      if (node.type === 'lesson') {
        if (completedLessonIds.has(node.id)) completed.add(node.id);
        continue;
      }

      if (node.type === 'mission' && node.simulationId) {
        const simulationIds = [
          node.simulationId,
          ...(node.legacySimulationIds ?? []),
        ];
        if (simulationIds.some((id) => completedSimulationIds.has(id))) {
          completed.add(node.id);
        }
        continue;
      }

      // say_it / emoji_speak / number_challenge / review / describe_it
      // complete via POST /mini-games/:gameId/complete (gameId = node.id)
      // also accept topic/pool/review ids for convenience
      const candidates = [
        node.id,
        node.topicId,
        node.poolId,
        node.reviewId,
        node.topicId ? `say_it:${node.topicId}` : null,
        node.poolId ? `emoji_speak:${node.poolId}` : null,
        node.poolId ? `new_words:${node.poolId}` : null,
      ].filter((v): v is string => !!v);

      if (candidates.some((id) => completedMiniGameIds.has(id))) {
        completed.add(node.id);
      }
    }

    return completed;
  }

  private async resolveCompletedV5NodeIds(
    userId: string,
    nodes: FoundationV5ClientNode[],
  ): Promise<Set<string>> {
    const [completedLessonIds, completedMiniGameIds, completedSimulationIds] =
      await Promise.all([
        this.lessons.getCompletedLessonIds(userId),
        this.getCompletedMiniGameIds(userId),
        this.getCompletedSimulationIds(userId),
      ]);

    const completed = new Set<string>();
    for (const node of nodes) {
      if (isLessonLikeType(node.type)) {
        if (
          completedLessonIds.has(node.id) ||
          (node.lessonId && completedLessonIds.has(node.lessonId)) ||
          (node.legacyLessonIds ?? []).some((id) => completedLessonIds.has(id))
        ) {
          completed.add(node.id);
        }
        continue;
      }
      if (node.simulationId) {
        const simulationIds = [
          node.simulationId,
          ...(node.legacySimulationIds ?? []),
        ];
        if (simulationIds.some((id) => completedSimulationIds.has(id))) {
          completed.add(node.id);
        }
        continue;
      }
      const candidates = [
        node.id,
        node.topicId,
        node.poolId,
        node.topicId ? `say_it:${node.topicId}` : null,
        node.poolId ? `emoji_speak:${node.poolId}` : null,
        node.poolId ? `new_words:${node.poolId}` : null,
      ].filter((value): value is string => !!value);
      if (candidates.some((id) => completedMiniGameIds.has(id))) {
        completed.add(node.id);
      }
    }
    return completed;
  }

  private async getCompletedSimulationIds(
    userId: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.userSession.findMany({
      where: {
        userId,
        sessionType: 'simulation',
        simulationId: { not: null },
        rewardsApplied: true,
      },
      select: { simulationId: true },
      distinct: ['simulationId'],
    });

    return new Set(
      rows
        .map((r) => r.simulationId)
        .filter((id): id is string => id != null),
    );
  }

  private async getCompletedMiniGameIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.economyTransaction.findMany({
      where: {
        userId,
        source: 'mini_game_reward',
        currency: Currency.XP,
        referenceId: { startsWith: 'mini_game:' },
      },
      select: { referenceId: true },
    });

    const ids = new Set<string>();
    for (const row of rows) {
      const ref = row.referenceId;
      if (!ref?.startsWith('mini_game:')) continue;
      ids.add(ref.slice('mini_game:'.length));
      const canonical = canonicalFoundationV7RewardId(ref.slice('mini_game:'.length));
      if (canonical) ids.add(canonical);
    }
    return ids;
  }

  private isPrerequisiteSatisfied(
    id: string,
    byId: Map<
      string,
      { id: string; countsTowardProgress: boolean; comingSoon?: boolean; unlockAfterNodeIds: string[] }
    >,
    completed: Set<string>,
  ): boolean {
    if (completed.has(id)) return true;
    const prereq = byId.get(id);
    if (!prereq) return false;
    if (prereq.countsTowardProgress === false) return true;
    if (prereq.comingSoon) {
      return prereq.unlockAfterNodeIds.every((pid) =>
        this.isPrerequisiteSatisfied(pid, byId, completed),
      );
    }
    return false;
  }

  /** First incomplete core node whose unlock prerequisites are satisfied. */
  private resolveCurrentNodeId(
    nodes: Array<{
      id: string;
      countsTowardProgress: boolean;
      comingSoon?: boolean;
      unlockAfterNodeIds: string[];
    }>,
    completed: Set<string>,
  ): string | null {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const node of nodes) {
      if (!node.countsTowardProgress) continue;
      if (completed.has(node.id)) continue;
      if (node.comingSoon) continue;
      const unlocked = node.unlockAfterNodeIds.every((id) =>
        this.isPrerequisiteSatisfied(id, byId, completed),
      );
      if (unlocked) return node.id;
    }
    return null;
  }
}
