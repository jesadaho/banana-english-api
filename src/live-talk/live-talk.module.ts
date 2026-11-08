import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { HostWebAuthGuard } from './host-web-auth.guard';
import { LiveTalkHostController } from './live-talk-host.controller';
import { LiveTalkScheduleService } from './live-talk-schedule.service';
import { LiveTalkController } from './live-talk.controller';
import { LiveTalkService } from './live-talk.service';
import { LiveTalkWebhookController } from './live-talk-webhook.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [
    LiveTalkController,
    LiveTalkWebhookController,
    LiveTalkHostController,
  ],
  providers: [LiveTalkService, LiveTalkScheduleService, HostWebAuthGuard],
  exports: [LiveTalkService],
})
export class LiveTalkModule {}
