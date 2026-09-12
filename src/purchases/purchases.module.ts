import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { RevenueCatClient } from './revenuecat.client';

@Module({
  imports: [EconomyModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, RevenueCatClient],
  exports: [PurchasesService, RevenueCatClient],
})
export class PurchasesModule {}
