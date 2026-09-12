import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminLedgerController } from './admin-ledger.controller';
import { AdminLedgerService } from './admin-ledger.service';
import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';

@Module({
  imports: [EconomyModule, PurchasesModule],
  controllers: [AdminMetricsController, AdminLedgerController],
  providers: [AdminMetricsService, AdminLedgerService, AdminAuthGuard],
})
export class AdminModule {}
