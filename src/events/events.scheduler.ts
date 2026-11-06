import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventsService } from './events.service';

@Injectable()
export class EventsScheduler {
  private readonly logger = new Logger(EventsScheduler.name);

  constructor(private readonly events: EventsService) {}

  @Cron('*/15 * * * *')
  async tick() {
    try {
      await this.events.runScheduler();
    } catch (error) {
      this.logger.error(`Event scheduler failed: ${String(error)}`);
    }
  }
}
