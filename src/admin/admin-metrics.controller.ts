import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminMetricsService } from './admin-metrics.service';

@Controller('admin/metrics')
@UseGuards(AdminAuthGuard)
export class AdminMetricsController {
  constructor(private readonly metrics: AdminMetricsService) {}

  @Get('overview')
  overview(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.metrics.overview(from, to);
  }

  @Get('acquisition')
  acquisition(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.metrics.acquisition(from, to);
  }

  @Get('content')
  content(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.metrics.content(from, to);
  }

  @Get('economy')
  economy(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.metrics.economy(from, to);
  }
}
