import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  dealExplainItChallenge,
  dealExplainItItems,
  EXPLAIN_IT_BANANA_COST,
  EXPLAIN_IT_CHALLENGE_DEAL_COUNT,
  EXPLAIN_IT_CHALLENGE_ID,
  EXPLAIN_IT_DEAL_COUNT,
  EXPLAIN_IT_TOPICS,
  explainItTopicById,
  explainItUnlockReference,
  isExplainItChallenge,
  type ExplainItItem,
  type ExplainItTopic,
} from './explain-it.data';

@Injectable()
export class ExplainItService {
  constructor(private readonly prisma: PrismaService) {}

  listTopics(): ExplainItTopic[] {
    return EXPLAIN_IT_TOPICS;
  }

  async listTopicsForUser(userId: string): Promise<ExplainItTopic[]> {
    const unlocked = await this.unlockedTopicIds(userId);
    return EXPLAIN_IT_TOPICS.map((topic) => {
      const isUnlocked = unlocked.has(topic.id);
      return {
        ...topic,
        unlocked: isUnlocked,
        bananaCost: isUnlocked ? 0 : EXPLAIN_IT_BANANA_COST,
      };
    });
  }

  getTopic(topicId: string): ExplainItTopic {
    const topic = explainItTopicById(topicId);
    if (!topic) {
      throw new NotFoundException(`Explain It topic not found: ${topicId}`);
    }
    return topic;
  }

  async isTopicUnlocked(userId: string, topicId: string): Promise<boolean> {
    if (isExplainItChallenge(topicId)) return false;
    const prior = await this.prisma.economyTransaction.findFirst({
      where: {
        userId,
        source: 'explain_it_start',
        referenceId: explainItUnlockReference(topicId),
      },
      select: { id: true },
    });
    return Boolean(prior);
  }

  async unlockedTopicIds(userId: string): Promise<Set<string>> {
    const refs = EXPLAIN_IT_TOPICS.map((t) => explainItUnlockReference(t.id));
    if (refs.length === 0) return new Set();
    const rows = await this.prisma.economyTransaction.findMany({
      where: {
        userId,
        source: 'explain_it_start',
        referenceId: { in: refs },
      },
      select: { referenceId: true },
    });
    const unlocked = new Set<string>();
    for (const row of rows) {
      const ref = row.referenceId ?? '';
      if (ref.startsWith('explain_it_unlock:')) {
        unlocked.add(ref.slice('explain_it_unlock:'.length));
      }
    }
    return unlocked;
  }

  dealForTopic(
    topicId: string,
    count = EXPLAIN_IT_DEAL_COUNT,
  ): {
    topicId: string;
    dealCount: number;
    items: ExplainItItem[];
  } {
    this.getTopic(topicId);
    const items = isExplainItChallenge(topicId)
      ? dealExplainItChallenge()
      : dealExplainItItems(topicId, count);
    return {
      topicId: isExplainItChallenge(topicId)
        ? EXPLAIN_IT_CHALLENGE_ID
        : topicId,
      dealCount: items.length,
      items,
    };
  }

  challengeDealCount(): number {
    return EXPLAIN_IT_CHALLENGE_DEAL_COUNT;
  }

  practiceDealCount(): number {
    return EXPLAIN_IT_DEAL_COUNT;
  }
}
