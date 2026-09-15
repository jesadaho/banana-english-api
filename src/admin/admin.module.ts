import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { BugReportsModule } from '../bug-reports/bug-reports.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminBugReportsController } from './admin-bug-reports.controller';
import { AdminLedgerController } from './admin-ledger.controller';
import { AdminLedgerService } from './admin-ledger.service';
import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';

@Module({
  imports: [EconomyModule, PurchasesModule, BugReportsModule],
  controllers: [
    AdminMetricsController,
    AdminLedgerController,
    AdminBugReportsController,
  ],
  providers: [AdminMetricsService, AdminLedgerService, AdminAuthGuard],
})
export class AdminModule {}
