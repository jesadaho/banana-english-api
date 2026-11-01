import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { WeeklyReportService } from './weekly-report.service';

type AuthedRequest = { user: User };

@Controller('weekly-report')
@UseGuards(AnonymousUserGuard)
export class WeeklyReportController {
  constructor(private readonly weeklyReport: WeeklyReportService) {}

  @Get(':weekKey')
  getReport(@Req() req: AuthedRequest, @Param('weekKey') weekKey: string) {
    return this.weeklyReport.getSnapshot(req.user.id, weekKey);
  }
}
