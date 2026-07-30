import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { OutfitsService } from './outfits.service';

type AuthedRequest = { user: User };

@Controller('outfits')
@UseGuards(AnonymousUserGuard)
export class OutfitsController {
  constructor(private readonly outfits: OutfitsService) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.outfits.getForUser(req.user.id);
  }
}
