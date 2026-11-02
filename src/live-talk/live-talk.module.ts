import { Module } from '@nestjs/common';
import { LiveTalkController } from './live-talk.controller';
import { LiveTalkService } from './live-talk.service';
import { LiveTalkWebhookController } from './live-talk-webhook.controller';

@Module({
  controllers: [LiveTalkController, LiveTalkWebhookController],
  providers: [LiveTalkService],
})
export class LiveTalkModule {}
