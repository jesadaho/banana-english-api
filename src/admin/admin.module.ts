import { Module } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';

@Module({
  controllers: [AdminMetricsController],
  providers: [AdminMetricsService, AdminAuthGuard],
})
export class AdminModule {}
