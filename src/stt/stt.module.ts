import { Module } from '@nestjs/common';
import { TtsModule } from '../tts/tts.module';
import { GcpSttService } from './gcp-stt.service';
import { SttController } from './stt.controller';

@Module({
  imports: [TtsModule],
  controllers: [SttController],
  providers: [GcpSttService],
})
export class SttModule {}
