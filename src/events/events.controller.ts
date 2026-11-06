import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { EventsService } from './events.service';

type AuthedRequest = { user: User };

@Controller('events')
@UseGuards(AnonymousUserGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get('active')
  listActive() {
    return this.events.listActive();
  }

  @Get('rewards/unseen')
  unseen(@Req() req: AuthedRequest) {
    return this.events.unseenRewards(req.user.id);
  }

  @Post('rewards/:grantId/seen')
  markSeen(@Req() req: AuthedRequest, @Param('grantId') grantId: string) {
    return this.events.markGrantSeen(req.user.id, grantId);
  }

  @Get(':id/leaderboard')
  leaderboard(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.events.leaderboard(id, req.user);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.events.getPublic(id);
  }
}
