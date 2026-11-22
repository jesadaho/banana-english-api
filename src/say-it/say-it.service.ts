import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealSayItPhrases,
  foundationSayItDealCount,
  isFoundationPathSayItTopic,
  SAY_IT_DEAL_COUNT,
  SAY_IT_TOPICS,
  sayItTopicById,
  type SayItPhrase,
  type SayItTopic,
} from './say-it.data';
import { hintPolicyFor, itemHint, type ItemHint } from '../hints/hint-policy';

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
    phrases: (SayItPhrase & { hint: ItemHint })[];
  } {
    this.getTopic(topicId);
    const effectiveCount = isFoundationPathSayItTopic(topicId)
      ? foundationSayItDealCount(topicId)
      : count;
    // Hints are decided here (see hints/hint-policy.ts); the app follows them.
    const policy = hintPolicyFor('say_it', topicId);
    const phrases = dealSayItPhrases(topicId, effectiveCount, displayName).map(
      (phrase, index) => ({ ...phrase, hint: itemHint(policy, null, index) }),
    );
    return {
      topicId,
      dealCount: phrases.length,
      phrases,
    };
  }
}
