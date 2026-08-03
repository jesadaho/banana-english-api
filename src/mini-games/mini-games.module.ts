import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { MiniGamesController } from './mini-games.controller';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [MiniGamesController],
})
export class MiniGamesModule {}
