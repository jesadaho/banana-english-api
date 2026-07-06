import { Global, Module } from '@nestjs/common';
import { GeminiTtsService } from './gemini-tts.service';

@Global()
@Module({
  providers: [GeminiTtsService],
  exports: [GeminiTtsService],
})
export class GeminiModule {}
