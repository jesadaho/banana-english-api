import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
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
}
