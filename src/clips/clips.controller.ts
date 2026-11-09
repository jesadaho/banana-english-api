import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { ClipsService } from './clips.service';

type AuthedRequest = { user: User };

/** Clips tab (app). */
@Controller('clips')
@UseGuards(AnonymousUserGuard)
export class ClipsController {
  constructor(private readonly clips: ClipsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.clips.listForUser(req.user.id);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.clips.getForUser(req.user.id, id);
  }

  @Post(':id/progress')
  progress(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { mode?: string; idx?: number; correct?: boolean; score?: number; completed?: boolean },
  ) {
    return this.clips.saveProgress(req.user.id, id, body);
  }
}
