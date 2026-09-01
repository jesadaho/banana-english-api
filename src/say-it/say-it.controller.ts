import { BadRequestException, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { SAY_IT_BANANA_COST, SAY_IT_DEAL_COUNT } from './say-it.data';
import { SayItService } from './say-it.service';

type AuthedRequest = { user: User };

@Controller('say-it')
@UseGuards(AnonymousUserGuard)
export class SayItController {
  constructor(
    private readonly sayIt: SayItService,
    private readonly economy: EconomyService,
  ) {}

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

  @Post('topics/:topicId/start')
  async startTopic(@Req() req: AuthedRequest, @Param('topicId') topicId: string) {
    const topic = this.sayIt.getTopic(topicId);
    if (topic.locked) {
      throw new BadRequestException('This topic is locked');
    }
    await this.economy.spendBananas(
      req.user.id,
      SAY_IT_BANANA_COST,
      topicId,
      'say_it_start',
    );
    return { ok: true, bananaCost: SAY_IT_BANANA_COST, dealCount: SAY_IT_DEAL_COUNT };
  }
}
