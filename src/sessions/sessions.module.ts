import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { LessonsModule } from '../lessons/lessons.module';
import { SeriesModule } from '../series/series.module';
import { UsersModule } from '../users/users.module';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [EconomyModule, UsersModule, SeriesModule, LessonsModule],
  controllers: [SessionsController],
})
export class SessionsModule {}
