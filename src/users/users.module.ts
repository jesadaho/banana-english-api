import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ActivityService } from './activity.service';
import { AnonymousUserGuard } from './anonymous-user.guard';
import { StaleGuestCleanupService } from './stale-guest-cleanup.service';
import { UserAuthService } from './user-auth.service';
import { UserNotificationsService } from './user-notifications.service';
import { UsersController } from './users.controller';
import { PaywallController } from '../subscriptions/paywall.controller';
import { NotifyAskController } from './notify-ask.controller';
import { UsersService } from './users.service';

@Module({
  imports: [EconomyModule, NotificationsModule, SubscriptionsModule],
  controllers: [UsersController, PaywallController, NotifyAskController],
  providers: [
    UsersService,
    UserAuthService,
    ActivityService,
    UserNotificationsService,
    AnonymousUserGuard,
    StaleGuestCleanupService,
  ],
  exports: [
    UsersService,
    ActivityService,
    AnonymousUserGuard,
    UserAuthService,
    StaleGuestCleanupService,
  ],
})
export class UsersModule {}
