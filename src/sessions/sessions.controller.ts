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
import { formatAiServiceUserMessage } from '../common/ai-user-message';
import { Prisma, User } from '@prisma/client';
import { GeminiChatService } from '../gemini/gemini-chat.service';
import { GeminiTtsService } from '../gemini/gemini-tts.service';
import type {
  MissionResultResponse,
  HintsResponse,
  IntroReportResponse,
  StartSimulationResponse,
  StoredChatTurn,
  TurnExchangeResponse,
  TurnFeedbackItem,
} from '../common/api.types';
import {
  EMOJI_SPEAK_COMPLETE_SENTINEL,
  EMOJI_SPEAK_COMPLETE_TURN_TEXT,
  TAP_TO_CONTINUE_SENTINEL,
  TAP_TO_CONTINUE_TURN_TEXT,
} from '../common/api.types';
import {
  ChatTurn,
  SessionStoreService,
} from '../session-store/session-store.service';
import { FALLBACK_HINTS, getTopic, normalizeFreeTalkLanguageLevel } from '../topics/topics.data';
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
import {
  emojiSpeakSetForTrainingTurn,
  enrichEmojiSpeakForLesson,
  normalizeEmojiChoice,
  normalizeGuidedSpeaking,
  normalizeRoleplayIntro,
  normalizeRoleplayNpc,
  forceExploreCityGuidedSpeakingIfNeeded,
  guideExploreCityRoleplayIfNeeded,
  guideScriptedAroundTownRoleplayIfNeeded,
  forceRestaurantRoleplayBridgeIfNeeded,
  forceTransportDestinationMiniIfNeeded,
  forceTransportPattern2IfNeeded,
  forceTransportRoleplayBridgeIfNeeded,
  forceShoppingLookingForSoftTeachIfNeeded,
  ensureExploreCityCelebratePraiseFirst,
  forceExploreCityCelebrateAfterCloseIfNeeded,
  EXPLORE_CITY_ROLEPLAY_OBJECTIVE,
  SHOPPING_ROLEPLAY_OBJECTIVE,
  RESTAURANT_ROLEPLAY_OBJECTIVE,
  COFFEE_ROLEPLAY_OBJECTIVE,
  TRANSPORT_ROLEPLAY_OBJECTIVE,
  FAVORITES_ROLEPLAY_OBJECTIVE,
  aroundTownRoleplayIntroSpeech,
  forceShoppingRoleplayBridgeIfNeeded,
  forceCoffeeRoleplayBridgeIfNeeded,
  forceFavoritesRoleplayBridgeIfNeeded,
  forceSmartShopperGuidedSpeakingIfNeeded,
  forceSmartShopperCelebrateIfNeeded,
  forceDailyRoutineGuidedSpeakingIfNeeded,
  forceFoodGuidedSpeakingIfNeeded,
  forceFoodCelebrateIfNeeded,
  forceHomeGuidedSpeakingIfNeeded,
  forceHomeCelebrateIfNeeded,
  FOOD_FAVORITE_GUIDED_SPEAKING,
  HOME_TYPE_GUIDED_SPEAKING,
  foodFavoriteOpeningText,
  homeOpeningText,
  forceSurvivalEmojiSpeakIfNeeded,
  forceSurvivalCelebrateAfterEmojiSpeakIfNeeded,
  looksLikeAroundTownRoleplayBridge,
  sanitizeAroundTownStaffSpeech,
  isAroundTownRoleplayCloseLine,
  isAroundTownRoleplayEndListenTurn,
  TRANSPORT_HOOK_GUIDED_SPEAKING,
  transportHookOpeningText,
  getLesson,
  getLessonBananaCost,
  isPronunciationLesson,
  lessonUsesTapToContinue,
  normalizeLessonTeachingLanguage,
  withEmojiRecall2Seed,
  withTeachingLanguage,
} from '../lessons/lessons.data';
import {
  learnerNameFallback,
  teachingLanguageFromConfig,
} from '../lessons/lesson-prompt';
import { LessonsService } from '../lessons/lessons.service';
import { StartSessionDto, TurnDto } from './dto/sessions.dto';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { EconomyService } from '../economy/economy.service';
import { freeTalkBananaCost } from '../economy/economy.constants';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { SeriesService } from '../series/series.service';
import { getMissionReward, getStarRating } from '../economy/economy.constants';
import { getUserLocalTime, isSameDateKey } from '../common/timezone.util';
import { getSeriesForSimulation } from '../series/series.data';
import { ActivityService } from '../users/activity.service';
import { AchievementsService } from '../achievements/achievements.service';

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
    private readonly seriesService: SeriesService,
    private readonly lessonsService: LessonsService,
    private readonly activity: ActivityService,
    private readonly achievements: AchievementsService,
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
      return this.startTrainingSession(
        req.user,
        body.lessonId!,
        body.teachingLanguage,
      );
    }

    if (!body.topicId || !getTopic(body.topicId)) {
      throw new NotFoundException('Topic not found');
    }

    if (body.topicId === 'free_talk') {
      const durationMinutes = body.durationMinutes === 10 ? 10 : 5;
      const bananaCost = freeTalkBananaCost(durationMinutes);
      const languageLevel = normalizeFreeTalkLanguageLevel(body.languageLevel);
      await this.economy.spendBananas(
        req.user.id,
        bananaCost,
        'free_talk',
        'free_talk_start',
      );
      const priorMemories = await this.users.getFreeTalkMemories(req.user.id);
      const learnerFirstName = firstNameFromDisplayName(req.user.displayName);
      const data = this.sessionStore.create(body.topicId, {
        durationLimitSeconds: durationMinutes * 60,
        freeTalk: {
          languageLevel,
          priorMemories,
        },
      });

      try {
        const reply = await this.chat.generateFreeTalkOpening({
          languageLevel,
          memories: priorMemories,
          learnerFirstName,
        });
        const opening = {
          speaker: 'ai' as const,
          textEn: reply.textEn,
          textTh: reply.textTh,
          audioUrl: null,
        };
        this.sessionStore.addTurn(data.session.id, opening);
        data.turns[data.turns.length - 1] = opening;
        this.sessionStore.updateFreeTalkState(data.session.id, {
          phase: (reply.phase as 'greeting') || 'greeting',
          topic: reply.topic || null,
          nextAction: (reply.nextAction as 'explore') || 'explore',
        });

        return { session: data.session, opening };
      } catch (err) {
        throw new BadGatewayException(formatAiServiceUserMessage(err));
      }
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
      throw new BadGatewayException(formatAiServiceUserMessage(err));
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

    const unlocked = await this.seriesService.isSimulationUnlockedForUser(
      user.id,
      simulationId,
    );
    if (!unlocked) {
      throw new BadRequestException('Series locked');
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
      throw new BadGatewayException(formatAiServiceUserMessage(err));
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

    if (data.session.sessionType === 'training') {
      return this.processTrainingTurn(sessionId, body);
    }

    return this.processLegacyTurn(sessionId, body);
  }

  private async startTrainingSession(
    user: User,
    lessonId: string,
    teachingLanguageRaw?: string,
  ) {
    const baseConfig = getLesson(lessonId);
    if (!baseConfig) {
      throw new NotFoundException('Lesson not found');
    }

    const teachingLanguage = normalizeLessonTeachingLanguage(
      teachingLanguageRaw ??
        (user as User & { lessonTeachingLanguage?: string })
          .lessonTeachingLanguage,
    );
    const config = withEmojiRecall2Seed(
      withTeachingLanguage(baseConfig, teachingLanguage),
    );

    const unlocked = await this.lessonsService.isLessonUnlockedForUser(
      user.id,
      lessonId,
    );
    if (!unlocked) {
      throw new BadRequestException('Lesson locked');
    }

    const bananaCost = getLessonBananaCost(config);
    await this.economy.spendBananas(user.id, bananaCost, lessonId, 'lesson_start');

    const learnerFirstName = firstNameFromDisplayName(
      user.displayName,
      teachingLanguage,
    );
    const data = this.sessionStore.createTraining(config, learnerFirstName);

    await this.prisma.userSession.create({
      data: {
        id: data.session.id,
        userId: user.id,
        sessionType: 'training',
        lessonId: config.lessonId,
        teachingLanguage,
      } as Prisma.UserSessionUncheckedCreateInput,
    });

    try {
      const reply = await this.chat.generateTrainingOpening(
        config,
        learnerFirstName,
      );
      // Tap-to-continue lessons (pronunciation / Everyday Life) always open
      // listen-only so the mic stays hidden on the first tutor turn —
      // except Transportation 2.5 Hook which asks destination with a board.
      const openingExpectsUserSpeech =
        config.lessonId === 'ee_around_town_transport'
          ? true
          : lessonUsesTapToContinue(config.lessonId)
            ? false
            : (reply.expectsUserSpeech ?? true);
      // Hook / opening must stay listen-only — never attach emojiChoice /
      // guidedSpeaking / roleplayIntro or force the mic just because the model
      // prematurely returned scaffolds — except Transport Hook (speak + board).
      let openingEmojiChoice = openingExpectsUserSpeech
        ? normalizeEmojiChoice(reply.emojiChoice)
        : null;
      let openingGuidedSpeaking = openingExpectsUserSpeech
        ? normalizeGuidedSpeaking(reply.guidedSpeaking)
        : null;
      if (config.lessonId === 'ee_around_town_transport') {
        // Pin Visual Completion 4-city stem (never fall back to flat emojiChoice).
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: TRANSPORT_HOOK_GUIDED_SPEAKING.stem,
          options: [...TRANSPORT_HOOK_GUIDED_SPEAKING.options],
        });
        openingEmojiChoice = null;
      }
      if (config.lessonId === 'ee_about_me_food') {
        // Pin Favorite Food board on opening (I like pizza/sushi/somtam).
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: FOOD_FAVORITE_GUIDED_SPEAKING.stem,
          options: FOOD_FAVORITE_GUIDED_SPEAKING.options.map((o) => ({
            ...o,
          })),
        });
        openingEmojiChoice = null;
      }
      if (config.lessonId === 'ee_about_me_home') {
        // Pin Home Type board on opening (Apartment/House).
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: HOME_TYPE_GUIDED_SPEAKING.stem,
          options: HOME_TYPE_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
        });
        openingEmojiChoice = null;
      }
      // Opening is Hook — never start mid-roleplay.
      const openingRoleplayIntro = null;
      const openingRoleplayNpc = null;
      const openingTextEn =
        config.lessonId === 'ee_around_town_transport'
          ? transportHookOpeningText(teachingLanguage, learnerFirstName)
          : config.lessonId === 'ee_about_me_food'
            ? foodFavoriteOpeningText(learnerFirstName)
            : config.lessonId === 'ee_about_me_home'
              ? homeOpeningText()
              : reply.textEn;
      const openingExpectsSpeechFinal =
        config.lessonId === 'ee_about_me_food' ||
        config.lessonId === 'ee_about_me_home'
          ? true
          : openingExpectsUserSpeech;
      const openingExpectedSpeechFinal =
        config.lessonId === 'ee_about_me_food'
          ? 'I like pizza.'
          : config.lessonId === 'ee_about_me_home'
            ? 'I live in an apartment.'
            : openingExpectsSpeechFinal
              ? reply.expectedSpeech?.trim() || null
              : null;
      const opening = {
        speaker: 'ai' as const,
        textEn: openingTextEn,
        textTh:
          config.lessonId === 'ee_around_town_transport' ||
          config.lessonId === 'ee_about_me_food' ||
          config.lessonId === 'ee_about_me_home'
            ? null
            : reply.textTh,
        audioUrl: null,
        expectsUserSpeech: openingExpectsSpeechFinal,
        expectedSpeech: openingExpectedSpeechFinal,
        scene: reply.scene ?? null,
        emojiSpeak: enrichEmojiSpeakForLesson(
          config.lessonId,
          reply.emojiSpeak,
        ),
        emojiChoice: openingEmojiChoice,
        guidedSpeaking: openingGuidedSpeaking,
        roleplayIntro: openingRoleplayIntro,
        roleplayNpc: openingRoleplayNpc,
      };
      this.sessionStore.addTurn(data.session.id, opening);

      return {
        session: {
          id: data.session.id,
          sessionType: 'training' as const,
          lessonId: config.lessonId,
          startedAt: data.session.startedAt,
          currentTurn: 0,
          maxTurns: config.maxTurns,
          isComplete: false,
        },
        lesson: {
          lessonId: config.lessonId,
          titleEn: config.titleEn,
          titleTh: config.titleTh,
          difficulty: config.difficulty,
          estimatedMinutesMin: config.estimatedMinutesMin,
          estimatedMinutesMax: config.estimatedMinutesMax,
          targetPhrases: config.targetPhrases,
          maxTurns: config.maxTurns,
        },
        opening: {
          aiResponse: openingTextEn,
          textTh:
            config.lessonId === 'ee_around_town_transport' ||
            config.lessonId === 'ee_about_me_food' ||
            config.lessonId === 'ee_about_me_home'
              ? null
              : reply.textTh,
          isTaskComplete: false,
          updatedCheckpoints: {},
          feedbackHints: { mispronouncedWords: [] as string[] },
          currentTurn: 0,
          expectsUserSpeech: openingExpectsSpeechFinal,
          expectedSpeech: openingExpectedSpeechFinal,
          scene: reply.scene,
          emojiSpeak: enrichEmojiSpeakForLesson(
            config.lessonId,
            reply.emojiSpeak,
          ),
          emojiChoice: openingEmojiChoice,
          guidedSpeaking: openingGuidedSpeaking,
          roleplayIntro: openingRoleplayIntro,
          roleplayNpc: openingRoleplayNpc,
        },
      };
    } catch (err) {
      throw new BadGatewayException(formatAiServiceUserMessage(err));
    }
  }

  private async processTrainingTurn(
    sessionId: string,
    body: TurnDto,
  ): Promise<TurnExchangeResponse> {
    const data = this.sessionStore.get(sessionId)!;
    const config = data.lessonConfig;
    if (!config) {
      throw new BadRequestException('Lesson config missing');
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

    let originalText = (body.userSpeechText ?? body.transcript ?? '').trim();
    if (!originalText) {
      throw new BadRequestException('userSpeechText is required');
    }

    // Continue / Emoji Speak complete are not speech — skip Thai-mix repair.
    const isTapToContinue = originalText === TAP_TO_CONTINUE_SENTINEL;
    const isEmojiSpeakComplete =
      originalText === EMOJI_SPEAK_COMPLETE_SENTINEL;
    if (isTapToContinue) {
      originalText = TAP_TO_CONTINUE_TURN_TEXT;
    } else if (isEmojiSpeakComplete) {
      originalText = EMOJI_SPEAK_COMPLETE_TURN_TEXT;
    }

    let userText = originalText;
    try {
      // Pronunciation lessons match exact target words — Thai-mix "repair"
      // can rewrite a correct "Seat." into something else and falsely fail.
      const skipThaiMix =
        isTapToContinue ||
        isEmojiSpeakComplete ||
        isPronunciationLesson(config.lessonId);
      if (body.thaiMixEnabled && !skipThaiMix) {
        this.sessionStore.markThaiMixUsed(sessionId);
        userText = await this.chat.correctThaiMix(originalText);
      }

      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
        originalTextEn: originalText,
      });

      const nextTurn = expectedTurn + 1;
      const reply = await this.chat.generateTrainingTurn(
        config,
        data.turns,
        userText,
        nextTurn,
        data.learnerFirstName ??
          learnerNameFallback(teachingLanguageFromConfig(config)),
        originalText,
      );

      const maxTurnsReached = nextTurn >= config.maxTurns;
      let isTaskComplete = Boolean(reply.isLessonComplete) || maxTurnsReached;

      // Scripted opening steps (overview / listen / explain / tip) never ask
      // for speech, so don't let a model slip put the mic in front of the
      // learner. nextTurn 1 is the tutor turn right after the opening.
      const inListenOnlyIntro = nextTurn < (config.listenOnlyTurns ?? 0);
      let expectsUserSpeech =
        isTaskComplete || inListenOnlyIntro
          ? false
          : (reply.expectsUserSpeech ?? true);

      // Stories 3.1: after Hook + Emoji Intro, the next turn must be Pattern
      // Challenge speak — never re-open as listen-only Intro.
      if (
        config.lessonId === 'ee_stories_yesterday' &&
        nextTurn >= 2 &&
        !isTaskComplete &&
        isEmojiSpeakComplete
      ) {
        expectsUserSpeech = true;
      }

      const emojiSpeak = enrichEmojiSpeakForLesson(
        config.lessonId,
        reply.emojiSpeak,
      );
      // Stories 3.1: only inject the batch on turn 1. Ignore model emojiSpeakSet
      // on later turns so the app does not replay the puzzle after Continue.
      const forcedSet = emojiSpeakSetForTrainingTurn(
        config.lessonId,
        nextTurn,
      );
      let emojiSpeakSet =
        forcedSet ??
        (config.lessonId === 'ee_stories_yesterday'
          ? null
          : Array.isArray(reply.emojiSpeakSet) && reply.emojiSpeakSet.length > 0
            ? reply.emojiSpeakSet
                .map((item) =>
                  enrichEmojiSpeakForLesson(config.lessonId, item),
                )
                .filter(
                  (item): item is NonNullable<typeof item> => item != null,
                )
            : null);

      let emojiChoice = normalizeEmojiChoice(reply.emojiChoice);
      let guidedSpeaking = normalizeGuidedSpeaking(reply.guidedSpeaking);
      let roleplayIntro = normalizeRoleplayIntro(reply.roleplayIntro);
      let roleplayNpc = normalizeRoleplayNpc(reply.roleplayNpc);

      let textEn = reply.textEn;
      let textTh: string | null | undefined = reply.textTh;
      let expectedSpeech = reply.expectedSpeech?.trim() || null;
      const teachingLang = teachingLanguageFromConfig(config);

      const forcedGuided = forceExploreCityGuidedSpeakingIfNeeded(
        config.lessonId,
        teachingLang,
        nextTurn,
        data.turns,
        {
          textEn,
          textTh,
          guidedSpeaking,
          expectedSpeech,
        },
      );
      if (forcedGuided != null) {
        textEn = forcedGuided.textEn;
        textTh = forcedGuided.textTh;
        guidedSpeaking = forcedGuided.guidedSpeaking;
        expectedSpeech = forcedGuided.expectedSpeech;
        emojiChoice = null;
      }

      // Pin Explore the City / Around Town Roleplay Intro later (after bridge attach).

      // Objective-driven Explore City roleplay (no fixed script; max 4 speaks).
      const guidedRoleplay = guideExploreCityRoleplayIfNeeded(
        config.lessonId,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          expectedSpeech,
          isTaskComplete,
        },
      );
      if (guidedRoleplay != null) {
        textEn = guidedRoleplay.textEn;
        textTh = guidedRoleplay.textTh;
        expectsUserSpeech = guidedRoleplay.expectsUserSpeech;
        expectedSpeech = guidedRoleplay.expectedSpeech;
        roleplayNpc = guidedRoleplay.roleplayNpc;
        roleplayIntro = null;
        guidedSpeaking = null;
        emojiChoice = null;
        isTaskComplete = guidedRoleplay.isTaskComplete;
      }

      // Shopping Mini Challenge: first wrong → soft-teach + mic (block premature bridge).
      const forcedShoppingSoftTeach = forceShoppingLookingForSoftTeachIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedShoppingSoftTeach != null) {
        textEn = forcedShoppingSoftTeach.textEn;
        textTh = forcedShoppingSoftTeach.textTh;
        expectsUserSpeech = forcedShoppingSoftTeach.expectsUserSpeech;
        expectedSpeech = forcedShoppingSoftTeach.expectedSpeech;
        roleplayNpc = forcedShoppingSoftTeach.roleplayNpc;
        roleplayIntro = null;
        guidedSpeaking = null;
        emojiChoice = forcedShoppingSoftTeach.emojiChoice;
        isTaskComplete = forcedShoppingSoftTeach.isTaskComplete;
      }

      // After looking-for Mini clear → Shopping Roleplay Intro.
      const forcedShoppingBridge = forceShoppingRoleplayBridgeIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedShoppingBridge != null) {
        textEn = forcedShoppingBridge.textEn;
        textTh = forcedShoppingBridge.textTh;
        expectsUserSpeech = forcedShoppingBridge.expectsUserSpeech;
        expectedSpeech = forcedShoppingBridge.expectedSpeech;
        roleplayNpc = forcedShoppingBridge.roleplayNpc;
        roleplayIntro = forcedShoppingBridge.roleplayIntro;
        guidedSpeaking = forcedShoppingBridge.guidedSpeaking;
        emojiChoice = forcedShoppingBridge.emojiChoice;
        isTaskComplete = forcedShoppingBridge.isTaskComplete;
      }

      // After Pattern 2 recommend model → Roleplay bridge (no speak-recommend Mini).
      const forcedRestaurantBridge = forceRestaurantRoleplayBridgeIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedRestaurantBridge != null) {
        textEn = forcedRestaurantBridge.textEn;
        textTh = forcedRestaurantBridge.textTh;
        expectsUserSpeech = forcedRestaurantBridge.expectsUserSpeech;
        expectedSpeech = forcedRestaurantBridge.expectedSpeech;
        roleplayNpc = forcedRestaurantBridge.roleplayNpc;
        roleplayIntro = forcedRestaurantBridge.roleplayIntro;
        guidedSpeaking = forcedRestaurantBridge.guidedSpeaking;
        emojiChoice = forcedRestaurantBridge.emojiChoice;
        isTaskComplete = forcedRestaurantBridge.isTaskComplete;
      }

      // After coffee Mini (tea + cake) → Roleplay Intro.
      const forcedCoffeeBridge = forceCoffeeRoleplayBridgeIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedCoffeeBridge != null) {
        textEn = forcedCoffeeBridge.textEn;
        textTh = forcedCoffeeBridge.textTh;
        expectsUserSpeech = forcedCoffeeBridge.expectsUserSpeech;
        expectedSpeech = forcedCoffeeBridge.expectedSpeech;
        roleplayNpc = forcedCoffeeBridge.roleplayNpc;
        roleplayIntro = forcedCoffeeBridge.roleplayIntro;
        guidedSpeaking = forcedCoffeeBridge.guidedSpeaking;
        emojiChoice = forcedCoffeeBridge.emojiChoice;
        isTaskComplete = forcedCoffeeBridge.isTaskComplete;
      }

      // After Favorites Step 4 (We…) → Movie Roleplay Intro.
      const forcedFavoritesBridge = forceFavoritesRoleplayBridgeIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedFavoritesBridge != null) {
        textEn = forcedFavoritesBridge.textEn;
        textTh = forcedFavoritesBridge.textTh;
        expectsUserSpeech = forcedFavoritesBridge.expectsUserSpeech;
        expectedSpeech = forcedFavoritesBridge.expectedSpeech;
        roleplayNpc = forcedFavoritesBridge.roleplayNpc;
        roleplayIntro = forcedFavoritesBridge.roleplayIntro;
        guidedSpeaking = forcedFavoritesBridge.guidedSpeaking;
        emojiChoice = forcedFavoritesBridge.emojiChoice;
        isTaskComplete = forcedFavoritesBridge.isTaskComplete;
      }

      // Smart Shopper 2.6: pin Teach/Mini guidedSpeaking boards.
      const forcedSmartShopper = forceSmartShopperGuidedSpeakingIfNeeded(
        config.lessonId,
        teachingLang,
        nextTurn,
        data.turns,
        {
          textEn,
          textTh,
          guidedSpeaking,
          expectsUserSpeech,
          isTaskComplete,
          expectedSpeech,
        },
      );
      if (forcedSmartShopper != null) {
        textEn = forcedSmartShopper.textEn;
        textTh = forcedSmartShopper.textTh;
        guidedSpeaking = forcedSmartShopper.guidedSpeaking;
        expectsUserSpeech = forcedSmartShopper.expectsUserSpeech;
        expectedSpeech = forcedSmartShopper.expectedSpeech;
        emojiChoice = forcedSmartShopper.emojiChoice;
        isTaskComplete = forcedSmartShopper.isTaskComplete;
      }

      // Daily Routine 1.1: pin Vocab / Wake / Sleep / AM-PM / Activity boards.
      const forcedDailyRoutine = forceDailyRoutineGuidedSpeakingIfNeeded(
        config.lessonId,
        teachingLang,
        nextTurn,
        data.turns,
        {
          textEn,
          textTh,
          guidedSpeaking,
          expectsUserSpeech,
          isTaskComplete,
          expectedSpeech,
        },
      );
      if (forcedDailyRoutine != null) {
        textEn = forcedDailyRoutine.textEn;
        textTh = forcedDailyRoutine.textTh;
        guidedSpeaking = forcedDailyRoutine.guidedSpeaking;
        expectsUserSpeech = forcedDailyRoutine.expectsUserSpeech;
        expectedSpeech = forcedDailyRoutine.expectedSpeech;
        emojiChoice = forcedDailyRoutine.emojiChoice;
        isTaskComplete = forcedDailyRoutine.isTaskComplete;
      }

      // Food & Drinks 1.2: pin Favorite / Describe / Drink boards.
      const forcedFood = forceFoodGuidedSpeakingIfNeeded(
        config.lessonId,
        teachingLang,
        nextTurn,
        data.turns,
        {
          textEn,
          textTh,
          guidedSpeaking,
          expectsUserSpeech,
          isTaskComplete,
          expectedSpeech,
        },
      );
      if (forcedFood != null) {
        textEn = forcedFood.textEn;
        textTh = forcedFood.textTh;
        guidedSpeaking = forcedFood.guidedSpeaking;
        expectsUserSpeech = forcedFood.expectsUserSpeech;
        expectedSpeech = forcedFood.expectedSpeech;
        emojiChoice = forcedFood.emojiChoice;
        isTaskComplete = forcedFood.isTaskComplete;
      }

      const forcedFoodCelebrate = forceFoodCelebrateIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        data.learnerFirstName ??
          learnerNameFallback(teachingLanguageFromConfig(config)),
        {
          textEn,
          textTh,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedFoodCelebrate != null) {
        textEn = forcedFoodCelebrate.textEn;
        textTh = forcedFoodCelebrate.textTh;
        expectsUserSpeech = forcedFoodCelebrate.expectsUserSpeech;
        expectedSpeech = forcedFoodCelebrate.expectedSpeech;
        guidedSpeaking = forcedFoodCelebrate.guidedSpeaking;
        emojiChoice = forcedFoodCelebrate.emojiChoice;
        isTaskComplete = forcedFoodCelebrate.isTaskComplete;
      }

      // Home 1.3: pin Home Type / Live With / Favorite / Mini Quiz boards.
      const forcedHome = forceHomeGuidedSpeakingIfNeeded(
        config.lessonId,
        teachingLang,
        nextTurn,
        data.turns,
        {
          textEn,
          textTh,
          guidedSpeaking,
          expectsUserSpeech,
          isTaskComplete,
          expectedSpeech,
        },
      );
      if (forcedHome != null) {
        textEn = forcedHome.textEn;
        textTh = forcedHome.textTh;
        guidedSpeaking = forcedHome.guidedSpeaking;
        expectsUserSpeech = forcedHome.expectsUserSpeech;
        expectedSpeech = forcedHome.expectedSpeech;
        emojiChoice = forcedHome.emojiChoice;
        isTaskComplete = forcedHome.isTaskComplete;
      }

      const forcedHomeCelebrate = forceHomeCelebrateIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedHomeCelebrate != null) {
        textEn = forcedHomeCelebrate.textEn;
        textTh = forcedHomeCelebrate.textTh;
        expectsUserSpeech = forcedHomeCelebrate.expectsUserSpeech;
        expectedSpeech = forcedHomeCelebrate.expectedSpeech;
        guidedSpeaking = forcedHomeCelebrate.guidedSpeaking;
        emojiChoice = forcedHomeCelebrate.emojiChoice;
        isTaskComplete = forcedHomeCelebrate.isTaskComplete;
      }

      const forcedSmartShopperCelebrate = forceSmartShopperCelebrateIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedSmartShopperCelebrate != null) {
        textEn = forcedSmartShopperCelebrate.textEn;
        textTh = forcedSmartShopperCelebrate.textTh;
        expectsUserSpeech = forcedSmartShopperCelebrate.expectsUserSpeech;
        expectedSpeech = forcedSmartShopperCelebrate.expectedSpeech;
        guidedSpeaking = forcedSmartShopperCelebrate.guidedSpeaking;
        emojiChoice = forcedSmartShopperCelebrate.emojiChoice;
        isTaskComplete = forcedSmartShopperCelebrate.isTaskComplete;
      }

      // After Survival Step 3 → Emoji Speak Intro + full batch.
      const forcedSurvivalEmoji = forceSurvivalEmojiSpeakIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          expectsUserSpeech,
          isTaskComplete,
          emojiSpeakSet,
        },
      );
      if (forcedSurvivalEmoji != null) {
        textEn = forcedSurvivalEmoji.textEn;
        textTh = forcedSurvivalEmoji.textTh;
        expectsUserSpeech = forcedSurvivalEmoji.expectsUserSpeech;
        expectedSpeech = forcedSurvivalEmoji.expectedSpeech;
        guidedSpeaking = forcedSurvivalEmoji.guidedSpeaking;
        emojiChoice = forcedSurvivalEmoji.emojiChoice;
        emojiSpeakSet = forcedSurvivalEmoji.emojiSpeakSet;
        isTaskComplete = forcedSurvivalEmoji.isTaskComplete;
      }

      // After Survival Emoji Speak → Celebrate (no Pattern Challenge).
      const forcedSurvivalCelebrate =
        forceSurvivalCelebrateAfterEmojiSpeakIfNeeded(
          config.lessonId,
          teachingLang,
          data.turns,
          {
            textEn,
            textTh,
            expectsUserSpeech,
            isTaskComplete,
          },
          isEmojiSpeakComplete,
        );
      if (forcedSurvivalCelebrate != null) {
        textEn = forcedSurvivalCelebrate.textEn;
        textTh = forcedSurvivalCelebrate.textTh;
        expectsUserSpeech = forcedSurvivalCelebrate.expectsUserSpeech;
        expectedSpeech = forcedSurvivalCelebrate.expectedSpeech;
        guidedSpeaking = forcedSurvivalCelebrate.guidedSpeaking;
        emojiChoice = forcedSurvivalCelebrate.emojiChoice;
        emojiSpeakSet = forcedSurvivalCelebrate.emojiSpeakSet;
        isTaskComplete = forcedSurvivalCelebrate.isTaskComplete;
      }

      // Mini Challenge: one random city at a time (not the 4-city board).
      const forcedTransportMini = forceTransportDestinationMiniIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          guidedSpeaking,
          emojiChoice,
        },
      );
      if (forcedTransportMini != null) {
        textEn = forcedTransportMini.textEn;
        textTh = forcedTransportMini.textTh;
        expectsUserSpeech = forcedTransportMini.expectsUserSpeech;
        expectedSpeech = forcedTransportMini.expectedSpeech;
        guidedSpeaking = forcedTransportMini.guidedSpeaking;
        emojiChoice = forcedTransportMini.emojiChoice;
      }

      const forcedTransportPattern2 = forceTransportPattern2IfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          emojiChoice,
        },
      );
      if (forcedTransportPattern2 != null) {
        textEn = forcedTransportPattern2.textEn;
        textTh = forcedTransportPattern2.textTh;
        expectsUserSpeech = forcedTransportPattern2.expectsUserSpeech;
        expectedSpeech = forcedTransportPattern2.expectedSpeech;
        guidedSpeaking = forcedTransportPattern2.guidedSpeaking;
        emojiChoice = forcedTransportPattern2.emojiChoice;
      }

      const forcedTransportBridge = forceTransportRoleplayBridgeIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          isTaskComplete,
        },
      );
      if (forcedTransportBridge != null) {
        textEn = forcedTransportBridge.textEn;
        textTh = forcedTransportBridge.textTh;
        expectsUserSpeech = forcedTransportBridge.expectsUserSpeech;
        expectedSpeech = forcedTransportBridge.expectedSpeech;
        roleplayNpc = forcedTransportBridge.roleplayNpc;
        roleplayIntro = forcedTransportBridge.roleplayIntro;
        guidedSpeaking = forcedTransportBridge.guidedSpeaking;
        emojiChoice = forcedTransportBridge.emojiChoice;
        isTaskComplete = forcedTransportBridge.isTaskComplete;
      }

      // Scripted Shopping / Restaurant / Coffee roleplay — pin objective, no backward.
      const guidedScripted = guideScriptedAroundTownRoleplayIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          expectsUserSpeech,
          expectedSpeech,
          isTaskComplete,
        },
      );
      if (guidedScripted != null) {
        textEn = guidedScripted.textEn;
        textTh = guidedScripted.textTh;
        expectsUserSpeech = guidedScripted.expectsUserSpeech;
        expectedSpeech = guidedScripted.expectedSpeech;
        roleplayNpc = guidedScripted.roleplayNpc;
        roleplayIntro = null;
        guidedSpeaking = null;
        emojiChoice = guidedScripted.emojiChoice ?? null;
        isTaskComplete = guidedScripted.isTaskComplete;
      }

      // After You're welcome + Continue → Celebrate (never double the close).
      const forcedCelebrate = forceExploreCityCelebrateAfterCloseIfNeeded(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          textTh,
          roleplayIntro,
          roleplayNpc,
          isTaskComplete,
        },
        data.learnerFirstName ??
          learnerNameFallback(teachingLanguageFromConfig(config)),
      );
      if (forcedCelebrate != null) {
        textEn = forcedCelebrate.textEn;
        textTh = forcedCelebrate.textTh;
        expectsUserSpeech = forcedCelebrate.expectsUserSpeech;
        expectedSpeech = forcedCelebrate.expectedSpeech;
        roleplayNpc = forcedCelebrate.roleplayNpc;
        roleplayIntro = null;
        guidedSpeaking = null;
        emojiChoice = null;
        isTaskComplete = forcedCelebrate.isTaskComplete;
      }

      // Celebrate after roleplay — always open with praise first.
      const celebrateWithPraise = ensureExploreCityCelebratePraiseFirst(
        config.lessonId,
        teachingLang,
        data.turns,
        {
          textEn,
          roleplayIntro,
          roleplayNpc,
          isTaskComplete,
        },
      );
      if (celebrateWithPraise != null) {
        textEn = celebrateWithPraise;
      }

      // Emoji Choice / Guided Speaking turns always need the mic — never listen-only.
      if ((emojiChoice != null || guidedSpeaking != null) && !isTaskComplete) {
        expectsUserSpeech = true;
      }

      // Around Town text bridges often omit roleplayIntro — attach praise + purple card.
      if (
        roleplayIntro == null &&
        roleplayNpc == null &&
        !expectsUserSpeech &&
        !isTaskComplete &&
        looksLikeAroundTownRoleplayBridge(textEn)
      ) {
        const bridgeIntro = aroundTownRoleplayIntroSpeech(
          config.lessonId,
          teachingLang,
        );
        if (bridgeIntro != null) {
          textEn = bridgeIntro.textEn;
          roleplayIntro = bridgeIntro.roleplayIntro;
        }
      }

      // Pin canonical Roleplay Intro speech + card (2.1–2.5 + Explore City).
      if (
        roleplayIntro != null &&
        roleplayNpc == null &&
        !isTaskComplete
      ) {
        const pinnedIntro = aroundTownRoleplayIntroSpeech(
          config.lessonId,
          teachingLang,
        );
        if (pinnedIntro != null) {
          textEn = pinnedIntro.textEn;
          roleplayIntro = pinnedIntro.roleplayIntro;
          expectsUserSpeech = false;
          expectedSpeech = null;
          emojiChoice = null;
          guidedSpeaking = null;
          roleplayNpc = null;
        }
      }

      // Roleplay Intro is always listen-only (tap Start Roleplay / Continue).
      // Keep roleplayNpc null on Intro so purple CTA stays; seed objective
      // only once staff chrome is already present.
      if (roleplayIntro != null && !isTaskComplete) {
        expectsUserSpeech = false;
        if (roleplayNpc != null && !roleplayNpc.objective) {
          const objective =
            config.lessonId === 'ee_around_town_convenience'
              ? EXPLORE_CITY_ROLEPLAY_OBJECTIVE
              : config.lessonId === 'ee_around_town_shopping'
                ? SHOPPING_ROLEPLAY_OBJECTIVE
                : config.lessonId === 'ee_around_town_restaurant'
                  ? RESTAURANT_ROLEPLAY_OBJECTIVE
                  : config.lessonId === 'ee_around_town_coffee'
                    ? COFFEE_ROLEPLAY_OBJECTIVE
                    : config.lessonId === 'ee_around_town_transport'
                      ? TRANSPORT_ROLEPLAY_OBJECTIVE
                      : config.lessonId === 'ee_about_me_favorites'
                        ? FAVORITES_ROLEPLAY_OBJECTIVE
                      : null;
          if (objective) {
            roleplayNpc = {
              ...roleplayNpc,
              objective,
            };
          }
        }
      }

      // Roleplay staff: peel Thai praise mash out of textEn; keep Thai in textTh (CC).
      // Skip when Guided Speaking / Roleplay Intro — those turns are Teacher L1, not staff.
      const staffSpeech =
        guidedSpeaking != null || roleplayIntro != null
          ? {
              textEn,
              textTh: textTh?.trim() || null,
            }
          : sanitizeAroundTownStaffSpeech(
              config.lessonId,
              textEn,
              textTh,
              emojiChoice != null,
            );

      // Roleplay close (Sure! / price answer / You're welcome!): listen-only →
      // tap Continue → Celebrate. Never mark lesson complete on this beat.
      // Skip when Celebrate was just forced (close already in history).
      // All other staff roleplay turns MUST open the mic (speak every ask).
      if (roleplayNpc != null && roleplayIntro == null && !isTaskComplete) {
        if (
          isAroundTownRoleplayEndListenTurn(
            config.lessonId,
            staffSpeech.textEn,
            expectsUserSpeech,
          )
        ) {
          isTaskComplete = false;
          expectsUserSpeech = false;
        } else {
          expectsUserSpeech = true;
        }
      } else if (
        isAroundTownRoleplayCloseLine(staffSpeech.textEn) &&
        !maxTurnsReached &&
        !isTaskComplete
      ) {
        isTaskComplete = false;
        expectsUserSpeech = false;
      }

      this.sessionStore.updateTrainingState(sessionId, {
        currentTurn: nextTurn,
        isComplete: isTaskComplete,
      });

      const aiTurn = {
        speaker: 'ai' as const,
        textEn: staffSpeech.textEn,
        textTh: staffSpeech.textTh,
        audioUrl: null,
        expectsUserSpeech,
        expectedSpeech,
        scene: reply.scene ?? null,
        emojiSpeak: emojiSpeakSet ? null : emojiSpeak,
        emojiSpeakSet,
        emojiChoice,
        guidedSpeaking,
        roleplayIntro,
        roleplayNpc: isTaskComplete ? null : roleplayNpc,
      };
      this.sessionStore.addTurn(sessionId, aiTurn);

      const response: TurnExchangeResponse = {
        aiResponse: staffSpeech.textEn,
        textTh: staffSpeech.textTh ?? '',
        isTaskComplete,
        updatedCheckpoints: {},
        feedbackHints: { mispronouncedWords: [] },
        currentTurn: nextTurn,
        // A completed lesson hands off to the drill, so never ask for speech.
        expectsUserSpeech,
        expectedSpeech,
        scene: reply.scene,
        emojiSpeak: emojiSpeakSet ? null : emojiSpeak,
        emojiSpeakSet,
        emojiChoice,
        guidedSpeaking,
        roleplayIntro,
        roleplayNpc: isTaskComplete ? null : roleplayNpc,
      };

      if (body.generateAudio) {
        const audio = await this.geminiTts.synthesizeSpeech(staffSpeech.textEn);
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
      throw new BadGatewayException(formatAiServiceUserMessage(err));
    }
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

    let originalText = (body.userSpeechText ?? body.transcript ?? '').trim();
    if (!originalText) {
      throw new BadRequestException('userSpeechText is required');
    }

    let userText = originalText;
    try {
      if (body.thaiMixEnabled) {
        this.sessionStore.markThaiMixUsed(sessionId);
        userText = await this.chat.correctThaiMix(originalText);
      }

      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
        originalTextEn: originalText,
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
      throw new BadGatewayException(formatAiServiceUserMessage(err));
    }
  }

  private async processLegacyTurn(
    sessionId: string,
    body: TurnDto,
  ) {
    const data = this.sessionStore.get(sessionId)!;

    let originalText = (body.transcript ?? body.userSpeechText ?? '').trim();
    if (!originalText) {
      throw new BadRequestException('transcript is required');
    }

    let userText = originalText;
    try {
      if (body.thaiMixEnabled) {
        this.sessionStore.markThaiMixUsed(sessionId);
        userText = await this.chat.correctThaiMix(originalText);
      }

      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
        originalTextEn: originalText,
      });

      const userTurnCount = data.turns.filter(
        (turn) => turn.speaker === 'user',
      ).length;

      const topicId = data.session.topicId ?? 'coffee';

      if (topicId === 'free_talk') {
        const ft = data.freeTalk;
        const userTurnIndex = data.turns.filter(
          (turn) => turn.speaker === 'user',
        ).length;
        const { reply, suggestion } = await this.chat.generateFreeTalkReply({
          history: data.turns,
          userMessage: userText,
          originalUserMessage: originalText,
          languageLevel: ft?.languageLevel ?? 'balanced',
          phase: ft?.phase,
          topic: ft?.topic,
          nextAction: ft?.nextAction,
          memories: ft?.priorMemories,
          remainingSeconds: body.remainingSeconds,
          durationLimitSeconds: data.session.durationLimitSeconds,
          userTurnIndex,
          grammarSuggestionsUsed: ft?.grammarSuggestionsUsed ?? 0,
          naturalnessSuggestionsUsed: ft?.naturalnessSuggestionsUsed ?? 0,
          grammarSuggestionMax: ft?.grammarSuggestionMax ?? 2,
          naturalnessSuggestionMax: ft?.naturalnessSuggestionMax ?? 1,
        });
        const aiTurn = {
          speaker: 'ai' as const,
          textEn: reply.textEn,
          textTh: reply.textTh,
          audioUrl: null,
        };
        this.sessionStore.addTurn(sessionId, aiTurn);
        data.turns[data.turns.length - 1] = aiTurn;
        this.sessionStore.updateFreeTalkState(sessionId, {
          phase: reply.phase as
            | 'greeting'
            | 'ice_breaker'
            | 'discover_topic'
            | 'conversation_loop'
            | 'wrap_up',
          topic: reply.topic || ft?.topic || null,
          nextAction: reply.nextAction as
            | 'explore'
            | 'expand'
            | 'relate'
            | 'teach'
            | 'encourage'
            | 'change_topic'
            | 'wrap_up',
          grammarSuggestionsUsed: suggestion.grammarSuggestionsUsed,
          naturalnessSuggestionsUsed: suggestion.naturalnessSuggestionsUsed,
          issueLog: [
            ...(ft?.issueLog ?? []),
            ...suggestion.issueLogEntries,
          ],
        });
        return {
          ...aiTurn,
          suggestionDebug: suggestion.debug,
        };
      }

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
      throw new BadGatewayException(formatAiServiceUserMessage(err));
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

    this.sessionStore.markHintUsed(sessionId);

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
        throw new BadGatewayException(formatAiServiceUserMessage(err));
      }
    }

    if (data.session.sessionType === 'training' && data.lessonConfig) {
      let lessonRewards;
      let newAchievements: Awaited<
        ReturnType<AchievementsService['syncForUser']>
      >['newlyUnlocked'] = [];

      if (data.session.isComplete) {
        const userSession = await this.prisma.userSession.findUnique({
          where: { id: sessionId },
        });
        if (userSession && userSession.userId === req.user.id) {
          if (!userSession.rewardsApplied) {
            lessonRewards = await this.economy.applyLessonRewards({
              userId: req.user.id,
              sessionId,
              lessonId: data.lessonConfig.lessonId,
            });
          } else {
            // Already saved — still return summary so clients can sync UI.
            const user = await this.prisma.user.findUniqueOrThrow({
              where: { id: req.user.id },
            });
            lessonRewards = {
              xpEarned: userSession.xpEarned ?? 0,
              seedsEarned: userSession.seedsEarned ?? 0,
              ratingLabel: userSession.scoreLabel ?? 'Lesson Complete',
              streakDays: user.streakDays,
              previousStreakDays: user.streakDays,
              balances: this.economy.toBalances(user),
              isDailyMission: false,
            };
          }

          try {
            const ended = data.endedAt ?? new Date();
            const started = new Date(data.session.startedAt);
            const durationSeconds = Math.max(
              0,
              Math.floor((ended.getTime() - started.getTime()) / 1000),
            );
            const learnerTurnCount = data.turns.filter(
              (t) => t.speaker === 'user',
            ).length;

            await this.prisma.userSession.update({
              where: { id: sessionId },
              data: {
                hintsUsed: data.hintsUsed,
                thaiMixUsed: data.thaiMixUsed,
                durationSeconds,
                learnerTurnCount,
              },
            });
          } catch {
            // Non-fatal — achievements still sync from rewards.
          }

          const sync = await this.achievements.syncForUserSafe(req.user.id);
          if (sync) {
            newAchievements = sync.newlyUnlocked;
          }
        }
      }

      return { status: 'ended', lessonRewards, newAchievements };
    }

    if (data.session.topicId === 'free_talk') {
      try {
        const ended = data.endedAt ?? new Date();
        const started = new Date(data.session.startedAt);
        let duration = Math.floor(
          (ended.getTime() - started.getTime()) / 1000,
        );
        duration = Math.min(
          duration,
          data.session.durationLimitSeconds ?? duration,
        );
        const learnerTurnCount = data.turns.filter(
          (t) => t.speaker === 'user',
        ).length;
        const summary = await this.chat.generateFreeTalkReport(
          data.turns,
          duration,
          data.freeTalk?.issueLog ?? [],
        );
        this.sessionStore.updateFreeTalkState(sessionId, {
          conversationSummaryEn: summary.conversationSummaryEn,
          conversationSummaryTh: summary.conversationSummaryTh,
          extractedMemories: summary.memories,
          endedReport: summary,
        });
        await this.users.setFreeTalkMemories(req.user.id, summary.memories);

        try {
          await this.prisma.userSession.upsert({
            where: { id: sessionId },
            create: {
              id: sessionId,
              userId: req.user.id,
              sessionType: 'free_talk',
              rewardsApplied: false,
              completedAt: ended,
              durationSeconds: duration,
              learnerTurnCount,
            },
            update: {
              completedAt: ended,
              durationSeconds: duration,
              learnerTurnCount,
            },
          });
        } catch {
          // Non-fatal — free talk summary still returns to the client.
        }

        return {
          status: 'ended',
          conversationSummaryEn: summary.conversationSummaryEn,
          conversationSummaryTh: summary.conversationSummaryTh,
          memories: summary.memories,
        };
      } catch (err) {
        throw new BadGatewayException(formatAiServiceUserMessage(err));
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
      throw new BadGatewayException(formatAiServiceUserMessage(err));
    }
  }

  @Get(':sessionId/report')
  async getReport(
    @Req() req: AuthedRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<MissionResultResponse> {
    const data = this.sessionStore.get(sessionId);

    if (!data) {
      return this.getStoredReport(req.user.id, sessionId);
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
            xpEarned: userSession.xpEarned ?? rewardTier.xp,
            seedsEarned: userSession.seedsEarned ?? rewardTier.seeds,
            ratingLabel: userSession.scoreLabel ?? rewardTier.ratingLabel,
            streakDays: user.streakDays,
            previousStreakDays: user.streakDays,
            balances: this.economy.toBalances(user),
            isDailyMission: userSession.isDailyMission,
          };
        }

        const xpEarned = rewards?.xpEarned ?? rewardTier.xp;
        const seedsEarned = rewards?.seedsEarned ?? rewardTier.seeds;
        const scoreLabel = rewardTier.ratingLabel;
        const series = getSeriesForSimulation(config.simulationId);
        const textTurns = mergeTurnsWithFeedback(
          data.turns,
          report.turnFeedback,
        );

        let newAchievements: Awaited<
          ReturnType<AchievementsService['syncForUser']>
        >['newlyUnlocked'] = [];

        if (userSession && userSession.userId === req.user.id) {
          try {
            await this.prisma.userSession.update({
              where: { id: sessionId },
              data: {
                completedAt: userSession.completedAt ?? ended,
                overallScore,
                scoreLabel,
                xpEarned,
                seedsEarned,
                durationSeconds: duration,
                learnerTurnCount: textTurns.filter((t) => t.speaker === 'user')
                  .length,
                hintsUsed: data.hintsUsed,
                thaiMixUsed: data.thaiMixUsed,
                reportJson: JSON.parse(
                  JSON.stringify({
                    feedbackEn: report.feedbackEn,
                    feedbackTh: report.feedbackTh,
                    bestSentenceEn: report.bestSentenceEn,
                    bestSentenceNoteTh: report.bestSentenceNoteTh,
                    grammarTip: report.grammarTip,
                    grammarTipTh: report.grammarTipTh,
                    pronunciationIssues: report.pronunciationIssues,
                    vocab: report.vocab,
                    missionTitleTh: config.missionTitleTh,
                    topicId: config.simulationId,
                    checkpointSummary: checkpoints,
                    turns: textTurns,
                  }),
                ) as Prisma.InputJsonValue,
              },
            });
          } catch (persistErr) {
            // Rewards may already be applied; don't fail the result screen
            // if report persistence fails (e.g. pending migration).
            console.error('Failed to persist session report', persistErr);
          }

          const sync = await this.achievements.syncForUserSafe(req.user.id);
          if (sync) {
            newAchievements = sync.newlyUnlocked;
          }
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
          scoreLabel,
          starRating: getStarRating(overallScore),
          goldBananasEarned: xpEarned,
          checkpointSummary: checkpoints,
          rewards,
          newAchievements,
          simulationId: config.simulationId,
          seriesId: series?.seriesId,
          seriesTitleEn: series?.titleEn,
          seriesTitleTh: series?.titleTh,
          completedAt: (userSession?.completedAt ?? ended).toISOString(),
          turns: textTurns,
        };
      }

      duration = Math.min(
        duration,
        data.session.durationLimitSeconds ?? duration,
      );

      if (data.session.topicId === 'free_talk') {
        let report = data.freeTalk?.endedReport;
        if (!report) {
          report = await this.chat.generateFreeTalkReport(
            data.turns,
            duration,
            data.freeTalk?.issueLog ?? [],
          );
          this.sessionStore.updateFreeTalkState(sessionId, {
            conversationSummaryEn: report.conversationSummaryEn,
            conversationSummaryTh: report.conversationSummaryTh,
            extractedMemories: report.memories,
            endedReport: report,
          });
          await this.users.setFreeTalkMemories(req.user.id, report.memories);
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
          topicId: 'free_talk',
          missionTitleTh: 'คุยเล่นกับครูพี่บี',
          conversationSummaryEn: report.conversationSummaryEn,
          conversationSummaryTh: report.conversationSummaryTh,
          memories: report.memories,
          turns: mergeTurnsWithFeedback(data.turns, report.turnFeedback),
        };
      }

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
        turns: mergeTurnsWithFeedback(data.turns, report.turnFeedback),
      };
    } catch (err) {
      throw new BadGatewayException(formatAiServiceUserMessage(err));
    }
  }

  private async getStoredReport(
    userId: string,
    sessionId: string,
  ): Promise<MissionResultResponse> {
    const userSession = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (
      !userSession ||
      userSession.userId !== userId ||
      !userSession.rewardsApplied ||
      !userSession.reportJson
    ) {
      throw new NotFoundException('Session not found');
    }

    const stored = this.activity.parseStoredReport(userSession.reportJson);
    const simulationId =
      userSession.simulationId ?? stored.topicId ?? undefined;
    const series = simulationId
      ? getSeriesForSimulation(simulationId)
      : undefined;
    const overallScore = userSession.overallScore ?? 0;
    const scoreLabel = userSession.scoreLabel ?? '';
    const xpEarned = userSession.xpEarned ?? 0;
    const seedsEarned = userSession.seedsEarned ?? 0;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return {
      sessionId,
      feedbackEn: stored.feedbackEn ?? '',
      feedbackTh: stored.feedbackTh ?? '',
      bestSentenceEn: stored.bestSentenceEn ?? '',
      bestSentenceNoteTh: stored.bestSentenceNoteTh ?? '',
      grammarTip: stored.grammarTip ?? '',
      grammarTipTh: stored.grammarTipTh ?? '',
      pronunciationIssues:
        (stored.pronunciationIssues as Array<{
          word: string;
          scorePercent: number;
        }>) ?? [],
      vocab:
        (stored.vocab as Array<{
          word: string;
          meaningTh: string;
          exampleEn: string;
        }>) ?? [],
      durationSeconds: userSession.durationSeconds ?? 0,
      topicId: simulationId,
      missionTitleTh: stored.missionTitleTh,
      overallScore,
      scoreLabel,
      starRating: getStarRating(overallScore),
      goldBananasEarned: xpEarned,
      checkpointSummary: stored.checkpointSummary,
      rewards: {
        xpEarned,
        seedsEarned,
        ratingLabel: scoreLabel,
        streakDays: user.streakDays,
        previousStreakDays: user.streakDays,
        balances: this.economy.toBalances(user),
        isDailyMission: userSession.isDailyMission,
      },
      simulationId,
      seriesId: series?.seriesId,
      seriesTitleEn: series?.titleEn,
      seriesTitleTh: series?.titleTh,
      completedAt: userSession.completedAt?.toISOString(),
      turns: stored.turns ?? [],
    };
  }
}

