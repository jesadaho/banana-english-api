import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { HostWebAuthGuard } from './host-web-auth.guard';
import { LiveTalkHostController } from './live-talk-host.controller';
import { LiveTalkScheduleService } from './live-talk-schedule.service';
import { LiveTalkController } from './live-talk.controller';
import { LiveTalkGamesController } from './live-talk-games.controller';
import { LiveTalkGamesService } from './live-talk-games.service';
import { LiveTalkService } from './live-talk.service';
import { LiveTalkWebhookController } from './live-talk-webhook.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [
    LiveTalkController,
    LiveTalkWebhookController,
    LiveTalkHostController,
    LiveTalkGamesController,
  ],
  providers: [
    LiveTalkService,
    LiveTalkScheduleService,
    HostWebAuthGuard,
    LiveTalkGamesService,
  ],
  exports: [LiveTalkService],
})
export class LiveTalkModule {}
