import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { FcmService } from '../notifications/fcm.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LIVE_TALK_SESSION_LONGEST_MS,
  canBookLiveTalkSession,
  findSessionClash,
  parseSessionInput,
  sessionEndsAt,
  type SessionInput,
} from './live-talk-schedule.rules';

/** Who is using the host web: an app user (host) and/or an ADMIN_EMAILS admin. */
export type HostWebViewer = {
  user: {
    id: string;
    displayName: string | null;
    avatarId: string | null;
    hostLevel: string;
    communityAdmin: boolean;
  } | null;
  email: string | null;
  isAdmin: boolean;
};

const hostSelect = {
  id: true,
  displayName: true,
  avatarId: true,
  hostLevel: true,
} as const;

type SessionRow = {
  id: string;
  hostUserId: string;
  title: string;
  description: string;
  startsAt: Date;
  durationMin: number;
  status: string;
  host: { id: string; displayName: string | null; avatarId: string | null; hostLevel: string };
};

/** Serialises bookings so two hosts can't grab the same time at once. */
const BOOKING_LOCK_KEY = 4_242_001;

/** Avatars shown on the "ห้องถัดไป" card (the viewer first when interested). */
export const INTEREST_AVATARS = 4;

/** Reminder push this long before a session starts. */
export const INTEREST_REMIND_BEFORE_MS = 10 * 60_000;

export type SessionInterestView = {
  count: number;
  mine: boolean;
  avatars: { userId: string; avatarId: string | null }[];
};

@Injectable()
export class LiveTalkScheduleService {
  private readonly logger = new Logger(LiveTalkScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly fcm?: FcmService,
  ) {}

  canBook(viewer: HostWebViewer): boolean {
    return viewer.user != null && canBookLiveTalkSession(viewer.user);
  }

  me(viewer: HostWebViewer) {
    return {
      email: viewer.email,
      isAdmin: viewer.isAdmin,
      canBook: this.canBook(viewer),
      user: viewer.user
        ? {
            id: viewer.user.id,
            displayName: viewer.user.displayName ?? 'Host',
            avatarId: viewer.user.avatarId,
            hostLevel: viewer.user.hostLevel,
          }
        : null,
    };
  }

