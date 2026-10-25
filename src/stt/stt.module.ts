import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit';
import { TtsModule } from '../tts/tts.module';
import { UsersModule } from '../users/users.module';
import { GcpSttService } from './gcp-stt.service';
import { SttController, SttV2Controller } from './stt.controller';

@Module({
  imports: [TtsModule, UsersModule],
  controllers: [SttController, SttV2Controller],
  providers: [GcpSttService, RateLimitGuard],
})
export class SttModule {}
