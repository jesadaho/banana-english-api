import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit';
import { UsersModule } from '../users/users.module';
import {
  ConfigKeysController,
  ConfigKeysV2Controller,
} from './config-keys.controller';

@Module({
  imports: [UsersModule],
  controllers: [ConfigKeysController, ConfigKeysV2Controller],
  providers: [RateLimitGuard],
})
export class ConfigKeysModule {}
