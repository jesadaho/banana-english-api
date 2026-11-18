import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BeamClient } from './beam.client';
import { PresaleController } from './presale.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PresaleController],
  providers: [SubscriptionsService, BeamClient],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
