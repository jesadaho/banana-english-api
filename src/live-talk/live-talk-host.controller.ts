import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HostWebAuthGuard } from './host-web-auth.guard';
import type { SessionInput } from './live-talk-schedule.rules';
import {
  LiveTalkScheduleService,
  type HostWebViewer,
} from './live-talk-schedule.service';

type HostRequest = { hostViewer: HostWebViewer };

/** Official Host web page (/host): book Live Talk times. */
@Controller('host/live-talk')
@UseGuards(HostWebAuthGuard)
export class LiveTalkHostController {
  constructor(private readonly schedule: LiveTalkScheduleService) {}

  @Get('me')
  me(@Req() req: HostRequest) {
    return this.schedule.me(req.hostViewer);
  }

  @Get('sessions')
  list(
    @Req() req: HostRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.schedule.listRange(
      req.hostViewer,
      new Date(from ?? ''),
      new Date(to ?? ''),
    );
  }

  @Post('sessions')
  create(@Req() req: HostRequest, @Body() body: SessionInput) {
    return this.schedule.create(req.hostViewer, body);
  }

  @Patch('sessions/:id')
  update(
    @Req() req: HostRequest,
    @Param('id') id: string,
    @Body() body: SessionInput,
  ) {
    return this.schedule.update(req.hostViewer, id, body);
  }

  @Delete('sessions/:id')
  cancel(@Req() req: HostRequest, @Param('id') id: string) {
    return this.schedule.cancel(req.hostViewer, id);
  }
}
