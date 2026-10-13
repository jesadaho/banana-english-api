import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('admin/subscriptions')
@UseGuards(AdminAuthGuard)
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list() {
    return this.subscriptions.adminReport();
  }

  @Get('users')
  search(@Query('q') q?: string) {
    return this.subscriptions.searchForAdmin(q);
  }

  @Get('users/:userId')
  info(@Param('userId') userId: string) {
    return this.subscriptions.userInfo(userId);
  }

  @Post('grant')
  grant(
    @Body()
    body: {
      userId?: string;
      tier?: string;
      expiresAt?: string;
      note?: string;
      priceThb?: number;
      source?: string;
    },
  ) {
    const userId = body.userId?.trim();
    if (!userId) throw new BadRequestException('Missing userId');
    if (body.tier !== 'PRO' && body.tier !== 'PRO_MAX') {
      throw new BadRequestException('tier must be PRO or PRO_MAX');
    }
    const source = body.source?.trim() || 'admin';
    if (source !== 'admin' && source !== 'founder_presale') {
      throw new BadRequestException('source must be admin or founder_presale');
    }
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('expiresAt must be an ISO date');
    }
    return this.subscriptions.grant({
      userId,
      tier: body.tier,
      expiresAt,
      source,
      note: body.note,
      priceThb: body.priceThb,
    });
  }

  @Post('revoke')
  revoke(@Body() body: { userId?: string }) {
    const userId = body.userId?.trim();
    if (!userId) throw new BadRequestException('Missing userId');
    return this.subscriptions.revoke(userId);
  }
}
