import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from './anonymous-user.guard';
import { CompleteOnboardingDto, UpsertUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

type AuthedRequest = { user: User };

@Controller('users')
@UseGuards(AnonymousUserGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Put('me')
  async upsertMe(@Req() req: AuthedRequest, @Body() body: UpsertUserDto) {
    return this.users.upsertProfile(req.user, body);
  }

  @Get('me')
  async getMe(@Req() req: AuthedRequest) {
    return this.users.syncProfile(req.user);
  }

  @Post('me/complete-onboarding')
  async completeOnboarding(
    @Req() req: AuthedRequest,
    @Body() body: CompleteOnboardingDto,
  ) {
    return this.users.completeOnboarding(req.user, body);
  }

  @Post('me/debug/refill-bananas')
  async refillBananasDebug(@Req() req: AuthedRequest) {
    return this.users.refillBananasDebug(req.user);
  }

  @Post('me/debug/reset-streak')
  async resetStreakDebug(@Req() req: AuthedRequest) {
    return this.users.resetStreakDebug(req.user);
  }

  @Post('me/debug/reset-progress')
  async resetProgressDebug(@Req() req: AuthedRequest) {
    return this.users.resetProgressDebug(req.user);
  }
}
