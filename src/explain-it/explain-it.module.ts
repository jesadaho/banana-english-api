import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { ExplainItController } from './explain-it.controller';
import { ExplainItService } from './explain-it.service';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [ExplainItController],
  providers: [ExplainItService],
})
export class ExplainItModule {}
