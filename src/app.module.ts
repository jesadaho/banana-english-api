import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import { TopicsModule } from './topics/topics.module';
import { SessionsModule } from './sessions/sessions.module';
import { ConfigKeysModule } from './config-keys/config-keys.module';
import { GeminiModule } from './gemini/gemini.module';
import { SessionStoreModule } from './session-store/session-store.module';
import { TtsModule } from './tts/tts.module';
import { SimulationsModule } from './simulations/simulations.module';
import { SeriesModule } from './series/series.module';
import { LessonsModule } from './lessons/lessons.module';
import { AchievementsModule } from './achievements/achievements.module';
import { StatsModule } from './stats/stats.module';
import { OutfitsModule } from './outfits/outfits.module';
import { PrismaModule } from './prisma/prisma.module';
import { EconomyModule } from './economy/economy.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MiniGamesModule } from './mini-games/mini-games.module';
import { DailySpeakModule } from './daily-speak/daily-speak.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EconomyModule,
    UsersModule,
    NotificationsModule,
    HealthModule,
    TopicsModule,
    SessionsModule,
    ConfigKeysModule,
    GeminiModule,
    SessionStoreModule,
    TtsModule,
    SimulationsModule,
    SeriesModule,
    LessonsModule,
    AchievementsModule,
    StatsModule,
    OutfitsModule,
    MiniGamesModule,
    DailySpeakModule,
  ],
})
export class AppModule {}
