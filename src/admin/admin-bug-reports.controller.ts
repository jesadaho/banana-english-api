import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { BugReportsService } from '../bug-reports/bug-reports.service';
import { UpdateBugReportDto } from '../bug-reports/dto/update-bug-report.dto';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('admin/bug-reports')
@UseGuards(AdminAuthGuard)
export class AdminBugReportsController {
  constructor(private readonly bugReports: BugReportsService) {}

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.bugReports.listForAdmin(from, to, status);
  }

  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() body: UpdateBugReportDto) {
    return this.bugReports.updateStatus(id, body.status);
  }
}
