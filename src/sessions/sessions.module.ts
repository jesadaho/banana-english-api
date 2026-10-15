import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { LessonsModule } from '../lessons/lessons.module';
import { SeriesModule } from '../series/series.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { UsersModule } from '../users/users.module';
import { TrainingModule } from '../training/training.module';
import { TtsModule } from '../tts/tts.module';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [
    EconomyModule,
    UsersModule,
    SeriesModule,
    LessonsModule,
    AchievementsModule,
    TrainingModule,
    TtsModule,
  ],
  controllers: [SessionsController],
})
export class SessionsModule {}
