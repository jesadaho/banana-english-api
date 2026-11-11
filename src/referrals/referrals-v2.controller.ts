import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { ReferralsService } from './referrals.service';

type AuthedRequest = { user: User };

class ClaimReferralV2Dto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  source?: string;
}

class MarkRewardsSeenV2Dto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referralIds?: string[];
}

/** Invite-to-buy program. Banana v1 stays on `/referrals/*`. */
@Controller('referrals/v2')
@UseGuards(AnonymousUserGuard)
export class ReferralsV2Controller {
  constructor(private readonly referrals: ReferralsService) {}

  private assertEnabled() {
    if (!this.referrals.isInviteV2Enabled()) {
      throw new ServiceUnavailableException('invite_v2_disabled');
    }
  }

  @Get('me')
  me(@Req() req: AuthedRequest) {
    this.assertEnabled();
    return this.referrals.getOverviewV2(req.user.id);
  }

  @Post('claim')
  claim(@Req() req: AuthedRequest, @Body() body: ClaimReferralV2Dto) {
    this.assertEnabled();
    return this.referrals.claimV2(req.user.id, body?.code ?? '', body?.source);
  }

  @Post('rewards/seen')
  rewardsSeen(@Req() req: AuthedRequest, @Body() body?: MarkRewardsSeenV2Dto) {
    this.assertEnabled();
    const ids = Array.isArray(body?.referralIds)
      ? body.referralIds.filter((id): id is string => typeof id === 'string')
      : undefined;
    return this.referrals.markRewardsSeenV2(req.user.id, ids);
  }
}
