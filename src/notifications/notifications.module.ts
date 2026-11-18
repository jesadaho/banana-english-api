import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DailyJobsService } from './daily-jobs.service';
import { FcmService } from './fcm.service';
import { TelegramNotifier } from './telegram.notifier';

@Module({
  imports: [EconomyModule, PrismaModule],
  providers: [FcmService, DailyJobsService, TelegramNotifier],
  exports: [FcmService, TelegramNotifier],
})
export class NotificationsModule {}
