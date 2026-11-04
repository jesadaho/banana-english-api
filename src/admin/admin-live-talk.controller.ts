import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LiveTalkService } from '../live-talk/live-talk.service';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('admin/live-talk')
@UseGuards(AdminAuthGuard)
export class AdminLiveTalkController {
  constructor(private readonly liveTalk: LiveTalkService) {}

  @Get('ratings')
  listRatings(@Query('rating') rating?: string) {
    return this.liveTalk.listRatings({ rating });
  }
}
