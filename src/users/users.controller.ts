import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { ActivityService } from './activity.service';
import { AnonymousUserGuard } from './anonymous-user.guard';
import {
  CompleteOnboardingDto,
  UnlockAvatarDto,
  UpsertUserDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

type AuthedRequest = { user: User };

@Controller('users')
@UseGuards(AnonymousUserGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly activity: ActivityService,
  ) {}

  @Put('me')
  async upsertMe(@Req() req: AuthedRequest, @Body() body: UpsertUserDto) {
    return this.users.upsertProfile(req.user, body);
  }

  @Get('me')
  async getMe(@Req() req: AuthedRequest) {
    return this.users.syncProfile(req.user);
  }

  @Get('me/activity')
  async getActivity(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('date') date?: string,
    @Query('simulationId') simulationId?: string,
  ) {
    return this.activity.listActivity(req.user.id, {
      limit: limit ? Number(limit) : undefined,
      cursor,
      date,
      simulationId,
    });
  }

  @Get('me/activity/days')
  async getActivityDays(
    @Req() req: AuthedRequest,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const y = year ? Number(year) : now.getUTCFullYear();
    const m = month ? Number(month) : now.getUTCMonth() + 1;
    return this.activity.listActivityDays(req.user.id, y, m);
  }

  @Post('me/complete-onboarding')
  async completeOnboarding(
    @Req() req: AuthedRequest,
    @Body() body: CompleteOnboardingDto,
  ) {
    return this.users.completeOnboarding(req.user, body);
  }

  @Post('me/avatars/unlock')
  async unlockAvatar(
    @Req() req: AuthedRequest,
    @Body() body: UnlockAvatarDto,
  ) {
    return this.users.unlockAvatar(req.user, body.avatarId);
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
