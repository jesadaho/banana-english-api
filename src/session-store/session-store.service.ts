import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GptIntroReport, SessionType } from '../common/api.types';
import type { SimulationConfig } from '../simulations/simulations.data';
import { initCheckpointStates } from '../simulations/simulations.data';
import type { LessonConfig } from '../lessons/lessons.data';

export interface ChatTurn {
  speaker: 'user' | 'ai';
  textEn: string;
  textTh?: string | null;
  audioUrl?: string | null;
  /** Raw learner utterance before Thai Mix (user turns only). */
  originalTextEn?: string | null;
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

interface SessionData {
  session: ConversationSession;
  turns: ChatTurn[];
  turnCounter: number;
  endedAt: Date | null;
  introReport: GptIntroReport | null;
  simulationConfig?: SimulationConfig;
  lessonConfig?: LessonConfig;
  /** First name for 1:1 tutor address (training sessions). */
  learnerFirstName?: string;
}

@Injectable()
export class SessionStoreService {
  private readonly sessions = new Map<string, SessionData>();

  constructor(private readonly config: ConfigService) {}

  create(topicId: string): SessionData {
    const sessionId = `session_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const sessionType: SessionType = topicId === 'intro' ? 'intro' : 'legacy';
    const session: ConversationSession = {
      id: sessionId,
      sessionType,
      topicId,
      startedAt: new Date().toISOString(),
      durationLimitSeconds: this.config.get<number>(
        'SESSION_DURATION_SECONDS',
        300,
      ),
    };
    const data: SessionData = {
      session,
      turns: [],
      turnCounter: 0,
      endedAt: null,
      introReport: null,
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
    };
    this.sessions.set(sessionId, data);
    return data;
  }

  createTraining(
    config: LessonConfig,
    learnerFirstName = 'เพื่อน',
  ): SessionData {
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
      learnerFirstName,
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
