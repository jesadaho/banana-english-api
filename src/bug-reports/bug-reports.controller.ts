import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { BugReportsService } from './bug-reports.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { ReplyBugReportDto } from './dto/reply-bug-report.dto';

type AuthedRequest = { user: User };

@Controller('bug-reports')
@UseGuards(AnonymousUserGuard)
export class BugReportsController {
  constructor(private readonly bugReports: BugReportsService) {}

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CreateBugReportDto) {
    return this.bugReports.create(req.user, body);
  }

  @Get('mine')
  listMine(@Req() req: AuthedRequest) {
    return this.bugReports.listMine(req.user);
  }

  @Get(':id')
  getMine(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.bugReports.getMine(req.user, id);
  }

  @Post(':id/messages')
  reply(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: ReplyBugReportDto,
  ) {
    return this.bugReports.replyAsUser(req.user, id, body.body);
  }
}
