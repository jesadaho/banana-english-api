import { Module } from '@nestjs/common';
import { ConfigKeysController } from './config-keys.controller';

@Module({
  controllers: [ConfigKeysController],
})
export class ConfigKeysModule {}
