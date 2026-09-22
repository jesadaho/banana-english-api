import { BadRequestException, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { canonicalFoundationV7RewardId } from '../learn-path/foundation-v7-path.data';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { RecentLearnersService } from '../recent-learners/recent-learners.service';
import {
  DESCRIBE_IT_BANANA_COST,
  isFoundationDescribeItPool,
  listDescribeItPools,
} from './describe-it.data';
import { DescribeItService } from './describe-it.service';

type AuthedRequest = { user: User };

@Controller('describe-it')
@UseGuards(AnonymousUserGuard)
export class DescribeItController {
  constructor(
    private readonly describeIt: DescribeItService,
    private readonly economy: EconomyService,
    private readonly recentLearners: RecentLearnersService,
  ) {}

  @Get('pools')
  listPools() {
    return { pools: listDescribeItPools() };
  }

  @Get('pools/:poolId/deal')
  dealForPool(@Param('poolId') poolId: string) {
    return this.describeIt.dealForPool(poolId);
  }

  @Post('pools/:poolId/start')
  async startPool(@Req() req: AuthedRequest, @Param('poolId') poolId: string) {
    this.describeIt.getPool(poolId);
    const rewardId = `describe_it:${poolId}`;
    const replayFree = await this.economy.hasClaimedMiniGameReward(
      req.user.id,
      rewardId,
    );
    const bananaCost = replayFree ? 0 : DESCRIBE_IT_BANANA_COST;
    const spendRef = bananaCost > 0 ? randomUUID() : null;
    if (bananaCost > 0 && spendRef) {
      await this.economy.spendBananas(
        req.user.id,
        bananaCost,
        spendRef,
        'describe_it_start',
      );
    }
    try {
      const deal = this.describeIt.dealForPool(poolId);
      await this.recentLearners.markActivity(req.user.id, 'minigame', poolId);
      return {
        ok: true,
        bananaCost,
        dealCount: deal.dealCount,
      };
    } catch (error) {
      if (bananaCost > 0 && spendRef) {
        await this.economy.refundBananas(
          req.user.id,
          bananaCost,
          spendRef,
          'describe_it_start_refund',
        );
      }
      throw error;
    }
  }

  @Post('pools/:poolId/complete')
  async completePool(@Req() req: AuthedRequest, @Param('poolId') poolId: string) {
    if (!isFoundationDescribeItPool(poolId)) {
      throw new BadRequestException(
        'Only foundation path Describe It pools can claim path rewards',
      );
    }
    const deal = this.describeIt.dealForPool(poolId);
    if (deal.items.length === 0) {
      throw new BadRequestException(`Describe It pool has no items: ${poolId}`);
    }
    const gameId = `describe_it:${poolId}`;
    if (!canonicalFoundationV7RewardId(gameId)) {
      throw new BadRequestException(`Unknown foundation Describe It pool: ${poolId}`);
    }
    return this.economy.applyMiniGameRewards({
      userId: req.user.id,
      gameId,
    });
  }
}
