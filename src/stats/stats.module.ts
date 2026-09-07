import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PublicStatsController } from './public-stats.controller';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [UsersModule],
  controllers: [StatsController, PublicStatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
