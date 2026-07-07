import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { OpenAiService } from '../openai/openai.service';
import type {
  DailyReportResponse,
  HintsResponse,
  IntroReportResponse,
} from '../common/api.types';
import { SessionStoreService } from '../session-store/session-store.service';
import { getTopic } from '../topics/topics.data';
import { INTRO_TURN1_OPENING } from '../topics/intro_script';
import { StartSessionDto, TurnDto } from './dto/sessions.dto';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionStore: SessionStoreService,
    private readonly openai: OpenAiService,
  ) {}

  @Post()
  async startSession(@Body() body: StartSessionDto) {
    if (!getTopic(body.topicId)) {
      throw new NotFoundException('Topic not found');
    }

    const data = this.sessionStore.create(body.topicId);

    try {
      const reply =
        body.topicId === 'intro'
          ? INTRO_TURN1_OPENING
          : await this.openai.generateOpening(body.topicId);
      const opening = {
        speaker: 'ai' as const,
        textEn: reply.textEn,
        textTh: reply.textTh,
        audioUrl: null,
      };
      this.sessionStore.addTurn(data.session.id, opening);
      data.turns[data.turns.length - 1] = opening;

      return { session: data.session, opening };
    } catch (err) {
      throw new BadGatewayException(
        `AI service error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Post(':sessionId/turn')
  async processTurn(@Param('sessionId') sessionId: string, @Body() body: TurnDto) {
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }

    let userText = body.transcript.trim();
    if (!userText) {
      throw new BadRequestException('transcript is required');
    }

    try {
      if (body.thaiMixEnabled) {
        userText = await this.openai.correctThaiMix(userText);
      }

      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
      });

      const reply = await this.openai.generateReply(
        data.session.topicId,
        data.turns,
        userText,
      );

      const aiTurn = {
        speaker: 'ai' as const,
        textEn: reply.textEn,
        textTh: reply.textTh,
        audioUrl: null,
      };
      this.sessionStore.addTurn(sessionId, aiTurn);
      data.turns[data.turns.length - 1] = aiTurn;

      return aiTurn;
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      throw new BadGatewayException(
        `AI service error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Post(':sessionId/hints')
  async getHints(
    @Param('sessionId') sessionId: string,
  ): Promise<HintsResponse> {
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }

    try {
      const hints = await this.openai.generateHints(data.turns);
      return { hints };
    } catch (err) {
      throw new BadGatewayException(
        `AI service error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Post(':sessionId/end')
  async endSession(@Param('sessionId') sessionId: string) {
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }
    this.sessionStore.markEnded(sessionId);

    if (data.session.topicId === 'intro') {
      try {
        const introReport = await this.openai.generateIntroReport(data.turns);
        this.sessionStore.setIntroReport(sessionId, introReport);
        return { status: 'ended', introReport };
      } catch (err) {
        throw new BadGatewayException(
          `AI service error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { status: 'ended' };
  }

  @Get(':sessionId/intro-report')
  async getIntroReport(
    @Param('sessionId') sessionId: string,
  ): Promise<IntroReportResponse> {
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }
    if (data.session.topicId !== 'intro') {
      throw new BadRequestException('Not an introduction session');
    }

    if (data.introReport) {
      return { sessionId, ...data.introReport };
    }

    try {
      const report = await this.openai.generateIntroReport(data.turns);
      return { sessionId, ...report };
    } catch (err) {
      throw new BadGatewayException(
        `AI service error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Get(':sessionId/report')
  async getReport(
    @Param('sessionId') sessionId: string,
  ): Promise<DailyReportResponse> {
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }

    try {
      const ended = data.endedAt ?? new Date();
      const started = new Date(data.session.startedAt);
      let duration = Math.floor((ended.getTime() - started.getTime()) / 1000);
      duration = Math.min(duration, data.session.durationLimitSeconds);

      const report = await this.openai.generateReport(data.turns, duration);

      return {
        sessionId,
        feedbackEn: report.feedbackEn,
        feedbackTh: report.feedbackTh,
        grammarTip: report.grammarTip,
        vocab: report.vocab,
        durationSeconds: duration,
      };
    } catch (err) {
      throw new BadGatewayException(
        `AI service error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
