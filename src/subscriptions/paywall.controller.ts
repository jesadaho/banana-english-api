import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import {
  ENV_PAYWALL_AB,
  ENV_PAYWALL_AB_START,
  PAYWALL_ARMS,
  PAYWALL_DEFAULT,
  PAYWALL_EXPERIMENT,
  paywallArmFor,
  parsePaywallAbSettings,
} from './paywall-ab';

type AuthedRequest = { user: User & { paywallArm?: string | null } };

/** Which plan the membership paywall preselects (A/B test, see paywall-ab.ts). */
@Controller('membership')
@UseGuards(AnonymousUserGuard)
export class PaywallController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('paywall')
  async paywall(@Req() req: AuthedRequest) {
    const settings = parsePaywallAbSettings(
      this.config.get<string>(ENV_PAYWALL_AB),
      this.config.get<string>(ENV_PAYWALL_AB_START),
    );
    const arm = paywallArmFor(req.user, settings);
    if (!arm) return { experiment: null, arm: null, ...PAYWALL_DEFAULT };
    if (req.user.paywallArm !== arm) {
      // First exposure: store the arm (never overwrite an existing one).
      await this.prisma.user.updateMany({
        where: { id: req.user.id, paywallArm: null },
        data: { paywallArm: arm, paywallArmAt: new Date() },
      });
    }
    const { plan, period, productId } = PAYWALL_ARMS[arm];
    return { experiment: PAYWALL_EXPERIMENT, arm, plan, period, productId };
  }
}
