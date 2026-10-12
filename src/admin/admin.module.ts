import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { BugReportsModule } from '../bug-reports/bug-reports.module';
import { ArticlesModule } from '../articles/articles.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminArticlesController } from './admin-articles.controller';
import { AdminBugReportsController } from './admin-bug-reports.controller';
import { AdminLedgerController } from './admin-ledger.controller';
import { AdminLedgerService } from './admin-ledger.service';
import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminReferralsController } from './admin-referrals.controller';

@Module({
  imports: [
    EconomyModule,
    PurchasesModule,
    BugReportsModule,
    ArticlesModule,
    ReferralsModule,
  ],
  controllers: [
    AdminMetricsController,
    AdminLedgerController,
    AdminBugReportsController,
    AdminArticlesController,
    AdminReferralsController,
  ],
  providers: [AdminMetricsService, AdminLedgerService, AdminAuthGuard],
})
export class AdminModule {}
