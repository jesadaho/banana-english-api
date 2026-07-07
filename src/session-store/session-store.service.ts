import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GptIntroReport } from '../common/api.types';

export interface ChatTurn {
  speaker: 'user' | 'ai';
  textEn: string;
  textTh?: string | null;
  audioUrl?: string | null;
}

export interface ConversationSession {
  id: string;
  topicId: string;
  startedAt: string;
  durationLimitSeconds: number;
}

interface SessionData {
  session: ConversationSession;
  turns: ChatTurn[];
  turnCounter: number;
  endedAt: Date | null;
  introReport: GptIntroReport | null;
}

@Injectable()
export class SessionStoreService {
  private readonly sessions = new Map<string, SessionData>();

  constructor(private readonly config: ConfigService) {}

  create(topicId: string): SessionData {
    const sessionId = `session_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const session: ConversationSession = {
      id: sessionId,
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

  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  addTurn(sessionId: string, turn: ChatTurn): number {
    const data = this.require(sessionId);
    data.turns.push(turn);
    data.turnCounter += 1;
    return data.turnCounter;
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
