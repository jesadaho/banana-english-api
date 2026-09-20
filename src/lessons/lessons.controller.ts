import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { CreateLessonRatingDto } from './dto/lesson-rating.dto';
import { LessonsService } from './lessons.service';

type AuthedRequest = { user: User };

@Controller('lessons')
@UseGuards(AnonymousUserGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get('progress')
  async getProgress(@Req() req: AuthedRequest) {
    return this.lessonsService.buildProgressView(req.user.id);
  }

  @Get(':lessonId/recent-learners')
  async getRecentLearners(
    @Req() req: AuthedRequest,
    @Param('lessonId') lessonId: string,
  ) {
    return this.lessonsService.getRecentLearners(lessonId, req.user.id);
  }

  @Get(':lessonId')
  async getLessonQuote(
    @Req() req: AuthedRequest,
    @Param('lessonId') lessonId: string,
  ) {
    const quote = await this.lessonsService.getLessonQuote(
      req.user.id,
      lessonId,
    );
    if (!quote) {
      throw new NotFoundException('Lesson not found');
    }
    return quote;
  }

  @Post('ratings')
  async submitRating(
    @Req() req: AuthedRequest,
    @Body() body: CreateLessonRatingDto,
  ) {
    return this.lessonsService.submitRating({
      userId: req.user.id,
      lessonId: body.lessonId,
      stars: body.stars,
      sessionId: body.sessionId,
      feedback: body.feedback,
    });
  }
}
