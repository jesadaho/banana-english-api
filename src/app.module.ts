import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { TopicsModule } from './topics/topics.module';
import { SessionsModule } from './sessions/sessions.module';
import { ConfigKeysModule } from './config-keys/config-keys.module';
import { OpenAiModule } from './openai/openai.module';
import { SessionStoreModule } from './session-store/session-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    TopicsModule,
    SessionsModule,
    ConfigKeysModule,
    OpenAiModule,
    SessionStoreModule,
  ],
})
export class AppModule {}
