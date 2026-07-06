import { Injectable } from '@nestjs/common';
import { TOPICS } from './topics.data';

@Injectable()
export class TopicsService {
  getDailyTopics() {
    return TOPICS;
  }
}
