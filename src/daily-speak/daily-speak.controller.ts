import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import {
  DailySpeakFeedbackService,
  type DailySpeakDiagnosisPayload,
} from './daily-speak-feedback.service';
import { DailySpeakService } from './daily-speak.service';

type AuthedRequest = { user: User };

class DailySpeakFeedbackDto {
  /** Preferred: full local diagnosis. */
  diagnosis?: DailySpeakDiagnosisPayload;

  /** Legacy flat fields (still accepted). */
  transcript?: string;
  targetEn?: string;
  promptTh?: string;
  tipWord?: string;
  tipIpa?: string;
  tier?: string;
  reviewCase?: string;
  missingWords?: string[];
  extraWords?: string[];
  wrongWords?: string[];
  pronunciationIssues?: string[];
  listenLines?: string[];
}

@Controller('daily-speak')
@UseGuards(AnonymousUserGuard)
export class DailySpeakController {
  constructor(
    private readonly economy: EconomyService,
    private readonly feedback: DailySpeakFeedbackService,
    private readonly dailySpeak: DailySpeakService,
  ) {}

  /** Today's sentence for this user (mapped from dailySpeakCount). */
  @Get('today')
  today(@Req() req: AuthedRequest) {
    return this.dailySpeak.todayForUser(req.user);
  }

  @Post('complete')
  async complete(@Req() req: AuthedRequest) {
    return this.economy.applyDailySpeakRewards({
      userId: req.user.id,
    });
  }

  @Post('feedback')
  async feedbackForAttempt(@Body() body: DailySpeakFeedbackDto) {
    const diagnosis: DailySpeakDiagnosisPayload = body.diagnosis ?? {
      target: body.targetEn?.trim() ?? '',
      transcript: body.transcript?.trim() ?? '',
      tier: body.tier?.trim(),
      reviewCase: body.reviewCase?.trim() ?? 'almost',
      missingWords: body.missingWords ?? [],
      extraWords: body.extraWords ?? [],
      wrongWords: body.wrongWords ?? [],
      pronunciationIssues: body.pronunciationIssues ?? [],
      listenLines: body.listenLines ?? [],
    };

    if (!diagnosis.target?.trim() || !diagnosis.reviewCase?.trim()) {
      throw new BadRequestException('diagnosis.target and reviewCase are required');
    }

    // Unclear may have empty transcript — still OK.
    if (
      diagnosis.reviewCase !== 'unclear' &&
      !diagnosis.transcript?.trim()
    ) {
      throw new BadRequestException('diagnosis.transcript is required');
    }

    const feedbackTh = await this.feedback.generate({ diagnosis });
    return { feedbackTh };
  }
}
