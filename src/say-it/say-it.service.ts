import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealSayItPhrases,
  isFoundationPathSayItTopic,
  SAY_IT_DEAL_COUNT,
  SAY_IT_TOPICS,
  sayItTopicById,
  type SayItPhrase,
  type SayItTopic,
} from './say-it.data';

@Injectable()
export class SayItService {
  listTopics(): SayItTopic[] {
    // Foundation path topics are opened from Basics, not the Games hub.
    return SAY_IT_TOPICS.filter((t) => !isFoundationPathSayItTopic(t.id));
  }

  getTopic(topicId: string): SayItTopic {
    const topic = sayItTopicById(topicId);
    if (!topic) {
      throw new NotFoundException(`Say It topic not found: ${topicId}`);
    }
    return topic;
  }

  dealForTopic(topicId: string, count = SAY_IT_DEAL_COUNT, displayName?: string | null): {
    topicId: string;
    dealCount: number;
    phrases: SayItPhrase[];
  } {
    this.getTopic(topicId);
    const phrases = dealSayItPhrases(topicId, count, displayName);
    return {
      topicId,
      dealCount: phrases.length,
      phrases,
    };
  }
}
