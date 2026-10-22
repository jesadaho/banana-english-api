import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { RecentLearnersService } from '../recent-learners/recent-learners.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { IN_ON_AT_BANANA_COST, IN_ON_AT_DEAL_COUNT } from './in-on-at.data';
import { InOnAtService } from './in-on-at.service';

type AuthedRequest = { user: User };

/**
 * in · on · at game (Games tab).
 *
 * Topic locks (Mix needs Time + Place played) are a client concern: the
 * server only lists `requires` and charges bananas on start.
 */
@Controller('in-on-at')
@UseGuards(AnonymousUserGuard)
export class InOnAtController {
  constructor(
    private readonly inOnAt: InOnAtService,
    private readonly economy: EconomyService,
    private readonly recentLearners: RecentLearnersService,
  ) {}

  @Get('topics')
  listTopics() {
    return {
      topics: this.inOnAt.listTopics(),
      bananaCost: IN_ON_AT_BANANA_COST,
      dealCount: IN_ON_AT_DEAL_COUNT,
    };
  }

  @Get('topics/:topicId/deal')
  dealForTopic(
    @Param('topicId') topicId: string,
    @Query('count') count?: string,
  ) {
    const parsed = count ? Number.parseInt(count, 10) : IN_ON_AT_DEAL_COUNT;
    const dealCount =
      Number.isFinite(parsed) && parsed > 0 ? parsed : IN_ON_AT_DEAL_COUNT;
    return this.inOnAt.dealForTopic(topicId, dealCount);
  }

  /** Spends bananas for one round (also used by "Play again"). */
  @Post('topics/:topicId/start')
  async startTopic(@Req() req: AuthedRequest, @Param('topicId') topicId: string) {
    this.inOnAt.getTopic(topicId);
    const spendRef = randomUUID();
    await this.economy.spendBananas(
      req.user.id,
      IN_ON_AT_BANANA_COST,
      spendRef,
      'in_on_at_start',
    );
    await this.recentLearners.markActivity(
      req.user.id,
      'minigame',
      `in_on_at:${topicId}`,
    );
    return {
      ok: true,
      bananaCost: IN_ON_AT_BANANA_COST,
      dealCount: IN_ON_AT_DEAL_COUNT,
    };
  }
}
