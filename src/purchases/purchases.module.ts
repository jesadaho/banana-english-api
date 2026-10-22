import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { RevenueCatClient } from './revenuecat.client';
import { SubscriptionStoreController } from './subscription-store.controller';

@Module({
  imports: [EconomyModule, UsersModule, SubscriptionsModule],
  controllers: [PurchasesController, SubscriptionStoreController],
  providers: [PurchasesService, RevenueCatClient],
  exports: [PurchasesService, RevenueCatClient],
})
export class PurchasesModule {}
