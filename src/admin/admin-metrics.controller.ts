import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminMetricsService } from './admin-metrics.service';
import { parseMetricsFilters } from './admin-metrics.util';

@Controller('admin/metrics')
@UseGuards(AdminAuthGuard)
export class AdminMetricsController {
  constructor(private readonly metrics: AdminMetricsService) {}

  @Get('overview')
  overview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('requireOnboarding') requireOnboarding?: string,
    @Query('requireSignedIn') requireSignedIn?: string,
    @Query('requireAppOpen') requireAppOpen?: string,
    @Query('excludeUnsetSource') excludeUnsetSource?: string,
  ) {
    return this.metrics.overview(
      from,
      to,
      parseMetricsFilters({
        requireOnboarding,
        requireSignedIn,
        requireAppOpen,
        excludeUnsetSource,
      }),
    );
  }

  @Get('acquisition')
  acquisition(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('requireOnboarding') requireOnboarding?: string,
    @Query('requireSignedIn') requireSignedIn?: string,
    @Query('requireAppOpen') requireAppOpen?: string,
    @Query('excludeUnsetSource') excludeUnsetSource?: string,
  ) {
    return this.metrics.acquisition(
      from,
      to,
      parseMetricsFilters({
        requireOnboarding,
        requireSignedIn,
        requireAppOpen,
        excludeUnsetSource,
      }),
    );
  }

  @Get('content')
  content(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('requireOnboarding') requireOnboarding?: string,
    @Query('requireSignedIn') requireSignedIn?: string,
    @Query('requireAppOpen') requireAppOpen?: string,
    @Query('excludeUnsetSource') excludeUnsetSource?: string,
  ) {
    return this.metrics.content(
      from,
      to,
      parseMetricsFilters({
        requireOnboarding,
        requireSignedIn,
        requireAppOpen,
        excludeUnsetSource,
      }),
    );
  }

  @Get('economy')
  economy(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('requireOnboarding') requireOnboarding?: string,
    @Query('requireSignedIn') requireSignedIn?: string,
    @Query('requireAppOpen') requireAppOpen?: string,
    @Query('excludeUnsetSource') excludeUnsetSource?: string,
  ) {
    return this.metrics.economy(
      from,
      to,
      parseMetricsFilters({
        requireOnboarding,
        requireSignedIn,
        requireAppOpen,
        excludeUnsetSource,
      }),
    );
  }
}
