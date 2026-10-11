import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { ReferralsService } from './referrals.service';

type AuthedRequest = { user: User };

class ClaimReferralDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  source?: string;
}

class MarkRewardsSeenDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referralIds?: string[];
}

@Controller('referrals')
@UseGuards(AnonymousUserGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.referrals.getOverview(req.user.id);
  }

  @Post('claim')
  claim(@Req() req: AuthedRequest, @Body() body: ClaimReferralDto) {
    return this.referrals.claim(req.user.id, body?.code ?? '', body?.source);
  }

  @Post('rewards/seen')
  rewardsSeen(@Req() req: AuthedRequest, @Body() body?: MarkRewardsSeenDto) {
    const ids = Array.isArray(body?.referralIds)
      ? body.referralIds.filter((id): id is string => typeof id === 'string')
      : undefined;
    return this.referrals.markRewardsSeen(req.user.id, ids);
  }
}
