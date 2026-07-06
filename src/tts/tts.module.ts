import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { TtsController } from './tts.controller';

@Module({
  imports: [GeminiModule],
  controllers: [TtsController],
})
export class TtsModule {}
