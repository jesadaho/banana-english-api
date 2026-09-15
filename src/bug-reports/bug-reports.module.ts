import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BugReportsController } from './bug-reports.controller';
import { BugReportsService } from './bug-reports.service';

@Module({
  imports: [UsersModule],
  controllers: [BugReportsController],
  providers: [BugReportsService],
  exports: [BugReportsService],
})
export class BugReportsModule {}
