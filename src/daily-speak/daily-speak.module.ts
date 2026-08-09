import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { DailySpeakController } from './daily-speak.controller';
import { DailySpeakFeedbackService } from './daily-speak-feedback.service';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [DailySpeakController],
  providers: [DailySpeakFeedbackService],
})
export class DailySpeakModule {}
