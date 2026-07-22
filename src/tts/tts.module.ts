import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { CloudTtsAuthService } from './cloud-tts-auth.service';
import { TtsController } from './tts.controller';

@Module({
  imports: [GeminiModule],
  controllers: [TtsController],
  providers: [CloudTtsAuthService],
  exports: [CloudTtsAuthService],
})
export class TtsModule {}
