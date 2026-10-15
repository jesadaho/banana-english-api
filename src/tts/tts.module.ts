import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { CloudTtsAuthService } from './cloud-tts-auth.service';
import { TtsController } from './tts.controller';
import { TtsLiveLinesService } from './tts-live-lines.service';

@Module({
  imports: [GeminiModule],
  controllers: [TtsController],
  providers: [CloudTtsAuthService, TtsLiveLinesService],
  exports: [CloudTtsAuthService, TtsLiveLinesService],
})
export class TtsModule {}
