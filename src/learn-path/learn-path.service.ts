import { Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LessonsService } from '../lessons/lessons.service';
import {
  FOUNDATION_V2_CHAPTERS,
  FOUNDATION_V2_PATH_ID,
  FOUNDATION_V2_VERSION,
  flattenFoundationV2Nodes,
  foundationV2CoreTotal,
  type FoundationV2NodeDef,
} from './foundation-v2-path.data';

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

@Injectable()
export class LearnPathService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
  ) {}

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
        if (completedSimulationIds.has(node.simulationId)) {
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
      ].filter((v): v is string => !!v);

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
    }
    return ids;
  }

  /** First incomplete core node whose unlock prerequisites are satisfied. */
  private resolveCurrentNodeId(
    nodes: FoundationV2NodeDef[],
    completed: Set<string>,
  ): string | null {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const node of nodes) {
      if (!node.countsTowardProgress) continue;
      if (completed.has(node.id)) continue;
      if (node.comingSoon) continue;
      const unlocked = node.unlockAfterNodeIds.every((id) => {
        const prereq = byId.get(id);
        // Optional nodes never gate the core spine.
        if (prereq && prereq.countsTowardProgress === false) return true;
        // Coming-soon core nodes still block — do not skip unfinished content.
        return completed.has(id);
      });
      if (unlocked) return node.id;
    }
    return null;
  }
}
