import { Controller, Get } from '@nestjs/common';
import { TopicsService } from './topics.service';

@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get('daily')
  getDailyTopics() {
    return this.topicsService.getDailyTopics();
  }
}
