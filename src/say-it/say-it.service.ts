import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealSayItPhrases,
  SAY_IT_DEAL_COUNT,
  SAY_IT_TOPICS,
  sayItTopicById,
  type SayItPhrase,
  type SayItTopic,
} from './say-it.data';

@Injectable()
export class SayItService {
  listTopics(): SayItTopic[] {
    return SAY_IT_TOPICS;
  }

  getTopic(topicId: string): SayItTopic {
    const topic = sayItTopicById(topicId);
    if (!topic) {
      throw new NotFoundException(`Say It topic not found: ${topicId}`);
    }
    return topic;
  }

  dealForTopic(topicId: string, count = SAY_IT_DEAL_COUNT): {
    topicId: string;
    dealCount: number;
    phrases: SayItPhrase[];
  } {
    this.getTopic(topicId);
    const phrases = dealSayItPhrases(topicId, count);
    return {
      topicId,
      dealCount: phrases.length,
      phrases,
    };
  }
}
