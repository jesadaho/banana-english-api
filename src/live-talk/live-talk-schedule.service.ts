import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

@Injectable()
export class LiveTalkScheduleService {
  constructor(private readonly prisma: PrismaService) {}

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
  async upcoming(limit = 3, now = new Date()) {
    const rows = await this.prisma.liveTalkSession.findMany({
      where: {
        status: 'scheduled',
        startsAt: { gte: new Date(now.getTime() - LIVE_TALK_SESSION_LONGEST_MS) },
      },
      orderBy: { startsAt: 'asc' },
      take: limit + 10,
      include: { host: { select: hostSelect } },
    });
    return {
      sessions: rows
        .filter((row) => sessionEndsAt(row) > now)
        .slice(0, Math.max(1, Math.min(limit, 10)))
        .map((row) => this.view(row, null)),
    };
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
