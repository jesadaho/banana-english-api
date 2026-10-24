import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionData } from './session-store.service';

/** Where in-progress sessions survive a restart. Swap for Redis later. */
export interface SessionPersistence {
  load(sessionId: string): Promise<SessionData | null>;
  save(sessionId: string, data: SessionData, expiresAt: Date): Promise<void>;
  deleteExpired(now: Date): Promise<number>;
}

export const SESSION_PERSISTENCE = Symbol('SESSION_PERSISTENCE');

/** JSON round-trip: the only non-JSON field in SessionData is `endedAt`. */
export function reviveSessionData(raw: unknown): SessionData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as SessionData & { endedAt: Date | string | null };
  if (!data.session?.id || !Array.isArray(data.turns)) return null;
  return {
    ...data,
    endedAt: data.endedAt ? new Date(data.endedAt) : null,
  };
}

@Injectable()
export class PrismaSessionPersistence implements SessionPersistence {
  private readonly logger = new Logger(PrismaSessionPersistence.name);

  constructor(private readonly prisma: PrismaService) {}

  async load(sessionId: string): Promise<SessionData | null> {
    const row = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
    });
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    return reviveSessionData(row.data);
  }

  async save(sessionId: string, data: SessionData, expiresAt: Date): Promise<void> {
    const json = JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
    await this.prisma.liveSession.upsert({
      where: { id: sessionId },
      create: { id: sessionId, data: json, expiresAt },
      update: { data: json, expiresAt },
    });
  }

  async deleteExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.liveSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (count > 0) this.logger.log(`Deleted ${count} expired live sessions`);
    return count;
  }
}
