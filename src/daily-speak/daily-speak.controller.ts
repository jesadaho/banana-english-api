import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { DailySpeakFeedbackService } from './daily-speak-feedback.service';

type AuthedRequest = { user: User };

class DailySpeakFeedbackDto {
  transcript!: string;
  targetEn!: string;
  promptTh?: string;
  tipWord?: string;
  tipIpa?: string;
  tier?: string;
}

@Controller('daily-speak')
@UseGuards(AnonymousUserGuard)
export class DailySpeakController {
  constructor(
    private readonly economy: EconomyService,
    private readonly feedback: DailySpeakFeedbackService,
  ) {}

  @Post('complete')
  async complete(@Req() req: AuthedRequest) {
    return this.economy.applyDailySpeakRewards({
      userId: req.user.id,
    });
  }

  @Post('feedback')
  async feedbackForAttempt(@Body() body: DailySpeakFeedbackDto) {
    const transcript = body.transcript?.trim() ?? '';
    const targetEn = body.targetEn?.trim() ?? '';
    if (!transcript || !targetEn) {
      throw new BadRequestException('transcript and targetEn are required');
    }

    const feedbackTh = await this.feedback.generate({
      transcript,
      targetEn,
      promptTh: body.promptTh?.trim(),
      tipWord: body.tipWord?.trim(),
      tipIpa: body.tipIpa?.trim(),
      tier: body.tier?.trim(),
    });

    return { feedbackTh };
  }
}
