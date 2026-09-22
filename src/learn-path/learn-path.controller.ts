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
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { LearnPathService } from './learn-path.service';

type AuthedRequest = { user: User };

@Controller('learn-path')
@UseGuards(AnonymousUserGuard)
export class LearnPathController {
  constructor(private readonly learnPath: LearnPathService) {}

  @Get('foundation-v2')
  async foundationV2(@Req() req: AuthedRequest) {
    return this.learnPath.getFoundationV2(req.user.id);
  }

  /** Preview catalog for the approved 109-node A1 Foundation redesign. */
  @Get('foundation-v5')
  async foundationV5(@Req() req: AuthedRequest) {
    return this.learnPath.getFoundationV5(req.user.id);
  }

  /** Playtest catalog for the lighter 95-node A1 Foundation cadence. */
  @Get('foundation-v6')
  async foundationV6(@Req() req: AuthedRequest) {
    return this.learnPath.getFoundationV6(req.user.id);
  }

  /** V7 is additive; clients must explicitly opt into the Guided UI contract. */
  @Get('foundation-v7')
  async foundationV7(@Req() req: AuthedRequest, @Query('capabilities') raw?: string) {
    if (raw !== undefined && typeof raw !== 'string') throw new BadRequestException('Invalid capabilities');
    const capabilities = raw ? raw.split(',').map(value => value.trim()) : [];
    if (capabilities.some(value => value !== 'say_it_guided')) {
      throw new BadRequestException('Supported capability: say_it_guided');
    }
    return this.learnPath.getFoundationV7(req.user.id, capabilities as Array<'say_it_guided'>);
  }

  @Get('foundation-v7/chapters/:chapterId/skip-quiz/eligibility')
  skipQuizEligibility(@Param('chapterId') chapterId: string) {
    return this.learnPath.getSkipQuizEligibility(chapterId);
  }

  @Post('foundation-v7/chapters/:chapterId/skip-quiz/start')
  async startSkipQuiz(
    @Req() req: AuthedRequest,
    @Param('chapterId') chapterId: string,
    @Body() body: { idempotencyKey?: string },
  ) {
    const idempotencyKey =
      typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : '';
    return this.learnPath.startSkipQuiz(
      req.user.id,
      chapterId,
      idempotencyKey,
      req.user.displayName,
    );
  }

  @Post('foundation-v7/chapters/:chapterId/skip-quiz/complete')
  async completeSkipQuiz(
    @Req() req: AuthedRequest,
    @Param('chapterId') chapterId: string,
    @Body() body: { attemptId?: string; correctCount?: number },
  ) {
    const attemptId = typeof body?.attemptId === 'string' ? body.attemptId : '';
    if (!attemptId) throw new BadRequestException('attemptId is required');
    const correctCount = body?.correctCount;
    if (typeof correctCount !== 'number') {
      throw new BadRequestException('correctCount is required');
    }
    return this.learnPath.completeSkipQuiz(
      req.user.id,
      chapterId,
      attemptId,
      correctCount,
    );
  }
}
