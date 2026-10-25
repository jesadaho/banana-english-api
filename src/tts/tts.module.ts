import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit';
import { GeminiModule } from '../gemini/gemini.module';
import { UsersModule } from '../users/users.module';
import { CloudTtsAuthService } from './cloud-tts-auth.service';
import { TtsController, TtsV2Controller } from './tts.controller';
import { TtsLiveLinesService } from './tts-live-lines.service';

@Module({
  imports: [GeminiModule, UsersModule],
  controllers: [TtsController, TtsV2Controller],
  providers: [CloudTtsAuthService, TtsLiveLinesService, RateLimitGuard],
  exports: [CloudTtsAuthService, TtsLiveLinesService],
})
export class TtsModule {}
