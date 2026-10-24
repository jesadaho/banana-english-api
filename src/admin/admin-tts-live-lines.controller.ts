import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TtsLiveLinesService } from '../tts/tts-live-lines.service';
import { parseDateRange } from './admin-metrics.util';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('admin/tts-live-lines')
@UseGuards(AdminAuthGuard)
export class AdminTtsLiveLinesController {
  constructor(private readonly lines: TtsLiveLinesService) {}

  /**
   * `since` / `until` (ISO datetimes) narrow to an exact time window and win
   * over the calendar-day `from` / `to` range.
   */
  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('source') source?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    let range: { from: Date; to: Date };
    try {
      range = since ? parseTimeWindow(since, until) : parseDateRange(from, to, 30);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date range',
      );
    }
    return this.lines.listForAdmin(range.from, range.to, source);
  }
}

function parseTimeWindow(sinceRaw: string, untilRaw?: string): { from: Date; to: Date } {
  const from = new Date(sinceRaw);
  const to = untilRaw ? new Date(untilRaw) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid since/until time');
  }
  if (from > to) {
    throw new Error('since must be <= until');
  }
  return { from, to };
}
