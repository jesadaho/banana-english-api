import { Global, Module } from '@nestjs/common';
import { GroqChatService } from '../groq/groq-chat.service';
import { GeminiChatService } from './gemini-chat.service';
import { GeminiTtsService } from './gemini-tts.service';

@Global()
@Module({
  providers: [GeminiTtsService, GroqChatService, GeminiChatService],
  exports: [GeminiTtsService, GroqChatService, GeminiChatService],
})
export class GeminiModule {}
