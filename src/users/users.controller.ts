import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
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
  AcquisitionSourceSurveyDto,
  CompleteOnboardingDto,
  EnglishLevelSurveyDto,
  RefillBananasByNameDto,
  UnlockAvatarDto,
  UpsertUserDto,
} from './dto/users.dto';
import { UserNotificationsService } from './user-notifications.service';
import { UsersService } from './users.service';

type AuthedRequest = { user: User };

@Controller('users')
@UseGuards(AnonymousUserGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly activity: ActivityService,
    private readonly notifications: UserNotificationsService,
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

  @Get('me/notifications')
  async getNotifications(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notifications.listForUser(req.user.id, {
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  @Patch('me/notifications/read-all')
  async markAllNotificationsRead(@Req() req: AuthedRequest) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Patch('me/notifications/:id/read')
  async markNotificationRead(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(req.user.id, id);
  }

  @Post('me/complete-onboarding')
  async completeOnboarding(
    @Req() req: AuthedRequest,
    @Body() body: CompleteOnboardingDto,
  ) {
    return this.users.completeOnboarding(req.user, body);
  }

  @Post('me/english-level-survey')
  async saveEnglishLevelSurvey(
    @Req() req: AuthedRequest,
    @Body() body: EnglishLevelSurveyDto,
  ) {
    return this.users.saveEnglishLevelSurvey(req.user, body);
  }

  @Post('me/acquisition-source-survey')
  async saveAcquisitionSourceSurvey(
    @Req() req: AuthedRequest,
    @Body() body: AcquisitionSourceSurveyDto,
  ) {
    return this.users.saveAcquisitionSourceSurvey(req.user, body);
  }

  @Post('me/avatars/unlock')
  async unlockAvatar(
    @Req() req: AuthedRequest,
    @Body() body: UnlockAvatarDto,
  ) {
    return this.users.unlockAvatar(
      req.user,
      body.avatarId,
      body.perfectMinigameStars ?? 0,
    );
  }

  @Post('me/debug/refill-bananas')
  async refillBananasDebug(@Req() req: AuthedRequest) {
    return this.users.refillBananasDebug(req.user);
  }

  @Post('debug/refill-bananas-by-name')
  async refillBananasByNameDebug(@Body() body: RefillBananasByNameDto) {
    return this.users.refillBananasDebugByDisplayName(body.displayName);
  }

  @Post('me/debug/reset-streak')
  async resetStreakDebug(@Req() req: AuthedRequest) {
    return this.users.resetStreakDebug(req.user);
  }

  @Post('me/debug/reset-progress')
  async resetProgressDebug(@Req() req: AuthedRequest) {
    return this.users.resetProgressDebug(req.user);
  }

  @Post('me/debug/reset-daily-speak')
  async resetDailySpeakDebug(@Req() req: AuthedRequest) {
    return this.users.resetDailySpeakDebug(req.user);
  }
}
