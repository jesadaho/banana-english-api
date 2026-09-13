import { Module } from '@nestjs/common';
import { PhonicsController } from './phonics.controller';
import { PhonicsService } from './phonics.service';

@Module({
  controllers: [PhonicsController],
  providers: [PhonicsService],
  exports: [PhonicsService],
})
export class PhonicsModule {}
