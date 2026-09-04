import { BadRequestException, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { isFoundationPathRewardGameId } from '../learn-path/foundation-v2-path.data';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import {
  isFoundationPathSayItTopic,
  SAY_IT_BANANA_COST,
  SAY_IT_DEAL_COUNT,
  sayItPoolForTopic,
} from './say-it.data';
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
    // Foundation path Say It is retrieval practice — no banana charge.
    if (!isFoundationPathSayItTopic(topicId)) {
      await this.economy.spendBananas(
        req.user.id,
        SAY_IT_BANANA_COST,
        topicId,
        'say_it_start',
      );
    }
    return {
      ok: true,
      bananaCost: isFoundationPathSayItTopic(topicId) ? 0 : SAY_IT_BANANA_COST,
      dealCount: SAY_IT_DEAL_COUNT,
    };
  }

  /** Marks a Foundation path Say It node complete (lesson-sized rewards once). */
  @Post('topics/:topicId/complete')
  async completeTopic(
    @Req() req: AuthedRequest,
    @Param('topicId') topicId: string,
  ) {
    if (!isFoundationPathSayItTopic(topicId)) {
      throw new BadRequestException(
        'Only foundation path Say It topics can claim path rewards',
      );
    }
    this.sayIt.getTopic(topicId);
    if (sayItPoolForTopic(topicId).length === 0) {
      throw new BadRequestException(`Say It topic has no pool: ${topicId}`);
    }
    const gameId = `say_it:${topicId}`;
    if (!isFoundationPathRewardGameId(gameId)) {
      throw new BadRequestException(`Unknown foundation Say It topic: ${topicId}`);
    }
    return this.economy.applyMiniGameRewards({
      userId: req.user.id,
      gameId,
    });
  }
}