/** Attach report turnFeedback onto user turns by learner-turn index. */
function mergeTurnsWithFeedback(
  turns: ChatTurn[],
  turnFeedback: TurnFeedbackItem[] | undefined,
): StoredChatTurn[] {
  const byIndex = new Map(
    (turnFeedback ?? []).map((item) => [item.userTurnIndex, item]),
  );
  let userIdx = 0;
  return turns.map((t) => {
    const base: StoredChatTurn = {
      speaker: t.speaker,
      textEn: t.textEn,
      textTh: t.textTh ?? null,
    };
    if (t.speaker !== 'user') return base;

    base.originalTextEn = t.originalTextEn ?? t.textEn;

    const fb = byIndex.get(userIdx++);
    if (!fb || !fb.headlineTh.trim()) return base;
    return {
      ...base,
      feedback: {
        status: fb.status,
        headlineTh: fb.headlineTh,
        detailTh: fb.detailTh || null,
        suggestionEn: fb.suggestionEn || null,
        suggestionReasonTh: fb.suggestionReasonTh || null,
      },
    };
  });
}

function firstNameFromDisplayName(
  displayName?: string | null,
  teachingLanguage: 'thai' | 'english' = 'thai',
): string {
  const trimmed = (displayName ?? '').trim();
  if (!trimmed) return learnerNameFallback(teachingLanguage);
  return trimmed.split(/\s+/)[0]!;
}
