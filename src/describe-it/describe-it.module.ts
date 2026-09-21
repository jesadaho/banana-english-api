import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { DescribeItController } from './describe-it.controller';
import { DescribeItService } from './describe-it.service';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [DescribeItController],
  providers: [DescribeItService],
  exports: [DescribeItService],
})
export class DescribeItModule {}
