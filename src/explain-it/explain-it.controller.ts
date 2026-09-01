import { BadRequestException, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import {
  EXPLAIN_IT_BANANA_COST,
  EXPLAIN_IT_DEAL_COUNT,
} from './explain-it.data';
import { ExplainItService } from './explain-it.service';

type AuthedRequest = { user: User };

@Controller('explain-it')
@UseGuards(AnonymousUserGuard)
export class ExplainItController {
  constructor(
    private readonly explainIt: ExplainItService,
    private readonly economy: EconomyService,
  ) {}

  @Get('topics')
  listTopics() {
    return { topics: this.explainIt.listTopics() };
  }

  @Get('topics/:topicId/deal')
  dealForTopic(
    @Param('topicId') topicId: string,
    @Query('count') count?: string,
  ) {
    const parsed = count ? Number.parseInt(count, 10) : EXPLAIN_IT_DEAL_COUNT;
    const dealCount =
      Number.isFinite(parsed) && parsed > 0 ? parsed : EXPLAIN_IT_DEAL_COUNT;
    return this.explainIt.dealForTopic(topicId, dealCount);
  }

  @Post('topics/:topicId/start')
  async startTopic(@Req() req: AuthedRequest, @Param('topicId') topicId: string) {
    const topic = this.explainIt.getTopic(topicId);
    if (topic.locked) {
      throw new BadRequestException('This topic is locked');
    }
    await this.economy.spendBananas(
      req.user.id,
      EXPLAIN_IT_BANANA_COST,
      topicId,
      'explain_it_start',
    );
    return {
      ok: true,
      bananaCost: EXPLAIN_IT_BANANA_COST,
      dealCount: EXPLAIN_IT_DEAL_COUNT,
    };
  }
}
