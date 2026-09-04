import { Controller, Get, Req, UseGuards } from '@nestjs/common';
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
}
