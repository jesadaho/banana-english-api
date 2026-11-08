import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  /** Any level, Official included (hiring a paid host). Logged without an actor id. */
  @Post('hosts/:userId')
  setHostLevel(
    @Param('userId') userId: string,
    @Body() body: { level?: string; note?: string },
  ) {
    return this.liveTalk.setHostLevel('admin', userId, body.level ?? '', body.note);
  }
}
