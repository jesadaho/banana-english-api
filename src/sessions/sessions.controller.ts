import {
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
import {
  throwAiServiceBadGateway,
  isChatDebugRequest,
} from '../common/ai-user-message';
import { attachAiDebug, scriptedAiDebug } from '../common/ai-debug';
import { TrainingTurnEngine } from '../training/engine/training-turn.engine';
import { isTrainingV2Lesson } from '../training/training-v2.config';
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
  AiDebug,
} from '../common/api.types';
import {
  EMOJI_SPEAK_COMPLETE_SENTINEL,
  EMOJI_SPEAK_COMPLETE_TURN_TEXT,
  TAP_TO_CONTINUE_SENTINEL,
  TAP_TO_CONTINUE_TURN_TEXT,
} from '../common/api.types';
import { EndSessionDto, ExtractIntroNameDto } from './dto/sessions.dto';
import {
  computeSpeakingAssessment,
  type SpeakingAssessmentResult,
} from './speaking-assessment.service';
import type { SpeakingMetricsPayload } from '../common/api.types';
import {
  ChatTurn,
  SessionData,
  SessionStoreService,
} from '../session-store/session-store.service';
import { containsThaiScript, FALLBACK_HINTS, getTopic, normalizeFreeTalkLanguageLevel } from '../topics/topics.data';
import {
  INTRO_TURN1_OPENING,
  getTurn2Script,
  getTurn3Script,
} from '../topics/intro_script';
import {
  allCheckpointsComplete,
  applyPaymentClosureFromAiReply,
  applyPaymentClosureIfNeeded,
  applySimulationCheckpointHeuristics,
  finalizeSimulationTurnState,
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
  resolveLessonProgressTurn,
  ensureExploreCityCelebratePraiseFirst,
  forceExploreCityCelebrateAfterCloseIfNeeded,
  EXPLORE_CITY_ROLEPLAY_OBJECTIVE,
  SHOPPING_ROLEPLAY_OBJECTIVE,
  RESTAURANT_ROLEPLAY_OBJECTIVE,
  COFFEE_ROLEPLAY_OBJECTIVE,
  TRANSPORT_ROLEPLAY_OBJECTIVE,
  FAVORITES_ROLEPLAY_OBJECTIVE,
  LAST_NIGHT_ROLEPLAY_OBJECTIVE,
  AIRPORT_ROLEPLAY_OBJECTIVE,
  PHARMACY_ROLEPLAY_OBJECTIVE,
  aroundTownRoleplayIntroSpeech,
  forceShoppingRoleplayBridgeIfNeeded,
  forceCoffeeRoleplayBridgeIfNeeded,
  forceAirportRoleplayBridgeIfNeeded,
  forcePharmacyRoleplayBridgeIfNeeded,
  forceFavoritesGuidedSpeakingIfNeeded,
  forceFavoritesRoleplayBridgeIfNeeded,
  forceLastNightGuidedSpeakingIfNeeded,
  forceLastNightRoleplayBridgeIfNeeded,
  forceLastNightCelebrateAfterCloseIfNeeded,
  forceSmartShopperGuidedSpeakingIfNeeded,
  forceSmartShopperCelebrateIfNeeded,
  forceDailyRoutineGuidedSpeakingIfNeeded,
  buildDailyRoutineFallbackTrainingReply,
  forceAboutMeSoftTeachForLesson,
  forceFoodGuidedSpeakingIfNeeded,
  forceFoodCelebrateIfNeeded,
  forceHomeGuidedSpeakingIfNeeded,
  forceHomeCelebrateIfNeeded,
  forceWorkSchoolGuidedSpeakingIfNeeded,
  forceWorkSchoolCelebrateIfNeeded,
  forceHobbiesGuidedSpeakingIfNeeded,
  forceHobbiesCelebrateIfNeeded,
  forcePetsGuidedSpeakingIfNeeded,
  forcePetsTipIfNeeded,
  forcePetsCelebrateIfNeeded,
  forcePeopleGuidedSpeakingIfNeeded,
  forcePeopleCelebrateIfNeeded,
  forceWeatherGuidedSpeakingIfNeeded,
  forceWeatherCelebrateIfNeeded,
  forceFriendsGuidedSpeakingIfNeeded,
  forceFriendsCelebrateIfNeeded,
  FOOD_FAVORITE_GUIDED_SPEAKING,
  HOME_TYPE_GUIDED_SPEAKING,
  WORK_SCHOOL_ACTIVITY_GUIDED_SPEAKING,
  HOBBIES_HOBBY_GUIDED_SPEAKING,
  PETS_CHOICE_GUIDED_SPEAKING,
  PEOPLE_PERSON_GUIDED_SPEAKING,
  WEATHER_HOT_QUIZ_GUIDED_SPEAKING,
  FRIENDS_ACTIVITY_GUIDED_SPEAKING,
  foodFavoriteOpeningText,
  homeOpeningText,
  workSchoolOpeningText,
  hobbiesOpeningText,
  petsOpeningText,
  peopleOpeningText,
  friendsOpeningText,
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
  type LessonConfig,
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

type AuthedRequest = {
  user: User;
  headers?: Record<string, string | string[] | undefined>;
};

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
    private readonly trainingEngine: TrainingTurnEngine,
  ) {}

  @Post()
  async startSession(
    @Req() req: AuthedRequest,
    @Body() body: StartSessionDto,
  ) {
    const chatDebug = isChatDebugRequest(req);
    if (body.sessionType === 'simulation') {
      return this.startSimulationSession(
        req.user,
        body.simulationId!,
        body.isDailyMission ?? false,
        chatDebug,
      );
    }

    if (body.sessionType === 'training') {
      return this.startTrainingSession(
        req.user,
        body.lessonId!,
        body.teachingLanguage,
        chatDebug,
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
        throwAiServiceBadGateway(err, chatDebug);
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
      throwAiServiceBadGateway(err, chatDebug);
    }
  }

  private async startSimulationSession(
    user: User,
    simulationId: string,
    isDailyMission: boolean,
    chatDebug = false,
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
      const handlerStartedAt = performance.now();
      const { reply: openingReply, aiDebug: openingAiDebug } =
        await this.chat.generateSimulationOpening(config);
      const reply = openingReply;
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

      const opening: TurnExchangeResponse = attachAiDebug(
        {
          aiResponse: reply.aiResponse,
          textTh: reply.textTh,
          isTaskComplete: false,
          updatedCheckpoints: normalizedCheckpoints,
          feedbackHints: {
            grammarTip: reply.feedbackHints.grammarTip,
            mispronouncedWords: reply.feedbackHints.mispronouncedWords ?? [],
          },
          currentTurn: 0,
        },
        chatDebug,
        openingAiDebug,
        handlerStartedAt,
      );

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
      throwAiServiceBadGateway(err, chatDebug);
    }
  }

  @Post(':sessionId/turn')
  async processTurn(
    @Param('sessionId') sessionId: string,
    @Body() body: TurnDto,
    @Req() req: AuthedRequest,
  ) {
    const chatDebug = isChatDebugRequest(req);
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }

    if (data.session.sessionType === 'simulation') {
      return this.processSimulationTurn(sessionId, body, chatDebug);
    }

    if (data.session.sessionType === 'training') {
      return this.processTrainingTurn(sessionId, body, chatDebug);
    }

    return this.processLegacyTurn(sessionId, body, chatDebug);
  }

  /** Onboarding: parse learner name from STT transcript (regex + Gemini). */
  @Post(':sessionId/intro/extract-name')
  async extractIntroName(
    @Param('sessionId') sessionId: string,
    @Body() body: ExtractIntroNameDto,
  ) {
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }
    const userName = await this.chat.extractIntroUserName(body.transcript);
    return { userName };
  }

  private async startTrainingSession(
    user: User,
    lessonId: string,
    teachingLanguageRaw?: string,
    chatDebug = false,
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
    const useTrainingV2 = isTrainingV2Lesson(config.lessonId);
    const data = this.sessionStore.createTraining(config, learnerFirstName, {
      engineVersion: useTrainingV2 ? 2 : 1,
    });

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
      const handlerStartedAt = performance.now();
      if (useTrainingV2) {
        return this.finishTrainingV2Opening(
          data,
          config,
          learnerFirstName,
          teachingLanguage,
          chatDebug,
          handlerStartedAt,
        );
      }
      const { reply, aiDebug: openingAiDebug } =
        await this.chat.generateTrainingOpening(
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
      if (config.lessonId === 'ee_about_me_work_school') {
        // Pin Work/Study activity board on opening.
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: WORK_SCHOOL_ACTIVITY_GUIDED_SPEAKING.stem,
          options: WORK_SCHOOL_ACTIVITY_GUIDED_SPEAKING.options.map((o) => ({
            ...o,
          })),
        });
        openingEmojiChoice = null;
      }
      if (config.lessonId === 'ee_about_me_hobbies') {
        // Pin Hobby board on opening (Watch movies / Listen to music / Exercise).
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: HOBBIES_HOBBY_GUIDED_SPEAKING.stem,
          options: HOBBIES_HOBBY_GUIDED_SPEAKING.options.map((o) => ({
            ...o,
          })),
        });
        openingEmojiChoice = null;
      }
      if (config.lessonId === 'ee_about_me_pets') {
        // Pin Cat/Dog board on opening.
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: PETS_CHOICE_GUIDED_SPEAKING.stem,
          options: PETS_CHOICE_GUIDED_SPEAKING.options.map((o) => ({ ...o })),
        });
        openingEmojiChoice = null;
      }
      if (config.lessonId === 'ee_about_me_people') {
        // Pin brother/sister board on opening.
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: PEOPLE_PERSON_GUIDED_SPEAKING.stem,
          options: PEOPLE_PERSON_GUIDED_SPEAKING.options.map((o) => ({
            ...o,
          })),
        });
        openingEmojiChoice = null;
      }
      if (config.lessonId === 'ee_about_me_weather') {
        // Pin Hot / Sunny / Cold quiz on opening.
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: WEATHER_HOT_QUIZ_GUIDED_SPEAKING.stem,
          options: WEATHER_HOT_QUIZ_GUIDED_SPEAKING.options.map((o) => ({
            ...o,
          })),
        });
        openingEmojiChoice = null;
      }
      if (config.lessonId === 'ee_about_me_friends') {
        // Pin Play games / Eat out / Hang out board on opening.
        openingGuidedSpeaking = normalizeGuidedSpeaking({
          stem: FRIENDS_ACTIVITY_GUIDED_SPEAKING.stem,
          options: FRIENDS_ACTIVITY_GUIDED_SPEAKING.options.map((o) => ({
            ...o,
          })),
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
              : config.lessonId === 'ee_about_me_work_school'
                ? workSchoolOpeningText(learnerFirstName)
                : config.lessonId === 'ee_about_me_hobbies'
                  ? hobbiesOpeningText()
                  : config.lessonId === 'ee_about_me_pets'
                    ? petsOpeningText(learnerFirstName)
                    : config.lessonId === 'ee_about_me_people'
                      ? peopleOpeningText(learnerFirstName)
                      : config.lessonId === 'ee_about_me_weather'
                        ? "วันนี้อากาศร้อนมากเลยครับ! 🔥 ถ้าจะพูดว่า 'อากาศร้อน' ภาษาอังกฤษใช้คำว่าอะไรครับ?"
                        : config.lessonId === 'ee_about_me_friends'
                          ? friendsOpeningText(learnerFirstName)
                          : reply.textEn;
      const openingExpectsSpeechFinal =
        config.lessonId === 'ee_about_me_food' ||
        config.lessonId === 'ee_about_me_home' ||
        config.lessonId === 'ee_about_me_work_school' ||
        config.lessonId === 'ee_about_me_hobbies' ||
        config.lessonId === 'ee_about_me_pets' ||
        config.lessonId === 'ee_about_me_people' ||
        config.lessonId === 'ee_about_me_weather' ||
        config.lessonId === 'ee_about_me_friends'
          ? true
          : openingExpectsUserSpeech;
      const openingExpectedSpeechFinal =
        config.lessonId === 'ee_about_me_food'
          ? 'I like pizza.'
          : config.lessonId === 'ee_about_me_home'
            ? 'I live in an apartment.'
            : config.lessonId === 'ee_about_me_work_school'
              ? 'I work.'
              : config.lessonId === 'ee_about_me_hobbies'
                ? 'I watch movies.'
                : config.lessonId === 'ee_about_me_pets'
                  ? 'I have a cat.'
                  : config.lessonId === 'ee_about_me_people'
                    ? 'My brother.'
                    : config.lessonId === 'ee_about_me_weather'
                      ? 'Hot.'
                      : config.lessonId === 'ee_about_me_friends'
                        ? 'We play games together.'
                        : openingExpectsSpeechFinal
                          ? reply.expectedSpeech?.trim() || null
                          : null;
      const opening = {
        speaker: 'ai' as const,
        textEn: openingTextEn,
        textTh:
          config.lessonId === 'ee_around_town_transport' ||
          config.lessonId === 'ee_about_me_food' ||
          config.lessonId === 'ee_about_me_home' ||
          config.lessonId === 'ee_about_me_work_school' ||
          config.lessonId === 'ee_about_me_hobbies' ||
          config.lessonId === 'ee_about_me_pets' ||
          config.lessonId === 'ee_about_me_people' ||
          config.lessonId === 'ee_about_me_weather' ||
          config.lessonId === 'ee_about_me_friends'
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

      const openingProgressMax = config.progressMax;
      const openingProgressTurn =
        openingProgressMax != null && openingProgressMax > 0
          ? resolveLessonProgressTurn(
              config.lessonId,
              0,
              openingProgressMax,
              {
                textEn: openingTextEn,
                expectsUserSpeech: openingExpectsSpeechFinal,
                expectedSpeech: openingExpectedSpeechFinal,
                emojiChoice: openingEmojiChoice,
                roleplayIntro: openingRoleplayIntro,
                roleplayNpc: openingRoleplayNpc,
                isTaskComplete: false,
              },
            )
          : undefined;
      if (openingProgressTurn != null) {
        this.sessionStore.updateTrainingState(data.session.id, {
          currentTurn: 0,
          isComplete: false,
          progressTurn: openingProgressTurn,
        });
      }

      return {
        session: {
          id: data.session.id,
          sessionType: 'training' as const,
          lessonId: config.lessonId,
          startedAt: data.session.startedAt,
          currentTurn: 0,
          maxTurns: config.maxTurns,
          ...(openingProgressMax != null
            ? {
                progressTurn: openingProgressTurn ?? 0,
                progressMax: openingProgressMax,
              }
            : {}),
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
          ...(openingProgressMax != null
            ? { progressMax: openingProgressMax }
            : {}),
        },
        opening: attachAiDebug(
          {
            aiResponse: openingTextEn,
            textTh:
              config.lessonId === 'ee_around_town_transport' ||
              config.lessonId === 'ee_about_me_food' ||
              config.lessonId === 'ee_about_me_home' ||
              config.lessonId === 'ee_about_me_work_school' ||
              config.lessonId === 'ee_about_me_hobbies' ||
              config.lessonId === 'ee_about_me_pets' ||
              config.lessonId === 'ee_about_me_people' ||
              config.lessonId === 'ee_about_me_weather' ||
              config.lessonId === 'ee_about_me_friends'
                ? ''
                : (reply.textTh ?? ''),
            isTaskComplete: false,
            updatedCheckpoints: {},
            feedbackHints: { mispronouncedWords: [] as string[] },
            currentTurn: 0,
            ...(openingProgressMax != null
              ? {
                  progressTurn: openingProgressTurn ?? 0,
                  progressMax: openingProgressMax,
                }
              : {}),
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
          chatDebug,
          openingAiDebug,
          handlerStartedAt,
        ),
      };
    } catch (err) {
      throwAiServiceBadGateway(err, chatDebug);
    }
  }

  /** Training Engine v2 — scripted opening, no v1 force* chain. */
  private finishTrainingV2Opening(
    data: SessionData,
    config: LessonConfig,
    learnerFirstName: string,
    _teachingLanguage: string,
    chatDebug: boolean,
    handlerStartedAt: number,
  ) {
    const { reply, aiDebug: openingAiDebug } = this.trainingEngine.buildOpening(
      config,
      learnerFirstName,
    );
    const openingExpectsUserSpeech = reply.expectsUserSpeech ?? true;
    const openingExpectedSpeech = reply.expectedSpeech?.trim() || null;
    const openingEmojiChoice = normalizeEmojiChoice(reply.emojiChoice);
    const openingGuidedSpeaking = normalizeGuidedSpeaking(reply.guidedSpeaking);

    const opening = {
      speaker: 'ai' as const,
      textEn: reply.textEn,
      ttsText: reply.ttsText ?? null,
      ttsInstruction: reply.ttsInstruction ?? null,
      textTh: reply.textTh,
      audioUrl: null,
      expectsUserSpeech: openingExpectsUserSpeech,
      expectedSpeech: openingExpectedSpeech,
      scene: null,
      emojiSpeak: null,
      emojiChoice: openingEmojiChoice,
      guidedSpeaking: openingGuidedSpeaking,
      roleplayIntro: null,
      roleplayNpc: null,
    };
    this.sessionStore.addTurn(data.session.id, opening);

    const openingProgressMax = config.progressMax;
    const openingProgressTurn =
      openingProgressMax != null && openingProgressMax > 0
        ? resolveLessonProgressTurn(
            config.lessonId,
            0,
            openingProgressMax,
            {
                textEn: reply.textEn,
                expectsUserSpeech: openingExpectsUserSpeech,
                expectedSpeech: openingExpectedSpeech,
                emojiChoice: openingEmojiChoice,
                guidedSpeaking: openingGuidedSpeaking,
                roleplayIntro: null,
                roleplayNpc: null,
                isTaskComplete: false,
              },
          )
        : undefined;
    if (openingProgressTurn != null) {
      this.sessionStore.updateTrainingState(data.session.id, {
        currentTurn: 0,
        isComplete: false,
        progressTurn: openingProgressTurn,
      });
    }

    return {
      session: {
        id: data.session.id,
        sessionType: 'training' as const,
        lessonId: config.lessonId,
        startedAt: data.session.startedAt,
        currentTurn: 0,
        maxTurns: config.maxTurns,
        engineVersion: 2 as const,
        ...(openingProgressMax != null
          ? {
              progressTurn: openingProgressTurn ?? 0,
              progressMax: openingProgressMax,
            }
          : {}),
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
        ...(openingProgressMax != null
          ? { progressMax: openingProgressMax }
          : {}),
      },
      opening: attachAiDebug(
        {
          aiResponse: reply.textEn,
          ...(reply.ttsText?.trim() ? { ttsText: reply.ttsText.trim() } : {}),
          ...(reply.ttsInstruction?.trim()
            ? { ttsInstruction: reply.ttsInstruction.trim() }
            : {}),
          textTh: reply.textTh ?? '',
          isTaskComplete: false,
          updatedCheckpoints: {},
          feedbackHints: { mispronouncedWords: [] as string[] },
          currentTurn: 0,
          ...(openingProgressMax != null
            ? {
                progressTurn: openingProgressTurn ?? 0,
                progressMax: openingProgressMax,
              }
            : {}),
          expectsUserSpeech: openingExpectsUserSpeech,
          expectedSpeech: openingExpectedSpeech,
          emojiChoice: openingEmojiChoice,
          guidedSpeaking: openingGuidedSpeaking,
        },
        chatDebug,
        openingAiDebug,
        handlerStartedAt,
      ),
    };
  }

  /** Training Engine v2 turn — hybrid scripted + AI gate, no v1 post-process chain. */
  private async processTrainingTurnV2(
    sessionId: string,
    body: TurnDto,
    data: SessionData,
    config: LessonConfig,
    chatDebug: boolean,
    handlerStartedAt: number,
    expectedTurn: number,
    userText: string,
    originalText: string,
  ): Promise<TurnExchangeResponse> {
    const nextTurn = expectedTurn + 1;
    let turnAiDebug: AiDebug | undefined;

    let reply: import('../gemini/gemini-chat.service').TrainingTurnReply;
    try {
      const generated = await this.trainingEngine.runTurn({
        config,
        turns: data.turns,
        userText,
        originalText,
        learnerFirstName:
          data.learnerFirstName ??
          learnerNameFallback(teachingLanguageFromConfig(config)),
        sessionProgressTurn: data.session.progressTurn,
      });
      reply = generated.reply;
      turnAiDebug = generated.aiDebug;
    } catch (err) {
      throwAiServiceBadGateway(err, chatDebug);
    }

    const maxTurnsReached = nextTurn >= config.maxTurns;
    const isTaskComplete = Boolean(reply.isLessonComplete) || maxTurnsReached;
    const expectsUserSpeech = isTaskComplete
      ? false
      : (reply.expectsUserSpeech ?? true);
    const expectedSpeech = reply.expectedSpeech?.trim() || null;
    const emojiChoice = normalizeEmojiChoice(reply.emojiChoice);
    const guidedSpeaking = normalizeGuidedSpeaking(reply.guidedSpeaking);

    const prevProgressTurn = data.session.progressTurn ?? 0;
    const lastAiTurn = [...data.turns]
      .reverse()
      .find((t) => t.speaker === 'ai');
    const nextProgressTurn = resolveLessonProgressTurn(
      config.lessonId,
      prevProgressTurn,
      config.progressMax,
        {
          textEn: reply.textEn,
          expectsUserSpeech,
          expectedSpeech,
          emojiChoice,
          guidedSpeaking,
          roleplayIntro: null,
          roleplayNpc: null,
          isTaskComplete,
          assessmentTier: reply.assessmentTier,
        },
        lastAiTurn
          ? {
              expectedSpeech: lastAiTurn.expectedSpeech,
              emojiChoice: lastAiTurn.emojiChoice,
              guidedSpeaking: lastAiTurn.guidedSpeaking,
            }
          : undefined,
    );

    this.sessionStore.updateTrainingState(sessionId, {
      currentTurn: nextTurn,
      isComplete: isTaskComplete,
      ...(config.progressMax != null
        ? { progressTurn: nextProgressTurn }
        : {}),
    });

    this.sessionStore.addTurn(sessionId, {
      speaker: 'ai',
      textEn: reply.textEn,
      ttsText: reply.ttsText ?? null,
      ttsInstruction: reply.ttsInstruction ?? null,
      textTh: reply.textTh,
      audioUrl: null,
      expectsUserSpeech,
      expectedSpeech,
      emojiChoice,
      guidedSpeaking,
      assessmentTier: reply.assessmentTier,
      wasSoftAdvance: reply.wasSoftAdvance,
      completionStatus: reply.completionStatus,
    });

    const response: TurnExchangeResponse = {
      aiResponse: reply.textEn,
      ...(reply.ttsText?.trim() ? { ttsText: reply.ttsText.trim() } : {}),
      ...(reply.ttsInstruction?.trim()
        ? { ttsInstruction: reply.ttsInstruction.trim() }
        : {}),
      textTh: reply.textTh ?? '',
      isTaskComplete,
      updatedCheckpoints: {},
      feedbackHints: { mispronouncedWords: [] },
      currentTurn: nextTurn,
      ...(config.progressMax != null
        ? {
            progressTurn: nextProgressTurn,
            progressMax: config.progressMax,
          }
        : {}),
      expectsUserSpeech,
      expectedSpeech,
      emojiChoice,
      guidedSpeaking,
      ...(reply.assessmentTier ? { assessmentTier: reply.assessmentTier } : {}),
      ...(reply.wasSoftAdvance ? { wasSoftAdvance: true } : {}),
      ...(reply.completionStatus ? { completionStatus: reply.completionStatus } : {}),
    };

    if (body.generateAudio) {
      const audio = await this.geminiTts.synthesizeSpeech(
        reply.ttsText?.trim() || reply.textEn,
      );
      response.audioBase64 = audio.toString('base64');
      response.contentType = 'audio/wav';
    }

    return attachAiDebug(
      response,
      chatDebug,
      turnAiDebug,
      handlerStartedAt,
    );
  }

  private async processTrainingTurn(
    sessionId: string,
    body: TurnDto,
    chatDebug = false,
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
    let userTurnAdded = false;
    const handlerStartedAt = performance.now();
    let turnAiDebug: AiDebug | undefined;
    try {
      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
        originalTextEn: originalText,
      });
      userTurnAdded = true;

      if (data.session.engineVersion === 2) {
        return this.processTrainingTurnV2(
          sessionId,
          body,
          data,
          config,
          chatDebug,
          handlerStartedAt,
          expectedTurn,
          userText,
          originalText,
        );
      }

      const nextTurn = expectedTurn + 1;
      let reply: import('../gemini/gemini-chat.service').TrainingTurnReply;

      // Daily Routine board turns are fully scripted — skip Gemini when possible.
      const scriptedFirst = buildDailyRoutineFallbackTrainingReply(
        config.lessonId,
        data.turns,
        nextTurn,
      );
      if (scriptedFirst) {
        reply = scriptedFirst;
        turnAiDebug = scriptedAiDebug();
      } else {
        try {
          const generated = await this.chat.generateTrainingTurn(
            config,
            data.turns,
            userText,
            nextTurn,
            data.learnerFirstName ??
              learnerNameFallback(teachingLanguageFromConfig(config)),
            originalText,
          );
          reply = generated.reply;
          turnAiDebug = generated.aiDebug;
        } catch (aiErr) {
          const fallback = buildDailyRoutineFallbackTrainingReply(
            config.lessonId,
            data.turns,
            nextTurn,
          );
          if (!fallback) {
            throw aiErr;
          }
          reply = fallback;
          turnAiDebug = scriptedAiDebug();
        }
      }

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
      let shoppingSoftTeachForced = false;
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
        shoppingSoftTeachForced = true;
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

      // After Airport Mini (Here is my passport) → Roleplay Intro.
      const forcedAirportBridge = forceAirportRoleplayBridgeIfNeeded(
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
      if (forcedAirportBridge != null) {
        textEn = forcedAirportBridge.textEn;
        textTh = forcedAirportBridge.textTh;
        expectsUserSpeech = forcedAirportBridge.expectsUserSpeech;
        expectedSpeech = forcedAirportBridge.expectedSpeech;
        roleplayNpc = forcedAirportBridge.roleplayNpc;
        roleplayIntro = forcedAirportBridge.roleplayIntro;
        guidedSpeaking = forcedAirportBridge.guidedSpeaking;
        emojiChoice = forcedAirportBridge.emojiChoice;
        isTaskComplete = forcedAirportBridge.isTaskComplete;
      }

      // After Pharmacy Mini (Can you help me?) → Roleplay Intro.
      const forcedPharmacyBridge = forcePharmacyRoleplayBridgeIfNeeded(
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
      if (forcedPharmacyBridge != null) {
        textEn = forcedPharmacyBridge.textEn;
        textTh = forcedPharmacyBridge.textTh;
        expectsUserSpeech = forcedPharmacyBridge.expectsUserSpeech;
        expectedSpeech = forcedPharmacyBridge.expectedSpeech;
        roleplayNpc = forcedPharmacyBridge.roleplayNpc;
        roleplayIntro = forcedPharmacyBridge.roleplayIntro;
        guidedSpeaking = forcedPharmacyBridge.guidedSpeaking;
        emojiChoice = forcedPharmacyBridge.emojiChoice;
        isTaskComplete = forcedPharmacyBridge.isTaskComplete;
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

      // After Last Night Step 4b (when…) → Roleplay Intro.
      const forcedLastNightBridge = forceLastNightRoleplayBridgeIfNeeded(
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
      if (forcedLastNightBridge != null) {
        textEn = forcedLastNightBridge.textEn;
        textTh = forcedLastNightBridge.textTh;
        expectsUserSpeech = forcedLastNightBridge.expectsUserSpeech;
        expectedSpeech = forcedLastNightBridge.expectedSpeech;
        roleplayNpc = forcedLastNightBridge.roleplayNpc;
        roleplayIntro = forcedLastNightBridge.roleplayIntro;
        guidedSpeaking = forcedLastNightBridge.guidedSpeaking;
        emojiChoice = forcedLastNightBridge.emojiChoice;
        isTaskComplete = forcedLastNightBridge.isTaskComplete;
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

      // Last Night 3.10: pin guidedSpeaking boards Steps 1–4.
      const forcedLastNight = forceLastNightGuidedSpeakingIfNeeded(
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
      if (forcedLastNight != null) {
        textEn = forcedLastNight.textEn;
        textTh = forcedLastNight.textTh;
        guidedSpeaking = forcedLastNight.guidedSpeaking;
        expectsUserSpeech = forcedLastNight.expectsUserSpeech;
        expectedSpeech = forcedLastNight.expectedSpeech;
        emojiChoice = forcedLastNight.emojiChoice;
        isTaskComplete = forcedLastNight.isTaskComplete;
      }

      // About Me choice lessons: wrong answer → เฉลย + พูดตาม (never re-ask same question).
      const aboutMeSoftTeach = forceAboutMeSoftTeachForLesson(
        config.lessonId,
        teachingLang,
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
      if (aboutMeSoftTeach != null) {
        textEn = aboutMeSoftTeach.textEn;
        textTh = aboutMeSoftTeach.textTh;
        guidedSpeaking = aboutMeSoftTeach.guidedSpeaking;
        expectsUserSpeech = aboutMeSoftTeach.expectsUserSpeech;
        expectedSpeech = aboutMeSoftTeach.expectedSpeech;
        emojiChoice = aboutMeSoftTeach.emojiChoice;
        isTaskComplete = aboutMeSoftTeach.isTaskComplete;
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

      // Work & School 1.4: pin Activity / Location / Feeling / Combo boards.
      const forcedWorkSchool = forceWorkSchoolGuidedSpeakingIfNeeded(
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
      if (forcedWorkSchool != null) {
        textEn = forcedWorkSchool.textEn;
        textTh = forcedWorkSchool.textTh;
        guidedSpeaking = forcedWorkSchool.guidedSpeaking;
        expectsUserSpeech = forcedWorkSchool.expectsUserSpeech;
        expectedSpeech = forcedWorkSchool.expectedSpeech;
        emojiChoice = forcedWorkSchool.emojiChoice;
        isTaskComplete = forcedWorkSchool.isTaskComplete;
      }

      const forcedWorkSchoolCelebrate = forceWorkSchoolCelebrateIfNeeded(
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
      if (forcedWorkSchoolCelebrate != null) {
        textEn = forcedWorkSchoolCelebrate.textEn;
        textTh = forcedWorkSchoolCelebrate.textTh;
        expectsUserSpeech = forcedWorkSchoolCelebrate.expectsUserSpeech;
        expectedSpeech = forcedWorkSchoolCelebrate.expectedSpeech;
        guidedSpeaking = forcedWorkSchoolCelebrate.guidedSpeaking;
        emojiChoice = forcedWorkSchoolCelebrate.emojiChoice;
        isTaskComplete = forcedWorkSchoolCelebrate.isTaskComplete;
      }

      // Hobbies 1.5: pin Hobby / Frequency / Weekend / Quiz boards.
      const forcedHobbies = forceHobbiesGuidedSpeakingIfNeeded(
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
      if (forcedHobbies != null) {
        textEn = forcedHobbies.textEn;
        textTh = forcedHobbies.textTh;
        guidedSpeaking = forcedHobbies.guidedSpeaking;
        expectsUserSpeech = forcedHobbies.expectsUserSpeech;
        expectedSpeech = forcedHobbies.expectedSpeech;
        emojiChoice = forcedHobbies.emojiChoice;
        isTaskComplete = forcedHobbies.isTaskComplete;
      }

      const forcedHobbiesCelebrate = forceHobbiesCelebrateIfNeeded(
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
      if (forcedHobbiesCelebrate != null) {
        textEn = forcedHobbiesCelebrate.textEn;
        textTh = forcedHobbiesCelebrate.textTh;
        expectsUserSpeech = forcedHobbiesCelebrate.expectsUserSpeech;
        expectedSpeech = forcedHobbiesCelebrate.expectedSpeech;
        guidedSpeaking = forcedHobbiesCelebrate.guidedSpeaking;
        emojiChoice = forcedHobbiesCelebrate.emojiChoice;
        isTaskComplete = forcedHobbiesCelebrate.isTaskComplete;
      }

      // Pets 1.6: tip (listen-only) then Cat/Dog / Describe / Your boards.
      const forcedPetsTip = forcePetsTipIfNeeded(
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
      if (forcedPetsTip != null) {
        textEn = forcedPetsTip.textEn;
        textTh = forcedPetsTip.textTh;
        expectsUserSpeech = forcedPetsTip.expectsUserSpeech;
        expectedSpeech = forcedPetsTip.expectedSpeech;
        guidedSpeaking = forcedPetsTip.guidedSpeaking;
        emojiChoice = forcedPetsTip.emojiChoice;
        isTaskComplete = forcedPetsTip.isTaskComplete;
      }

      const forcedPets = forcePetsGuidedSpeakingIfNeeded(
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
      if (forcedPets != null) {
        textEn = forcedPets.textEn;
        textTh = forcedPets.textTh;
        guidedSpeaking = forcedPets.guidedSpeaking;
        expectsUserSpeech = forcedPets.expectsUserSpeech;
        expectedSpeech = forcedPets.expectedSpeech;
        emojiChoice = forcedPets.emojiChoice;
        isTaskComplete = forcedPets.isTaskComplete;
      }

      const forcedPetsCelebrate = forcePetsCelebrateIfNeeded(
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
      if (forcedPetsCelebrate != null) {
        textEn = forcedPetsCelebrate.textEn;
        textTh = forcedPetsCelebrate.textTh;
        expectsUserSpeech = forcedPetsCelebrate.expectsUserSpeech;
        expectedSpeech = forcedPetsCelebrate.expectedSpeech;
        guidedSpeaking = forcedPetsCelebrate.guidedSpeaking;
        emojiChoice = forcedPetsCelebrate.emojiChoice;
        isTaskComplete = forcedPetsCelebrate.isTaskComplete;
      }

      // People 1.7: pin Person / Job / Personality / Quiz boards.
      const forcedPeople = forcePeopleGuidedSpeakingIfNeeded(
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
      if (forcedPeople != null) {
        textEn = forcedPeople.textEn;
        textTh = forcedPeople.textTh;
        guidedSpeaking = forcedPeople.guidedSpeaking;
        expectsUserSpeech = forcedPeople.expectsUserSpeech;
        expectedSpeech = forcedPeople.expectedSpeech;
        emojiChoice = forcedPeople.emojiChoice;
        isTaskComplete = forcedPeople.isTaskComplete;
      }

      const forcedPeopleCelebrate = forcePeopleCelebrateIfNeeded(
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
      if (forcedPeopleCelebrate != null) {
        textEn = forcedPeopleCelebrate.textEn;
        textTh = forcedPeopleCelebrate.textTh;
        expectsUserSpeech = forcedPeopleCelebrate.expectsUserSpeech;
        expectedSpeech = forcedPeopleCelebrate.expectedSpeech;
        guidedSpeaking = forcedPeopleCelebrate.guidedSpeaking;
        emojiChoice = forcedPeopleCelebrate.emojiChoice;
        isTaskComplete = forcedPeopleCelebrate.isTaskComplete;
      }

      // Weather 1.9: pin Hot quiz / cold apply / preference / rainy quiz.
      const forcedWeather = forceWeatherGuidedSpeakingIfNeeded(
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
      if (forcedWeather != null) {
        textEn = forcedWeather.textEn;
        textTh = forcedWeather.textTh;
        guidedSpeaking = forcedWeather.guidedSpeaking;
        expectsUserSpeech = forcedWeather.expectsUserSpeech;
        expectedSpeech = forcedWeather.expectedSpeech;
        emojiChoice = forcedWeather.emojiChoice;
        isTaskComplete = forcedWeather.isTaskComplete;
      }

      const forcedWeatherCelebrate = forceWeatherCelebrateIfNeeded(
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
      if (forcedWeatherCelebrate != null) {
        textEn = forcedWeatherCelebrate.textEn;
        textTh = forcedWeatherCelebrate.textTh;
        expectsUserSpeech = forcedWeatherCelebrate.expectsUserSpeech;
        expectedSpeech = forcedWeatherCelebrate.expectedSpeech;
        guidedSpeaking = forcedWeatherCelebrate.guidedSpeaking;
        emojiChoice = forcedWeatherCelebrate.emojiChoice;
        isTaskComplete = forcedWeatherCelebrate.isTaskComplete;
      }

      // Friends 1.8: pin activity / eat out / They play / hang out / free recall.
      const forcedFriends = forceFriendsGuidedSpeakingIfNeeded(
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
      if (forcedFriends != null) {
        textEn = forcedFriends.textEn;
        textTh = forcedFriends.textTh;
        guidedSpeaking = forcedFriends.guidedSpeaking;
        expectsUserSpeech = forcedFriends.expectsUserSpeech;
        expectedSpeech = forcedFriends.expectedSpeech;
        emojiChoice = forcedFriends.emojiChoice;
        isTaskComplete = forcedFriends.isTaskComplete;
      }

      const forcedFriendsCelebrate = forceFriendsCelebrateIfNeeded(
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
      if (forcedFriendsCelebrate != null) {
        textEn = forcedFriendsCelebrate.textEn;
        textTh = forcedFriendsCelebrate.textTh;
        expectsUserSpeech = forcedFriendsCelebrate.expectsUserSpeech;
        expectedSpeech = forcedFriendsCelebrate.expectedSpeech;
        guidedSpeaking = forcedFriendsCelebrate.guidedSpeaking;
        emojiChoice = forcedFriendsCelebrate.emojiChoice;
        isTaskComplete = forcedFriendsCelebrate.isTaskComplete;
      }

      // Favorites 1.10: pin prefer / opinion / friends / group boards (pre-roleplay).
      const forcedFavorites = forceFavoritesGuidedSpeakingIfNeeded(
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
          roleplayIntro,
          roleplayNpc,
        },
      );
      if (forcedFavorites != null) {
        textEn = forcedFavorites.textEn;
        textTh = forcedFavorites.textTh;
        guidedSpeaking = forcedFavorites.guidedSpeaking;
        expectsUserSpeech = forcedFavorites.expectsUserSpeech;
        expectedSpeech = forcedFavorites.expectedSpeech;
        emojiChoice = forcedFavorites.emojiChoice;
        isTaskComplete = forcedFavorites.isTaskComplete;
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
      const forcedLastNightCelebrate =
        forceLastNightCelebrateAfterCloseIfNeeded(
          config.lessonId,
          teachingLang,
          data.turns,
          {
            textEn,
            textTh,
            expectsUserSpeech,
            roleplayIntro,
            roleplayNpc,
            isTaskComplete,
          },
        );
      if (forcedLastNightCelebrate != null) {
        textEn = forcedLastNightCelebrate.textEn;
        textTh = forcedLastNightCelebrate.textTh;
        expectsUserSpeech = forcedLastNightCelebrate.expectsUserSpeech;
        expectedSpeech = forcedLastNightCelebrate.expectedSpeech;
        roleplayNpc = forcedLastNightCelebrate.roleplayNpc;
        roleplayIntro = null;
        guidedSpeaking = null;
        emojiChoice = null;
        isTaskComplete = forcedLastNightCelebrate.isTaskComplete;
      }

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
                      : config.lessonId === 'ee_around_town_airport'
                        ? AIRPORT_ROLEPLAY_OBJECTIVE
                        : config.lessonId === 'ee_around_town_pharmacy'
                          ? PHARMACY_ROLEPLAY_OBJECTIVE
                          : config.lessonId === 'ee_about_me_favorites'
                            ? FAVORITES_ROLEPLAY_OBJECTIVE
                            : config.lessonId === 'ee_stories_last_night'
                              ? LAST_NIGHT_ROLEPLAY_OBJECTIVE
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

      const prevProgressTurn = data.session.progressTurn ?? 0;
      const lastAiTurn = [...data.turns]
        .reverse()
        .find((t) => t.speaker === 'ai');
      const nextProgressTurn = resolveLessonProgressTurn(
        config.lessonId,
        prevProgressTurn,
        config.progressMax,
        {
          textEn: staffSpeech.textEn,
          expectsUserSpeech,
          expectedSpeech,
          emojiChoice,
          roleplayIntro,
          roleplayNpc: isTaskComplete ? null : roleplayNpc,
          isTaskComplete,
          softTeachForced: shoppingSoftTeachForced,
        },
        lastAiTurn
          ? {
              expectedSpeech: lastAiTurn.expectedSpeech,
              emojiChoice: lastAiTurn.emojiChoice,
            }
          : undefined,
      );

      this.sessionStore.updateTrainingState(sessionId, {
        currentTurn: nextTurn,
        isComplete: isTaskComplete,
        ...(config.progressMax != null
          ? { progressTurn: nextProgressTurn }
          : {}),
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
        ...(config.progressMax != null
          ? {
              progressTurn: nextProgressTurn,
              progressMax: config.progressMax,
            }
          : {}),
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
        ...(reply.assessmentTier ? { assessmentTier: reply.assessmentTier } : {}),
      };

      if (body.generateAudio) {
        const audio = await this.geminiTts.synthesizeSpeech(staffSpeech.textEn);
        response.audioBase64 = audio.toString('base64');
        response.contentType = 'audio/wav';
      }

      return attachAiDebug(
        response,
        chatDebug,
        turnAiDebug,
        handlerStartedAt,
      );
    } catch (err) {
      if (userTurnAdded) {
        this.sessionStore.removeLastTurn(sessionId);
      }
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof ConflictException
      ) {
        throw err;
      }
      throwAiServiceBadGateway(err, chatDebug);
    }
  }

  private async processSimulationTurn(
    sessionId: string,
    body: TurnDto,
    chatDebug = false,
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
    let userTurnAdded = false;
    const handlerStartedAt = performance.now();
    let turnAiDebug: AiDebug | undefined;
    try {
      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
        originalTextEn: originalText,
      });
      userTurnAdded = true;

      const nextTurn = expectedTurn + 1;
      const { reply, aiDebug: turnAiDebugFromGemini } =
        await this.chat.generateSimulationTurn(
        config,
        data.turns,
        userText,
        data.session.checkpointStates ?? {},
        nextTurn,
      );
      turnAiDebug = turnAiDebugFromGemini;

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

      const heuristicCheckpoints = applySimulationCheckpointHeuristics(
        config,
        userText,
        data.turns,
        mergedCheckpoints,
      );

      const finalized = finalizeSimulationTurnState(
        config,
        nextTurn,
        heuristicCheckpoints,
        { aiResponse: reply.aiResponse, textTh: reply.textTh },
        data.turns,
      );

      const isTaskComplete = finalized.isTaskComplete;

      this.sessionStore.updateSimulationState(sessionId, {
        currentTurn: nextTurn,
        checkpointStates: finalized.checkpoints,
        isComplete: isTaskComplete,
      });

      const aiTurn = {
        speaker: 'ai' as const,
        textEn: finalized.reply.aiResponse,
        textTh: finalized.reply.textTh,
        audioUrl: null,
      };
      this.sessionStore.addTurn(sessionId, aiTurn);

      const response: TurnExchangeResponse = {
        aiResponse: finalized.reply.aiResponse,
        textTh: finalized.reply.textTh,
        isTaskComplete,
        updatedCheckpoints: finalized.checkpoints,
        feedbackHints: {
          grammarTip: reply.feedbackHints.grammarTip,
          mispronouncedWords: reply.feedbackHints.mispronouncedWords ?? [],
        },
        currentTurn: nextTurn,
      };

      if (body.generateAudio) {
        const audio = await this.geminiTts.synthesizeSpeech(
          finalized.reply.aiResponse,
        );
        response.audioBase64 = audio.toString('base64');
        response.contentType = 'audio/wav';
      }

      return attachAiDebug(
        response,
        chatDebug,
        turnAiDebug,
        handlerStartedAt,
      );
    } catch (err) {
      if (userTurnAdded) {
        this.sessionStore.removeLastTurn(sessionId);
      }
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof ConflictException
      ) {
        throw err;
      }
      throwAiServiceBadGateway(err, chatDebug);
    }
  }

  private async processLegacyTurn(
    sessionId: string,
    body: TurnDto,
    chatDebug = false,
  ) {
    const data = this.sessionStore.get(sessionId)!;

    let originalText = (body.transcript ?? body.userSpeechText ?? '').trim();
    if (!originalText) {
      throw new BadRequestException('transcript is required');
    }

    const topicId = data.session.topicId ?? 'coffee';
    let userText = originalText;
    if (topicId === 'free_talk') {
      const level = data.freeTalk?.languageLevel ?? 'balanced';
      const shouldCorrectThaiMix =
        body.thaiMixEnabled &&
        level !== 'englishOnly' &&
        containsThaiScript(originalText);
      if (shouldCorrectThaiMix) {
        this.sessionStore.markThaiMixUsed(sessionId);
        userText = await this.chat.correctThaiMix(originalText);
      }
    }

    const handlerStartedAt = performance.now();
    let turnAiDebug: AiDebug | undefined;
    try {
      this.sessionStore.addTurn(sessionId, {
        speaker: 'user',
        textEn: userText,
        originalTextEn: originalText,
      });

      const userTurnCount = data.turns.filter(
        (turn) => turn.speaker === 'user',
      ).length;

      if (topicId === 'free_talk') {
        const ft = data.freeTalk;
        const userTurnIndex = data.turns.filter(
          (turn) => turn.speaker === 'user',
        ).length;
        const { reply, suggestion, aiDebug } =
          await this.chat.generateFreeTalkReply({
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
        turnAiDebug = aiDebug;
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
        return attachAiDebug(
          {
            ...aiTurn,
            suggestionDebug: suggestion.debug,
          },
          chatDebug,
          turnAiDebug,
          handlerStartedAt,
        );
      }

      let reply: { textEn: string; textTh: string };
      if (topicId === 'intro' && userTurnCount === 1) {
        reply = getTurn2Script(userText);
        turnAiDebug = scriptedAiDebug();
      } else if (topicId === 'intro' && userTurnCount === 2) {
        reply = getTurn3Script(userText);
        turnAiDebug = scriptedAiDebug();
      } else {
        const generated = await this.chat.generateReply(
          topicId,
          data.turns,
          userText,
        );
        reply = generated.reply;
        turnAiDebug = generated.aiDebug;
      }

      const aiTurn = {
        speaker: 'ai' as const,
        textEn: reply.textEn,
        textTh: reply.textTh,
        audioUrl: null,
      };
      this.sessionStore.addTurn(sessionId, aiTurn);
      data.turns[data.turns.length - 1] = aiTurn;

      return attachAiDebug(aiTurn, chatDebug, turnAiDebug, handlerStartedAt);
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      throwAiServiceBadGateway(err, chatDebug);
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
    @Body() body: EndSessionDto,
  ) {
    const chatDebug = isChatDebugRequest(req);
    const data = this.sessionStore.get(sessionId);
    if (!data) {
      throw new NotFoundException('Session not found');
    }

    if (
      body.speakingMetrics?.turns?.length &&
      (data.session.sessionType === 'simulation' ||
        data.session.topicId === 'free_talk')
    ) {
      this.sessionStore.setSpeakingMetrics(sessionId, {
        turns: body.speakingMetrics.turns,
      });
    }

    this.sessionStore.markEnded(sessionId);

    if (data.session.topicId === 'intro') {
      try {
        const introReport = await this.chat.generateIntroReport(data.turns);
        this.sessionStore.setIntroReport(sessionId, introReport);
        await this.users.updateDisplayName(req.user.id, introReport.userName);
        return { status: 'ended', introReport };
      } catch (err) {
        throwAiServiceBadGateway(err, chatDebug);
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
        throwAiServiceBadGateway(err, chatDebug);
      }
    }

    return { status: 'ended' };
  }

  @Get(':sessionId/intro-report')
  async getIntroReport(
    @Req() req: AuthedRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<IntroReportResponse> {
    const chatDebug = isChatDebugRequest(req);
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
      throwAiServiceBadGateway(err, chatDebug);
    }
  }

  @Get(':sessionId/report')
  async getReport(
    @Req() req: AuthedRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<MissionResultResponse> {
    const chatDebug = isChatDebugRequest(req);
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

        let speakingAssessment: SpeakingAssessmentResult | undefined;
        if (data.speakingMetrics?.turns?.length && data.simulationConfig) {
          speakingAssessment = await this.buildSpeakingAssessment(
            data.speakingMetrics,
            data.simulationConfig,
          );
        }

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
                    speakingMetrics: data.speakingMetrics,
                    speakingSkills: speakingAssessment?.speakingSkills,
                    speakingSkillBreakdown:
                      speakingAssessment?.speakingSkillBreakdown,
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
          speakingSkills: speakingAssessment?.speakingSkills,
          speakingSkillBreakdown: speakingAssessment?.speakingSkillBreakdown,
          speakingMetrics: data.speakingMetrics,
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

        let speakingAssessment: SpeakingAssessmentResult | undefined;
        if (data.speakingMetrics?.turns?.length) {
          speakingAssessment = await this.buildFreeTalkSpeakingAssessment(
            data.speakingMetrics,
            data.turns,
          );
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
          turnFeedback: report.turnFeedback ?? [],
          speakingSkills: speakingAssessment?.speakingSkills,
          speakingSkillBreakdown: speakingAssessment?.speakingSkillBreakdown,
          speakingMetrics: data.speakingMetrics,
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
      throwAiServiceBadGateway(err, chatDebug);
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
      speakingSkills: stored.speakingSkills,
      speakingSkillBreakdown: stored.speakingSkillBreakdown,
      speakingMetrics: stored.speakingMetrics as SpeakingMetricsPayload | undefined,
    };
  }

  private async buildSpeakingAssessment(
    metrics: SpeakingMetricsPayload,
    config: import('../simulations/simulations.data').SimulationConfig,
  ): Promise<SpeakingAssessmentResult> {
    const transcripts = metrics.turns
      .map((t) => t.transcript?.trim() ?? '')
      .filter((t) => t.length > 0);

    const [grammarStats, vocabularyStats] = await Promise.all([
      this.chat.generateGrammarStats(transcripts),
      this.chat.generateVocabularyStats({
        transcripts,
        scenarioTh: config.scenarioTh,
        goalsEn: config.goalsEn,
        vocabDrillWords: config.vocabDrill.map((v) => v.word),
      }),
    ]);

    return computeSpeakingAssessment({
      metrics,
      expectedPrompts: config.successCriteria.length,
      grammarStats,
      vocabularyStats,
    });
  }

  private async buildFreeTalkSpeakingAssessment(
    metrics: SpeakingMetricsPayload,
    turns: ChatTurn[],
  ): Promise<SpeakingAssessmentResult> {
    const transcripts = metrics.turns
      .map((t) => t.transcript?.trim() ?? '')
      .filter((t) => t.length > 0);

    const aiTurnCount = turns.filter((t) => t.speaker === 'ai').length;
    const expectedPrompts = Math.max(aiTurnCount, metrics.turns.length, 1);

    const [grammarStats, vocabularyStats] = await Promise.all([
      this.chat.generateGrammarStats(transcripts),
      this.chat.generateVocabularyStats({
        transcripts,
        scenarioTh: 'คุยเล่นกับครูพี่บี — ฝึกสนทนาภาษาอังกฤษอิสระ',
        goalsEn: [
          'natural conversation',
          'express yourself clearly',
          'practice spoken English',
        ],
        vocabDrillWords: [],
      }),
    ]);

    return computeSpeakingAssessment({
      metrics,
      expectedPrompts,
      grammarStats,
      vocabularyStats,
    });
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
    if (!fb) return base;
    const headlineTh =
      fb.headlineTh.trim() || turnFeedbackHeadlineFallback(fb.status);
    return {
      ...base,
      feedback: {
        status: fb.status,
        headlineTh,
        detailTh: fb.detailTh || null,
        suggestionEn: fb.suggestionEn || null,
        suggestionReasonTh: fb.suggestionReasonTh || null,
      },
    };
  });
}

function turnFeedbackHeadlineFallback(
  status: TurnFeedbackItem['status'],
): string {
  switch (status) {
    case 'great':
      return 'ดีมาก';
    case 'good':
      return 'พูดได้ดี';
    case 'needs_improvement':
      return 'ควรปรับ';
    default:
      return 'พูดได้';
  }
}

function firstNameFromDisplayName(
  displayName?: string | null,
  teachingLanguage: 'thai' | 'english' = 'thai',
): string {
  const trimmed = (displayName ?? '').trim();
  if (!trimmed) return learnerNameFallback(teachingLanguage);
  return trimmed.split(/\s+/)[0]!;
}
