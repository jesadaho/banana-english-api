import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';

type AuthedRequest = { user: User };

@Controller('daily-speak')
@UseGuards(AnonymousUserGuard)
export class DailySpeakController {
  constructor(private readonly economy: EconomyService) {}

  @Post('complete')
  async complete(@Req() req: AuthedRequest) {
    return this.economy.applyDailySpeakRewards({
      userId: req.user.id,
    });
  }
}
