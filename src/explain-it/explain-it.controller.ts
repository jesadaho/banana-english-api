import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import {
  EXPLAIN_IT_BANANA_COST,
  EXPLAIN_IT_CHALLENGE_DEAL_COUNT,
  EXPLAIN_IT_DEAL_COUNT,
  explainItUnlockReference,
  isExplainItChallenge,
} from './explain-it.data';
import { ExplainItLeaderboardService } from './explain-it-leaderboard.service';
import { ExplainItScoreDto } from './dto/explain-it-score.dto';
import { ExplainItService } from './explain-it.service';

type AuthedRequest = { user: User };

@Controller('explain-it')
@UseGuards(AnonymousUserGuard)
export class ExplainItController {
  constructor(
    private readonly explainIt: ExplainItService,
    private readonly economy: EconomyService,
    private readonly leaderboard: ExplainItLeaderboardService,
  ) {}

  @Get('topics')
  async listTopics(@Req() req: AuthedRequest) {
    return { topics: await this.explainIt.listTopicsForUser(req.user.id) };
  }

  @Get('topics/:topicId/deal')
  dealForTopic(
    @Param('topicId') topicId: string,
    @Query('count') count?: string,
  ) {
    if (isExplainItChallenge(topicId)) {
      return this.explainIt.dealForTopic(topicId, EXPLAIN_IT_CHALLENGE_DEAL_COUNT);
    }
    const parsed = count ? Number.parseInt(count, 10) : EXPLAIN_IT_DEAL_COUNT;
    const dealCount =
      Number.isFinite(parsed) && parsed > 0 ? parsed : EXPLAIN_IT_DEAL_COUNT;
    return this.explainIt.dealForTopic(topicId, dealCount);
  }

  @Post('topics/:topicId/start')
  async startTopic(
    @Req() req: AuthedRequest,
    @Param('topicId') topicId: string,
  ) {
    const topic = this.explainIt.getTopic(topicId);
    if (topic.locked) {
      throw new BadRequestException('This topic is locked');
    }

    const challenge = isExplainItChallenge(topicId);
    const alreadyUnlocked = challenge
      ? false
      : await this.explainIt.isTopicUnlocked(req.user.id, topicId);
    const bananaCost = challenge
      ? EXPLAIN_IT_BANANA_COST
      : alreadyUnlocked
        ? 0
        : EXPLAIN_IT_BANANA_COST;
    const dealCount = challenge
      ? EXPLAIN_IT_CHALLENGE_DEAL_COUNT
      : EXPLAIN_IT_DEAL_COUNT;

    const spendRef = challenge
      ? randomUUID()
      : bananaCost > 0
        ? explainItUnlockReference(topicId)
        : null;

    if (bananaCost > 0 && spendRef) {
      await this.economy.spendBananas(
        req.user.id,
        bananaCost,
        spendRef,
        'explain_it_start',
      );
    }

    try {
      this.explainIt.dealForTopic(topicId, dealCount);
    } catch (error) {
      if (bananaCost > 0 && spendRef) {
        await this.economy.refundBananas(
          req.user.id,
          bananaCost,
          spendRef,
          'explain_it_start_refund',
        );
      }
      throw error;
    }

    return {
      ok: true,
      bananaCost,
      dealCount,
      unlocked: !challenge,
    };
  }

  @Post('topics/:topicId/score')
  submitScore(
    @Req() req: AuthedRequest,
    @Param('topicId') topicId: string,
    @Body() body: ExplainItScoreDto,
  ) {
    if (!isExplainItChallenge(topicId)) {
      throw new BadRequestException(
        'Only Challenge scores are accepted on the leaderboard',
      );
    }
    return this.leaderboard.submitScore(
      req.user,
      topicId,
      body.score,
      body.avatarId,
    );
  }

  @Get('topics/:topicId/leaderboard')
  leaderboardForTopic(
    @Req() req: AuthedRequest,
    @Param('topicId') topicId: string,
  ) {
    if (!isExplainItChallenge(topicId)) {
      throw new BadRequestException(
        'Leaderboard is only available for Challenge',
      );
    }
    return this.leaderboard.board(req.user, topicId);
  }
}
