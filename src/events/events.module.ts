import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsController } from './events.controller';
import { EventsScheduler } from './events.scheduler';
import { EventsService } from './events.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService, EventsScheduler],
  exports: [EventsService],
})
export class EventsModule {}
