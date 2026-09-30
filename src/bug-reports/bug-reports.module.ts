import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { BugReportsController } from './bug-reports.controller';
import { BugReportsService } from './bug-reports.service';

@Module({
  imports: [UsersModule, NotificationsModule],
  controllers: [BugReportsController],
  providers: [BugReportsService],
  exports: [BugReportsService],
})
export class BugReportsModule {}
