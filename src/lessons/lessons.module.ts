import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [UsersModule, EconomyModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
