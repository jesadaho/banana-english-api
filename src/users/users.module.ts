import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { AnonymousUserGuard } from './anonymous-user.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [EconomyModule],
  controllers: [UsersController],
  providers: [UsersService, AnonymousUserGuard],
  exports: [UsersService, AnonymousUserGuard],
})
export class UsersModule {}
