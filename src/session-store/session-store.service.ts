import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EmojiSpeakPrompt,
  GptIntroReport,
  LessonScene,
  SessionType,
} from '../common/api.types';
import type { SimulationConfig } from '../simulations/simulations.data';
import { initCheckpointStates } from '../simulations/simulations.data';
import type { LessonConfig } from '../lessons/lessons.data';
import { teachingLanguageFromConfig, learnerNameFallback } from '../lessons/lesson-prompt';
import type {
  FreeTalkIssueLogEntry,
  FreeTalkLanguageLevel,
  FreeTalkNextAction,
  FreeTalkPhase,
} from '../topics/topics.data';
import { freeTalkSuggestionBudget } from '../topics/topics.data';

export interface ChatTurn {
  speaker: 'user' | 'ai';
  textEn: string;
  textTh?: string | null;
  audioUrl?: string | null;
  /** Raw learner utterance before Thai Mix (user turns only). */
  originalTextEn?: string | null;
  /**
   * What the app actually showed after this tutor turn (ai turns only).
   * Replayed to the model so it does not learn from a made-up value.
   */
  expectsUserSpeech?: boolean;
  /** Multi-speaker Scene dialogue (ai turns only). */
  scene?: LessonScene | null;
  /**
   * Exact English the learner should say (ai turns only).
   * Used by the app to bias Whisper on single-word repeat turns.
   */
  expectedSpeech?: string | null;
  /** In-chat Emoji Speak card (ai turns only). */
  emojiSpeak?: EmojiSpeakPrompt | null;
}

export interface ConversationSession {
  id: string;
  sessionType: SessionType;
  topicId?: string;
  simulationId?: string;
  lessonId?: string;
  startedAt: string;
  durationLimitSeconds?: number;
  currentTurn?: number;
  maxTurns?: number;
  checkpointStates?: Record<string, boolean>;
  isComplete?: boolean;
}

export interface FreeTalkSessionState {
  languageLevel: FreeTalkLanguageLevel;
  phase: FreeTalkPhase;
  topic: string | null;
  nextAction: FreeTalkNextAction | null;
  /** Prior memories injected at session start. */
  priorMemories: string[];
  /** Mid-chat grammar soft-recast count this session. */
  grammarSuggestionsUsed: number;
  /** Mid-chat naturalness soft-recast count this session. */
  naturalnessSuggestionsUsed: number;
  grammarSuggestionMax: number;
  naturalnessSuggestionMax: number;
  /** Internal issue log for end-of-session report (not shown mid-chat). */
  issueLog: FreeTalkIssueLogEntry[];
  /** Filled on session end. */
  conversationSummaryEn?: string;
  conversationSummaryTh?: string;
  extractedMemories?: string[];
  /** Full Free Talk report cached after end (avoids a second Gemini call). */
  endedReport?: {
    feedbackEn: string;
    feedbackTh: string;
    bestSentenceEn: string;
    bestSentenceNoteTh: string;
    grammarTip: string;
    grammarTipTh: string;
    vocab: Array<{ word: string; meaningTh: string; exampleEn: string }>;
    pronunciationIssues: Array<{ word: string; scorePercent: number }>;
    turnFeedback?: Array<{
      userTurnIndex: number;
      status: 'great' | 'good' | 'needs_improvement';
      headlineTh: string;
      detailTh?: string | null;
      suggestionEn?: string | null;
      suggestionReasonTh?: string | null;
    }>;
    conversationSummaryEn: string;
    conversationSummaryTh: string;
    memories: string[];
  };
}

export interface SessionData {
  session: ConversationSession;
  turns: ChatTurn[];
  turnCounter: number;
  endedAt: Date | null;
  introReport: GptIntroReport | null;
  simulationConfig?: SimulationConfig;
  lessonConfig?: LessonConfig;
  /** First name for 1:1 tutor address (training sessions). */
  learnerFirstName?: string;
  freeTalk?: FreeTalkSessionState;
  /** Hint sheet opens this session. */
  hintsUsed: number;
  /** True if Thai Mix was used on any turn. */
  thaiMixUsed: boolean;
}

@Injectable()
export class SessionStoreService {
  private readonly sessions = new Map<string, SessionData>();

  constructor(private readonly config: ConfigService) {}

