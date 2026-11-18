import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { RevenueCatClient } from './revenuecat.client';
import { SubscriptionStoreController } from './subscription-store.controller';

@Module({
  imports: [
    EconomyModule,
    UsersModule,
    SubscriptionsModule,
    ReferralsModule,
    NotificationsModule,
  ],
  controllers: [PurchasesController, SubscriptionStoreController],
  providers: [PurchasesService, RevenueCatClient],
  exports: [PurchasesService, RevenueCatClient],
})
export class PurchasesModule {}
