import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnonymousUserGuard } from './anonymous-user.guard';
import {
  ENV_NOTIFY_ASK_AB,
  ENV_NOTIFY_ASK_AB_START,
  NOTIFY_ASK_EXPERIMENT,
  notifyAskArmFor,
  parseNotifyAskAbSettings,
} from './notify-ask-ab';

type AuthedRequest = { user: User & { notifyAskArm?: string | null } };

/** When to first ask for notifications (A/B test, see notify-ask-ab.ts). */
@Controller('onboarding')
@UseGuards(AnonymousUserGuard)
export class NotifyAskController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('notify-ask')
  async notifyAsk(@Req() req: AuthedRequest) {
    const settings = parseNotifyAskAbSettings(
      this.config.get<string>(ENV_NOTIFY_ASK_AB),
      this.config.get<string>(ENV_NOTIFY_ASK_AB_START),
    );
    const arm = notifyAskArmFor(req.user, settings);
    if (!arm) return { experiment: null, arm: null, firstAsk: 'placement' };
    if (req.user.notifyAskArm !== arm) {
      await this.prisma.user.updateMany({
        where: { id: req.user.id, notifyAskArm: null },
        data: { notifyAskArm: arm },
      });
    }
    return {
      experiment: NOTIFY_ASK_EXPERIMENT,
      arm,
      firstAsk: arm === 'A' ? 'placement' : 'lesson',
    };
  }
}
