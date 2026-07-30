import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { StatsService } from './stats.service';

type AuthedRequest = { user: User };

@Controller('stats')
@UseGuards(AnonymousUserGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('learning')
  async learning(@Req() req: AuthedRequest) {
    return this.stats.getLearningStats(req.user.id);
  }
}
