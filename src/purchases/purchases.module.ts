import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { RevenueCatClient } from './revenuecat.client';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, RevenueCatClient],
  exports: [PurchasesService, RevenueCatClient],
})
export class PurchasesModule {}
