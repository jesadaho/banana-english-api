import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { SAY_IT_DEAL_COUNT } from './say-it.data';
import { SayItService } from './say-it.service';

@Controller('say-it')
@UseGuards(AnonymousUserGuard)
export class SayItController {
  constructor(private readonly sayIt: SayItService) {}

  @Get('topics')
  listTopics() {
    return { topics: this.sayIt.listTopics() };
  }

  @Get('topics/:topicId/deal')
  dealForTopic(
    @Param('topicId') topicId: string,
    @Query('count') count?: string,
  ) {
    const parsed = count ? Number.parseInt(count, 10) : SAY_IT_DEAL_COUNT;
    const dealCount =
      Number.isFinite(parsed) && parsed > 0 ? parsed : SAY_IT_DEAL_COUNT;
    return this.sayIt.dealForTopic(topicId, dealCount);
  }
}
