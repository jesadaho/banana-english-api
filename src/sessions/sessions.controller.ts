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
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { GeminiChatService } from '../gemini/gemini-chat.service';
import { GeminiTtsService } from '../gemini/gemini-tts.service';
import type {
  MissionResultResponse,
  HintsResponse,
  IntroReportResponse,
  StartSimulationResponse,
  TurnExchangeResponse,
} from '../common/api.types';
import { SessionStoreService } from '../session-store/session-store.service';
import { FALLBACK_HINTS, getTopic } from '../topics/topics.data';
import {
  INTRO_TURN1_OPENING,
  getTurn2Script,
  getTurn3Script,
} from '../topics/intro_script';
import {
  allCheckpointsComplete,
  applyPaymentClosureFromAiReply,
  applyPaymentClosureIfNeeded,
  getSimulation,
  mergeCheckpoints,
} from '../simulations/simulations.data';
import { StartSessionDto, TurnDto } from './dto/sessions.dto';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { EconomyService } from '../economy/economy.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { getMissionReward } from '../economy/economy.constants';
import { getUserLocalTime, isSameDateKey } from '../common/timezone.util';

type AuthedRequest = { user: User };

@Controller('sessions')
@UseGuards(AnonymousUserGuard)
export class SessionsController {
  constructor(
    private readonly sessionStore: SessionStoreService,
    private readonly chat: GeminiChatService,
    private readonly geminiTts: GeminiTtsService,
    private readonly economy: EconomyService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async startSession(
    @Req() req: AuthedRequest,
    @Body() body: StartSessionDto,
  ) {
    if (body.sessionType === 'simulation') {
      return this.startSimulationSession(
        req.user,
        body.simulationId!,
        body.isDailyMission ?? false,
      );
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
    user: User,
    simulationId: string,
    isDailyMission: boolean,
  ): Promise<StartSimulationResponse> {
    const config = getSimulation(simulationId);
    if (!config) {
      throw new NotFoundException('Simulation not found');
    }

    if (isDailyMission) {
      const local = getUserLocalTime(user.timezone);
      if (isSameDateKey(user.dailyMissionUsedDate, local.dateKey)) {
        throw new BadRequestException('Daily mission already used today');
      }
    }

    await this.economy.spendBananas(user.id, config.bananaCost, simulationId);

    const data = this.sessionStore.createSimulation(config);

    await this.prisma.userSession.create({
      data: {
        id: data.session.id,
        userId: user.id,
        sessionType: 'simulation',
        simulationId: config.simulationId,
        isDailyMission,
      },
    });

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

      const mergedCheckpoints = applyPaymentClosureFromAiReply(
        config,
        reply.aiResponse,
        applyPaymentClosureIfNeeded(
          config,
          userText,
          mergeCheckpoints(
            data.session.checkpointStates ?? {},
            this.normalizeCheckpoints(
              config.successCriteria,
              reply.updatedCheckpoints,
            ),
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
      if (hints.length > 0) {
        return { hints };
      }
    } catch (err) {
      // Fall through to static hints — better than an empty sheet for the learner.
    }

    return { hints: FALLBACK_HINTS };
  }

  @Post(':sessionId/end')
  async endSession(
    @Req() req: AuthedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }
    this.sessionStore.markEnded(sessionId);

    if (data.session.topicId === 'intro') {
      try {
        const introReport = await this.chat.generateIntroReport(data.turns);
        this.sessionStore.setIntroReport(sessionId, introReport);
        await this.users.updateDisplayName(req.user.id, introReport.userName);
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
    @Req() req: AuthedRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<MissionResultResponse> {
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
        const rewardTier = getMissionReward(overallScore);

        duration = Math.min(duration, config.estimatedMinutes * 60);

        const report = await this.chat.generateReport(data.turns, duration);

        const userSession = await this.prisma.userSession.findUnique({
          where: { id: sessionId },
        });

        let rewards;
        if (
          userSession &&
          userSession.userId === req.user.id &&
          !userSession.rewardsApplied
        ) {
          rewards = await this.economy.applyMissionRewards({
            userId: req.user.id,
            sessionId,
            overallScore,
            isDailyMission: userSession.isDailyMission,
          });
        } else if (userSession?.rewardsApplied) {
          const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: req.user.id },
          });
          rewards = {
            xpEarned: rewardTier.xp,
            seedsEarned: rewardTier.seeds,
            ratingLabel: rewardTier.ratingLabel,
            streakDays: user.streakDays,
            previousStreakDays: user.streakDays,
            balances: this.economy.toBalances(user),
            isDailyMission: userSession.isDailyMission,
          };
        }

        return {
          sessionId,
          feedbackEn: report.feedbackEn,
          feedbackTh: report.feedbackTh,
          bestSentenceEn: report.bestSentenceEn,
          bestSentenceNoteTh: report.bestSentenceNoteTh,
          grammarTip: report.grammarTip,
          grammarTipTh: report.grammarTipTh,
          pronunciationIssues: report.pronunciationIssues,
          vocab: report.vocab,
          durationSeconds: duration,
          topicId: config.simulationId,
          missionTitleTh: config.missionTitleTh,
          overallScore,
          scoreLabel: rewardTier.ratingLabel,
          goldBananasEarned: rewards?.xpEarned ?? rewardTier.xp,
          checkpointSummary: checkpoints,
          rewards,
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
        bestSentenceEn: report.bestSentenceEn,
        bestSentenceNoteTh: report.bestSentenceNoteTh,
        grammarTip: report.grammarTip,
        grammarTipTh: report.grammarTipTh,
        pronunciationIssues: report.pronunciationIssues,
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
