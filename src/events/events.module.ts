import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { eventsApiEnabled } from './event.rules';
import { EventsController } from './events.controller';
import { EventsScheduler } from './events.scheduler';
import { EventsService } from './events.service';

const enabled = eventsApiEnabled();

@Module({
  imports: [NotificationsModule],
  controllers: enabled ? [EventsController] : [],
  providers: enabled ? [EventsService, EventsScheduler] : [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
