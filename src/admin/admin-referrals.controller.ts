import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  REFERRAL_PROGRAM_BANANA_V1,
  REFERRAL_PROGRAM_INVITE_V2,
  REFERRAL_PROGRAM_INVITE_V3,
} from '../referrals/referrals.constants';
import { ReferralsService } from '../referrals/referrals.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { parseDateRange } from './admin-metrics.util';

@Controller('admin/metrics')
@UseGuards(AdminAuthGuard)
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  /** Default program is Invite V3 (`invite_v3`). Pass `program=invite_v2` or `banana_v1` for older cohorts. */
  @Get('referrals')
  report(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('program') program?: string,
  ) {
    let range;
    try {
      range = parseDateRange(from, to, 30);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid range');
    }
    const raw = (program ?? '').trim();
    const prog =
      raw === REFERRAL_PROGRAM_BANANA_V1 || raw === REFERRAL_PROGRAM_INVITE_V2
        ? raw
        : REFERRAL_PROGRAM_INVITE_V3;
    return this.referrals.adminReport(range, prog);
  }
}
