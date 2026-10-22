import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { InOnAtController } from './in-on-at.controller';
import { InOnAtService } from './in-on-at.service';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [InOnAtController],
  providers: [InOnAtService],
})
export class InOnAtModule {}
