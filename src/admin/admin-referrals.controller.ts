import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReferralsService } from '../referrals/referrals.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { parseDateRange } from './admin-metrics.util';

@Controller('admin/metrics')
@UseGuards(AdminAuthGuard)
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('referrals')
  report(@Query('from') from?: string, @Query('to') to?: string) {
    let range;
    try {
      range = parseDateRange(from, to, 30);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid range');
    }
    return this.referrals.adminReport(range);
  }
}
