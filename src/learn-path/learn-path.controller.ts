import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
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

  /** V7 is additive; clients must explicitly opt into the Guided UI contract. */
  @Get('foundation-v7')
  async foundationV7(@Req() req: AuthedRequest, @Query('capabilities') raw?: string) {
    if (raw !== undefined && typeof raw !== 'string') throw new BadRequestException('Invalid capabilities');
    const capabilities = raw ? raw.split(',').map(value => value.trim()) : [];
    if (capabilities.some(value => value !== 'say_it_guided')) {
      throw new BadRequestException('Supported capability: say_it_guided');
    }
    return this.learnPath.getFoundationV7(req.user.id, capabilities as Array<'say_it_guided'>);
  }
}
