import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { ActivityService } from './activity.service';
import { AnonymousUserGuard } from './anonymous-user.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [EconomyModule],
  controllers: [UsersController],
  providers: [UsersService, ActivityService, AnonymousUserGuard],
  exports: [UsersService, ActivityService, AnonymousUserGuard],
})
export class UsersModule {}
