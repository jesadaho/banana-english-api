import { Module } from '@nestjs/common';
import { BeamClient } from './beam.client';
import { PresaleController } from './presale.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [PresaleController],
  providers: [SubscriptionsService, BeamClient],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
