import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { BugReportsService } from './bug-reports.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';

type AuthedRequest = { user: User };

@Controller('bug-reports')
@UseGuards(AnonymousUserGuard)
export class BugReportsController {
  constructor(private readonly bugReports: BugReportsService) {}

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CreateBugReportDto) {
    return this.bugReports.create(req.user, body);
  }
}
