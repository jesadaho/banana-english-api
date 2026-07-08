import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';
import { GeminiTtsService } from '../gemini/gemini-tts.service';
import type {
  DailyReportResponse,
  HintsResponse,
  IntroReportResponse,
  StartSimulationResponse,
  TurnExchangeResponse,
} from '../common/api.types';
import { SessionStoreService } from '../session-store/session-store.service';
import { getTopic } from '../topics/topics.data';
import {
  INTRO_TURN1_OPENING,
  getTurn2Script,
  getTurn3Script,
} from '../topics/intro_script';
import {
  allCheckpointsComplete,
  applyPaymentClosureIfNeeded,
  getSimulation,
  mergeCheckpoints,
} from '../simulations/simulations.data';
import { StartSessionDto, TurnDto } from './dto/sessions.dto';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionStore: SessionStoreService,
    private readonly chat: GeminiChatService,
    private readonly geminiTts: GeminiTtsService,
  ) {}

  @Post()
  async startSession(@Body() body: StartSessionDto) {
    if (body.sessionType === 'simulation') {
      return this.startSimulationSession(body.simulationId!);
    }

    if (body.sessionType === 'training') {
      throw new BadRequestException('Training sessions are not yet supported');
    }

    if (!body.topicId || !getTopic(body.topicId)) {
      throw new NotFoundException('Topic not found');
    }

    const data = this.sessionStore.create(body.topicId);

    try {
      const reply =
        body.topicId === 'intro'
          ? INTRO_TURN1_OPENING
          : await this.chat.generateOpening(body.topicId);
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

  private async startSimulationSession(
    simulationId: string,
  ): Promise<StartSimulationResponse> {
    const config = getSimulation(simulationId);
    if (!config) {
      throw new NotFoundException('Simulation not found');
    }

    const data = this.sessionStore.createSimulation(config);

    try {
      const reply = await this.chat.generateSimulationOpening(config);
      const normalizedCheckpoints = this.normalizeCheckpoints(
        config.successCriteria,
        reply.updatedCheckpoints,
      );

      const openingTurn = {
        speaker: 'ai' as const,
        textEn: reply.aiResponse,
        textTh: reply.textTh,
        audioUrl: null,
      };
      this.sessionStore.addTurn(data.session.id, openingTurn);

      const opening: TurnExchangeResponse = {
        aiResponse: reply.aiResponse,
        textTh: reply.textTh,
        isTaskComplete: false,
        updatedCheckpoints: normalizedCheckpoints,
        feedbackHints: {
          grammarTip: reply.feedbackHints.grammarTip,
          mispronouncedWords: reply.feedbackHints.mispronouncedWords ?? [],
        },
        currentTurn: 0,
      };

      return {
        session: {
          id: data.session.id,
          sessionType: 'simulation',
          simulationId: config.simulationId,
          startedAt: data.session.startedAt,
          currentTurn: 0,
          maxTurns: config.maxTurns,
          checkpointStates: data.session.checkpointStates!,
          isComplete: false,
        },
        simulation: config,
        opening,
      };
    } catch (err) {
      throw new BadGatewayException(
        `AI service error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Post(':sessionId/turn')
  async processTurn(
    @Param('sessionId') sessionId: string,
    @Body() body: TurnDto,
  ) {
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }

    if (data.session.sessionType === 'simulation') {
      return this.processSimulationTurn(sessionId, body);
    }

    return this.processLegacyTurn(sessionId, body);
  }

  private async processSimulationTurn(
    sessionId: string,
    body: TurnDto,
  ): Promise<TurnExchangeResponse> {
    const data = this.sessionStore.get(sessionId)!;
    const config = data.simulationConfig;
    if (!config) {
      throw new BadRequestException('Simulation config missing');
    }

    if (data.session.isComplete) {
      throw new ConflictException('Session already complete');
    }

    const expectedTurn = data.session.currentTurn ?? 0;
    if (body.currentTurn !== undefined && body.currentTurn !== expectedTurn) {
      throw new ConflictException(
        `Stale turn: expected ${expectedTurn}, got ${body.currentTurn}`,
      );
    }

    let userText = (body.userSpeechText ?? body.transcript ?? '').trim();
    if (!userText) {
      throw new BadRequestException('userSpeechText is required');
    }

    try {
      if (body.thaiMixEnabled) {
        userText = await this.chat.correctThaiMix(userText);
      }

      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
      });

      const nextTurn = expectedTurn + 1;
      const reply = await this.chat.generateSimulationTurn(
        config,
        data.turns,
        userText,
        data.session.checkpointStates ?? {},
        nextTurn,
      );

      const mergedCheckpoints = applyPaymentClosureIfNeeded(
        config,
        userText,
        mergeCheckpoints(
          data.session.checkpointStates ?? {},
          this.normalizeCheckpoints(
            config.successCriteria,
            reply.updatedCheckpoints,
          ),
        ),
      );

      const allComplete = allCheckpointsComplete(mergedCheckpoints);
      const maxTurnsReached = nextTurn >= (data.session.maxTurns ?? config.maxTurns);
      const isTaskComplete = allComplete || maxTurnsReached;

      this.sessionStore.updateSimulationState(sessionId, {
        currentTurn: nextTurn,
        checkpointStates: mergedCheckpoints,
        isComplete: isTaskComplete,
      });

      const aiTurn = {
        speaker: 'ai' as const,
        textEn: reply.aiResponse,
        textTh: reply.textTh,
        audioUrl: null,
      };
      this.sessionStore.addTurn(sessionId, aiTurn);

      const response: TurnExchangeResponse = {
        aiResponse: reply.aiResponse,
        textTh: reply.textTh,
        isTaskComplete,
        updatedCheckpoints: mergedCheckpoints,
        feedbackHints: {
          grammarTip: reply.feedbackHints.grammarTip,
          mispronouncedWords: reply.feedbackHints.mispronouncedWords ?? [],
        },
        currentTurn: nextTurn,
      };

      if (body.generateAudio) {
        const audio = await this.geminiTts.synthesizeSpeech(reply.aiResponse);
        response.audioBase64 = audio.toString('base64');
        response.contentType = 'audio/wav';
      }

      return response;
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof ConflictException
      ) {
        throw err;
      }
      throw new BadGatewayException(
        `AI service error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async processLegacyTurn(
    sessionId: string,
    body: TurnDto,
  ) {
    const data = this.sessionStore.get(sessionId)!;

    let userText = (body.transcript ?? body.userSpeechText ?? '').trim();
    if (!userText) {
      throw new BadRequestException('transcript is required');
    }

    try {
      if (body.thaiMixEnabled) {
        userText = await this.chat.correctThaiMix(userText);
      }

      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
      });

      const userTurnCount = data.turns.filter(
        (turn) => turn.speaker === 'user',
      ).length;

      const topicId = data.session.topicId ?? 'coffee';
      const reply =
        topicId === 'intro' && userTurnCount === 1
          ? getTurn2Script(userText)
          : topicId === 'intro' && userTurnCount === 2
            ? getTurn3Script(userText)
            : await this.chat.generateReply(topicId, data.turns, userText);

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

  private normalizeCheckpoints(
    criteria: string[],
    updated: Record<string, boolean>,
  ): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const key of criteria) {
      result[key] = Boolean(updated[key]);
    }
    return result;
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
      const hints = await this.chat.generateHints(data.turns);
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
        const introReport = await this.chat.generateIntroReport(data.turns);
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
      const report = await this.chat.generateIntroReport(data.turns);
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

      if (data.session.sessionType === 'simulation' && data.simulationConfig) {
        const config = data.simulationConfig;
        const checkpoints = data.session.checkpointStates ?? {};
        const completedCount = Object.values(checkpoints).filter(Boolean).length;
        const totalCount = Object.keys(checkpoints).length;
        const overallScore =
          totalCount > 0
            ? Math.round((completedCount / totalCount) * 100)
            : 0;
        const scoreLabel =
          overallScore >= 90
            ? 'Excellent'
            : overallScore >= 70
              ? 'Good'
              : overallScore >= 50
                ? 'Fair'
                : 'Keep Trying';

        duration = Math.min(duration, config.estimatedMinutes * 60);

        const report = await this.chat.generateReport(data.turns, duration);

        return {
          sessionId,
          feedbackEn: report.feedbackEn,
          feedbackTh: report.feedbackTh,
          grammarTip: report.grammarTip,
          vocab: report.vocab,
          durationSeconds: duration,
          topicId: config.simulationId,
          missionTitleTh: config.missionTitleTh,
          overallScore,
          scoreLabel,
          goldBananasEarned: allCheckpointsComplete(checkpoints) ? 1 : 0,
          checkpointSummary: checkpoints,
        };
      }

      duration = Math.min(
        duration,
        data.session.durationLimitSeconds ?? duration,
      );

      const report = await this.chat.generateReport(data.turns, duration);

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
