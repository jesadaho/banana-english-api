import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { TopicsModule } from './topics/topics.module';
import { SessionsModule } from './sessions/sessions.module';
import { ConfigKeysModule } from './config-keys/config-keys.module';
import { GeminiModule } from './gemini/gemini.module';
import { SessionStoreModule } from './session-store/session-store.module';
import { TtsModule } from './tts/tts.module';
import { SimulationsModule } from './simulations/simulations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
