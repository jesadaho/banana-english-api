import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { DailySpeakController } from './daily-speak.controller';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [DailySpeakController],
})
export class DailySpeakModule {}
