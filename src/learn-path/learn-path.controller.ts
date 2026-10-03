import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import {
  FOUNDATION_V7_CAPABILITIES,
  learnCourseById,
  type FoundationV7Capability,
  type LearnCourse,
} from './foundation-v7-path.data';
import { LearnPathService } from './learn-path.service';

type AuthedRequest = { user: User };

function parseCapabilities(raw: unknown): FoundationV7Capability[] {
  if (raw !== undefined && typeof raw !== 'string') throw new BadRequestException('Invalid capabilities');
  const capabilities = raw ? raw.split(',').map(value => value.trim()).filter(Boolean) : [];
  const supported: readonly string[] = FOUNDATION_V7_CAPABILITIES;
  if (capabilities.some(value => !supported.includes(value))) {
    throw new BadRequestException(
      `Supported capabilities: ${FOUNDATION_V7_CAPABILITIES.join(', ')}`,
    );
  }
  return capabilities as FoundationV7Capability[];
}

function requireCourse(pathId: string): LearnCourse {
  const course = learnCourseById(pathId);
  if (!course) throw new NotFoundException('Learn path not found');
  return course;
}

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

  /** Catalog-driven courses: `foundation-v7`, `adventure-a2` (slug or pathId). */
  @Get(':pathId')
  async coursePath(
    @Req() req: AuthedRequest,
    @Param('pathId') pathId: string,
    @Query('capabilities') raw?: string,
  ) {
    const course = requireCourse(pathId);
    return this.learnPath.getFoundationV7(req.user.id, parseCapabilities(raw), course);
  }

  @Get(':pathId/chapters/:chapterId/skip-quiz/eligibility')
  skipQuizEligibility(
    @Param('pathId') pathId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.learnPath.getSkipQuizEligibility(chapterId, requireCourse(pathId).pathId);
  }

  @Post(':pathId/chapters/:chapterId/skip-quiz/start')
  async startSkipQuiz(
    @Req() req: AuthedRequest,
    @Param('pathId') pathId: string,
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
      requireCourse(pathId).pathId,
    );
  }

  @Post(':pathId/chapters/:chapterId/skip-quiz/complete')
  async completeSkipQuiz(
    @Req() req: AuthedRequest,
    @Param('pathId') pathId: string,
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
      requireCourse(pathId).pathId,
    );
  }
}
