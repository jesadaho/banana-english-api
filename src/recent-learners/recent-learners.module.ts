import { Global, Module } from '@nestjs/common';
import { RecentLearnersService } from './recent-learners.service';

@Global()
@Module({
  providers: [RecentLearnersService],
  exports: [RecentLearnersService],
})
export class RecentLearnersModule {}
