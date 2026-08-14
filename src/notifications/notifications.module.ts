import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DailyJobsService } from './daily-jobs.service';
import { FcmService } from './fcm.service';

@Module({
  imports: [EconomyModule, PrismaModule],
  providers: [FcmService, DailyJobsService],
  exports: [FcmService],
})
export class NotificationsModule {}
