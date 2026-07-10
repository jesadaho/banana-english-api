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
import { PrismaModule } from './prisma/prisma.module';
import { EconomyModule } from './economy/economy.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';

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
  ],
})
export class AppModule {}
