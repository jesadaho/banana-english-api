import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [SessionsController],
})
export class SessionsModule {}
