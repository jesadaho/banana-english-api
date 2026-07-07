import { Global, Module } from '@nestjs/common';
import { GeminiChatService } from './gemini-chat.service';
import { GeminiTtsService } from './gemini-tts.service';

@Global()
@Module({
  providers: [GeminiTtsService, GeminiChatService],
  exports: [GeminiTtsService, GeminiChatService],
})
export class GeminiModule {}
