import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealInOnAt,
  IN_ON_AT_DEAL_COUNT,
  IN_ON_AT_TOPICS,
  inOnAtTopicById,
  type InOnAtItem,
  type InOnAtTopic,
} from './in-on-at.data';

@Injectable()
export class InOnAtService {
  listTopics(): InOnAtTopic[] {
    return IN_ON_AT_TOPICS;
  }

  getTopic(topicId: string): InOnAtTopic {
    const topic = inOnAtTopicById(topicId);
    if (!topic) {
      throw new NotFoundException(`in-on-at topic not found: ${topicId}`);
    }
    return topic;
  }

  dealForTopic(
    topicId: string,
    count = IN_ON_AT_DEAL_COUNT,
  ): { topicId: string; dealCount: number; items: InOnAtItem[] } {
    this.getTopic(topicId);
    const safeCount = Math.min(Math.max(count, 3), 30);
    const items = dealInOnAt(topicId, safeCount);
    return { topicId, dealCount: items.length, items };
  }
}
