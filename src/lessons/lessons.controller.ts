import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
    });
  }
}
