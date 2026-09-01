import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { SayItController } from './say-it.controller';
import { SayItService } from './say-it.service';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [SayItController],
  providers: [SayItService],
})
export class SayItModule {}
