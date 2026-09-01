import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealExplainItItems,
  EXPLAIN_IT_DEAL_COUNT,
  EXPLAIN_IT_TOPICS,
  explainItTopicById,
  type ExplainItItem,
  type ExplainItTopic,
} from './explain-it.data';

@Injectable()
export class ExplainItService {
  listTopics(): ExplainItTopic[] {
    return EXPLAIN_IT_TOPICS;
  }

  getTopic(topicId: string): ExplainItTopic {
    const topic = explainItTopicById(topicId);
    if (!topic) {
      throw new NotFoundException(`Explain It topic not found: ${topicId}`);
    }
    return topic;
  }

  dealForTopic(topicId: string, count = EXPLAIN_IT_DEAL_COUNT): {
    topicId: string;
    dealCount: number;
    items: ExplainItItem[];
  } {
    this.getTopic(topicId);
    const items = dealExplainItItems(topicId, count);
    return {
      topicId,
      dealCount: items.length,
      items,
    };
  }
}