  create(
    topicId: string,
    options?: {
      durationLimitSeconds?: number;
      freeTalk?: {
        languageLevel: FreeTalkLanguageLevel;
        priorMemories?: string[];
      };
    },
  ): SessionData {
    const sessionId = `session_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const sessionType: SessionType = topicId === 'intro' ? 'intro' : 'legacy';
    const session: ConversationSession = {
      id: sessionId,
      sessionType,
      topicId,
      startedAt: new Date().toISOString(),
      durationLimitSeconds:
        options?.durationLimitSeconds ??
        this.config.get<number>('SESSION_DURATION_SECONDS', 300),
    };
    const budget = freeTalkSuggestionBudget(options?.durationLimitSeconds);
    const data: SessionData = {
      session,
      turns: [],
      turnCounter: 0,
      endedAt: null,
      introReport: null,
      hintsUsed: 0,
      thaiMixUsed: false,
      freeTalk: options?.freeTalk
        ? {
            languageLevel: options.freeTalk.languageLevel,
            phase: 'greeting',
            topic: null,
            nextAction: null,
            priorMemories: options.freeTalk.priorMemories ?? [],
            grammarSuggestionsUsed: 0,
            naturalnessSuggestionsUsed: 0,
            grammarSuggestionMax: budget.grammarMax,
            naturalnessSuggestionMax: budget.naturalnessMax,
            issueLog: [],
          }
        : undefined,
    };
    this.sessions.set(sessionId, data);
    return data;
  }

  createSimulation(config: SimulationConfig): SessionData {
    const sessionId = `session_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const session: ConversationSession = {
      id: sessionId,
      sessionType: 'simulation',
      simulationId: config.simulationId,
      startedAt: new Date().toISOString(),
      currentTurn: 0,
      maxTurns: config.maxTurns,
      checkpointStates: initCheckpointStates(config.successCriteria),
      isComplete: false,
    };
    const data: SessionData = {
      session,
      turns: [],
      turnCounter: 0,
      endedAt: null,
      introReport: null,
      simulationConfig: config,
      hintsUsed: 0,
      thaiMixUsed: false,
    };
    this.sessions.set(sessionId, data);
    return data;
  }

  createTraining(
    config: LessonConfig,
    learnerFirstName?: string,
  ): SessionData {
    const lang = teachingLanguageFromConfig(config);
    const name = learnerFirstName?.trim() || learnerNameFallback(lang);
    const sessionId = `session_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const session: ConversationSession = {
      id: sessionId,
      sessionType: 'training',
      lessonId: config.lessonId,
      startedAt: new Date().toISOString(),
      currentTurn: 0,
      maxTurns: config.maxTurns,
      isComplete: false,
    };
    const data: SessionData = {
      session,
      turns: [],
      turnCounter: 0,
      endedAt: null,
      introReport: null,
      lessonConfig: config,
      learnerFirstName: name,
      hintsUsed: 0,
      thaiMixUsed: false,
    };
    this.sessions.set(sessionId, data);
    return data;
  }

  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  addTurn(sessionId: string, turn: ChatTurn): number {
    const data = this.require(sessionId);
    data.turns.push(turn);
    data.turnCounter += 1;
    return data.turnCounter;
  }

  updateFreeTalkState(
    sessionId: string,
    updates: Partial<FreeTalkSessionState>,
  ): void {
    const data = this.require(sessionId);
    if (!data.freeTalk) return;
    data.freeTalk = { ...data.freeTalk, ...updates };
  }

  updateSimulationState(
    sessionId: string,
    updates: {
      currentTurn: number;
      checkpointStates: Record<string, boolean>;
      isComplete: boolean;
    },
  ): void {
    const data = this.require(sessionId);
    data.session.currentTurn = updates.currentTurn;
    data.session.checkpointStates = updates.checkpointStates;
    data.session.isComplete = updates.isComplete;
  }

  updateTrainingState(
    sessionId: string,
    updates: {
      currentTurn: number;
      isComplete: boolean;
    },
  ): void {
    const data = this.require(sessionId);
    data.session.currentTurn = updates.currentTurn;
    data.session.isComplete = updates.isComplete;
  }

  markEnded(sessionId: string): void {
    const data = this.require(sessionId);
    data.endedAt = new Date();
  }

  markHintUsed(sessionId: string): void {
    const data = this.require(sessionId);
    data.hintsUsed += 1;
  }

  markThaiMixUsed(sessionId: string): void {
    const data = this.require(sessionId);
    data.thaiMixUsed = true;
  }

  setIntroReport(sessionId: string, report: GptIntroReport): void {
    const data = this.require(sessionId);
    data.introReport = report;
  }

  private require(sessionId: string): SessionData {
    const data = this.sessions.get(sessionId);
    if (!data) {
      throw new Error(sessionId);
    }
    return data;
  }
}