  /** Calendar range (everyone's bookings, so hosts can see what's taken). */
  async listRange(viewer: HostWebViewer, from: Date, to: Date) {
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new BadRequestException('from/to invalid');
    }
    if (to.getTime() - from.getTime() > 62 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('range too long');
    }
    const rows = await this.prisma.liveTalkSession.findMany({
      where: {
        status: 'scheduled',
        startsAt: {
          gte: new Date(from.getTime() - LIVE_TALK_SESSION_LONGEST_MS),
          lt: to,
        },
      },
      orderBy: { startsAt: 'asc' },
      include: { host: { select: hostSelect } },
    });
    return {
      sessions: rows
        .filter((row) => sessionEndsAt(row) > from)
        .map((row) => this.view(row, viewer)),
    };
  }

  async create(viewer: HostWebViewer, body: SessionInput) {
    if (!this.canBook(viewer) || !viewer.user) {
      throw new ForbiddenException('official_host_only');
    }
    const input = this.parse(body);
    const hostUserId = viewer.user.id;
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(${BOOKING_LOCK_KEY})`;
      await this.assertFree(tx, input);
      return tx.liveTalkSession.create({
        data: { ...input, hostUserId },
        include: { host: { select: hostSelect } },
      });
    });
    return { session: this.view(row, viewer) };
  }

  async update(viewer: HostWebViewer, id: string, body: SessionInput) {
    const existing = await this.editable(viewer, id);
    const input = this.parse({
      startsAt: body.startsAt ?? existing.startsAt.toISOString(),
      durationMin: body.durationMin ?? existing.durationMin,
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
    });
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(${BOOKING_LOCK_KEY})`;
      await this.assertFree(tx, { ...input, id });
      return tx.liveTalkSession.update({
        where: { id },
        data: input,
        include: { host: { select: hostSelect } },
      });
    });
    return { session: this.view(row, viewer) };
  }

  async cancel(viewer: HostWebViewer, id: string) {
    await this.editable(viewer, id);
    await this.prisma.liveTalkSession.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    return { ok: true };
  }

  /** App: next sessions that haven't ended yet (for "No Live rooms right now"). */
  async upcoming(limit = 3, now = new Date(), viewerId?: string) {
    const rows = await this.prisma.liveTalkSession.findMany({
      where: {
        status: 'scheduled',
        startsAt: { gte: new Date(now.getTime() - LIVE_TALK_SESSION_LONGEST_MS) },
      },
      orderBy: { startsAt: 'asc' },
      take: limit + 10,
      include: { host: { select: hostSelect } },
    });
    const picked = rows
      .filter((row) => sessionEndsAt(row) > now)
      .slice(0, Math.max(1, Math.min(limit, 10)));
    const interest = await this.interestFor(
      picked.map((row) => row.id),
      viewerId,
    );
    return {
      sessions: picked.map((row) => ({
        ...this.view(row, null),
        interest: interest.get(row.id) ?? { count: 0, mine: false, avatars: [] },
      })),
    };
  }

  /** "สนใจ" on / off for an upcoming session. Returns the new card numbers. */
  async setInterest(userId: string, sessionId: string, on: boolean, now = new Date()) {
    const session = await this.prisma.liveTalkSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, startsAt: true, durationMin: true },
    });
    if (!session || session.status !== 'scheduled' || sessionEndsAt(session) <= now) {
      throw new NotFoundException('session_not_found');
    }
    if (on) {
      await this.prisma.liveTalkSessionInterest.upsert({
        where: { sessionId_userId: { sessionId, userId } },
        create: { sessionId, userId },
        update: {},
      });
    } else {
      await this.prisma.liveTalkSessionInterest.deleteMany({
        where: { sessionId, userId },
      });
    }
    const interest = await this.interestFor([sessionId], userId);
    return {
      interest: interest.get(sessionId) ?? { count: 0, mine: false, avatars: [] },
    };
  }

  /** Count, "mine" and up to [INTEREST_AVATARS] avatars per session. */
  private async interestFor(
    sessionIds: string[],
    viewerId?: string,
  ): Promise<Map<string, SessionInterestView>> {
    const out = new Map<string, SessionInterestView>();
    if (sessionIds.length === 0) return out;
    const [counts, rows, mine] = await Promise.all([
      this.prisma.liveTalkSessionInterest.groupBy({
        by: ['sessionId'],
        where: { sessionId: { in: sessionIds } },
        _count: { _all: true },
      }),
      // Newest first; a few extra so the viewer can be moved to the front.
      Promise.all(
        sessionIds.map((sessionId) =>
          this.prisma.liveTalkSessionInterest.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'desc' },
            take: INTEREST_AVATARS + 1,
            select: {
              sessionId: true,
              user: { select: { id: true, avatarId: true } },
            },
          }),
        ),
      ),
      viewerId
        ? this.prisma.liveTalkSessionInterest.findMany({
            where: { sessionId: { in: sessionIds }, userId: viewerId },
            select: { sessionId: true, user: { select: { id: true, avatarId: true } } },
          })
        : Promise.resolve([]),
    ]);
    const mineBy = new Map(mine.map((m) => [m.sessionId, m.user]));
    for (const [i, sessionId] of sessionIds.entries()) {
      const count = counts.find((c) => c.sessionId === sessionId)?._count._all ?? 0;
      const me = mineBy.get(sessionId);
      const others = rows[i]
        .map((r) => r.user)
        .filter((u) => u.id !== me?.id);
      const avatars = [...(me ? [me] : []), ...others]
        .slice(0, INTEREST_AVATARS)
        .map((u) => ({ userId: u.id, avatarId: u.avatarId }));
      out.set(sessionId, { count, mine: !!me, avatars });
    }
    return out;
  }

  /** Push "starting in 10 minutes" to everyone who tapped สนใจ (once each). */
  @Cron('* * * * *')
  async cronRemindInterested(now = new Date()) {
    if (!this.fcm) return;
    try {
      const due = await this.prisma.liveTalkSessionInterest.findMany({
        where: {
          remindedAt: null,
          session: {
            status: 'scheduled',
            startsAt: {
              gt: now,
              lte: new Date(now.getTime() + INTEREST_REMIND_BEFORE_MS),
            },
          },
        },
        take: 500,
        select: {
          sessionId: true,
          userId: true,
          session: { select: { title: true, startsAt: true } },
          user: { select: { fcmTokens: { select: { token: true } } } },
        },
      });
      for (const row of due) {
        // Mark first: a slow send must not make the next minute push twice.
        const claimed = await this.prisma.liveTalkSessionInterest.updateMany({
          where: { sessionId: row.sessionId, userId: row.userId, remindedAt: null },
          data: { remindedAt: now },
        });
        if (claimed.count === 0) continue;
        const tokens = row.user.fcmTokens.map((t) => t.token);
        if (tokens.length === 0) continue;
        const mins = Math.max(
          1,
          Math.round((row.session.startsAt.getTime() - now.getTime()) / 60_000),
        );
        const invalid = await this.fcm.sendToTokens(
          tokens,
          `Live Talk เริ่มในอีก ${mins} นาที 🎙️`,
          row.session.title,
          {
            type: 'live_talk_session_reminder',
            sessionId: row.sessionId,
            route: '/conversation/live-talk',
          },
        );
        if (invalid.length > 0) {
          await this.prisma.userFcmToken.deleteMany({ where: { token: { in: invalid } } });
        }
      }
      if (due.length > 0) this.logger.log(`Live Talk reminders: ${due.length}`);
    } catch (error) {
      this.logger.warn(`Live Talk reminder sweep failed: ${String(error)}`);
    }
  }

  private parse(body: SessionInput) {
    const parsed = parseSessionInput(body ?? {});
    if (!parsed.ok) throw new BadRequestException(parsed.error);
    return parsed.value;
  }

  private async assertFree(
    tx: Pick<Prisma.TransactionClient, 'liveTalkSession'>,
    slot: { id?: string; startsAt: Date; durationMin: number },
  ) {
    const nearby = await tx.liveTalkSession.findMany({
      where: {
        status: 'scheduled',
        startsAt: {
          gte: new Date(slot.startsAt.getTime() - LIVE_TALK_SESSION_LONGEST_MS),
          lt: sessionEndsAt(slot),
        },
      },
      include: { host: { select: { displayName: true } } },
    });
    const clash = findSessionClash(slot, nearby);
    if (clash) {
      throw new ConflictException({
        message: 'slot_taken',
        clash: {
          id: clash.id,
          title: clash.title,
          startsAt: clash.startsAt.toISOString(),
          endsAt: sessionEndsAt(clash).toISOString(),
          hostName: clash.host.displayName ?? 'Host',
        },
      });
    }
  }

  private async editable(viewer: HostWebViewer, id: string) {
    const row = await this.prisma.liveTalkSession.findUnique({ where: { id } });
    if (!row || row.status !== 'scheduled') throw new NotFoundException('session_not_found');
    const mine = viewer.user?.id === row.hostUserId;
    if (!mine && !viewer.isAdmin) throw new ForbiddenException('not_your_session');
    return row;
  }

  private view(row: SessionRow, viewer: HostWebViewer | null) {
    const mine = viewer?.user?.id === row.hostUserId;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      startsAt: row.startsAt.toISOString(),
      endsAt: sessionEndsAt(row).toISOString(),
      durationMin: row.durationMin,
      host: {
        userId: row.host.id,
        displayName: row.host.displayName ?? 'Host',
        avatarId: row.host.avatarId,
        hostLevel: row.host.hostLevel,
      },
      ...(viewer ? { mine, canEdit: mine || viewer.isAdmin } : {}),
    };
  }
}
