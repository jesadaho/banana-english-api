import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { ActivityService } from './activity.service';
import { AnonymousUserGuard } from './anonymous-user.guard';
import { UserAuthService } from './user-auth.service';
import { UserNotificationsService } from './user-notifications.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [EconomyModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserAuthService,
    ActivityService,
    UserNotificationsService,
    AnonymousUserGuard,
  ],
  exports: [UsersService, ActivityService, AnonymousUserGuard, UserAuthService],
})
export class UsersModule {}
