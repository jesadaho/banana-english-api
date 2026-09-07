import { Controller, Get, Header } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('public')
export class PublicStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('stats')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  marketing() {
    return this.stats.getPublicMarketingStats();
  }
}
