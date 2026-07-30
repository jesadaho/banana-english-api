import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { AchievementsService } from './achievements.service';

type AuthedRequest = { user: User };

@Controller('achievements')
@UseGuards(AnonymousUserGuard)
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.achievements.syncForUser(req.user.id);
  }

  @Post(':achievementId/claim')
  async claim(
    @Req() req: AuthedRequest,
    @Param('achievementId') achievementId: string,
  ) {
    return this.achievements.claimReward(req.user.id, achievementId);
  }
}
