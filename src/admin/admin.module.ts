import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { BugReportsModule } from '../bug-reports/bug-reports.module';
import { ArticlesModule } from '../articles/articles.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TtsModule } from '../tts/tts.module';
import { LiveTalkModule } from '../live-talk/live-talk.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminLiveTalkController } from './admin-live-talk.controller';
import { AdminTtsLiveLinesController } from './admin-tts-live-lines.controller';
import { AdminEarlyBirdController } from './admin-early-bird.controller';
import { AdminArticlesController } from './admin-articles.controller';
import { AdminBugReportsController } from './admin-bug-reports.controller';
import { AdminLedgerController } from './admin-ledger.controller';
import { AdminLedgerService } from './admin-ledger.service';
import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminReferralsController } from './admin-referrals.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [
    EconomyModule,
    PurchasesModule,
    BugReportsModule,
    ArticlesModule,
    ReferralsModule,
    SubscriptionsModule,
    TtsModule,
    LiveTalkModule,
  ],
  controllers: [
    AdminMetricsController,
    AdminLedgerController,
    AdminBugReportsController,
    AdminArticlesController,
    AdminReferralsController,
    AdminSubscriptionsController,
    AdminTtsLiveLinesController,
    AdminEarlyBirdController,
    AdminUsersController,
    AdminLiveTalkController,
  ],
  providers: [AdminMetricsService, AdminLedgerService, AdminAuthGuard],
})
export class AdminModule {}
