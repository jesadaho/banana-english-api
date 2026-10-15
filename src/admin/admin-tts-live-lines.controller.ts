import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TtsLiveLinesService } from '../tts/tts-live-lines.service';
import { parseDateRange } from './admin-metrics.util';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('admin/tts-live-lines')
@UseGuards(AdminAuthGuard)
export class AdminTtsLiveLinesController {
  constructor(private readonly lines: TtsLiveLinesService) {}

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('source') source?: string,
  ) {
    let range: { from: Date; to: Date };
    try {
      range = parseDateRange(from, to, 30);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date range',
      );
    }
    return this.lines.listForAdmin(range.from, range.to, source);
  }
}
