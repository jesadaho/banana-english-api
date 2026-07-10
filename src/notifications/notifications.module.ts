import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { DailyJobsService } from './daily-jobs.service';
import { FcmService } from './fcm.service';

@Module({
  imports: [EconomyModule],
  providers: [FcmService, DailyJobsService],
  exports: [FcmService],
})
export class NotificationsModule {}
