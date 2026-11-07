import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  LIVE_TALK_SPEAKER_CAP,
  canSubmitLiveTalkLeaveRating,
  countsAsSpeaker,
  decideJoin,
  decidePromote,
  canCreateLiveTalkRoom,
  isLiveTalkMinLevel,
  placementBandOf,
  resolveLiveTalkTimezone,
  type LiveTalkMinSpeakLevel,
  type LiveTalkRole,
} from './live-talk.rules';
import { deleteLiveKitRoom } from './live-talk.livekit';
import { liveKitConfigFromEnv, mintLiveKitJwt } from './live-talk.token';

type UserRow = {
  id: string;
  displayName: string | null;
  avatarId: string | null;
  communityAdmin: boolean;
  placementResult?: unknown;
};

@Injectable()
export class LiveTalkService {
  constructor(private readonly prisma: PrismaService) {}

  async listRooms() {
    const rooms = await this.prisma.liveTalkRoom.findMany({
      where: { status: 'live' },
      orderBy: { createdAt: 'desc' },
      include: {
        host: { select: { id: true, displayName: true, avatarId: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarId: true } },
          },
        },
      },
    });
    return { rooms: rooms.map((room) => this.toRoomView(room)) };
  }

  async createRoom(
    user: UserRow,
    body: { title?: string; description?: string; minSpeakLevel?: string },
  ) {
    if (!canCreateLiveTalkRoom(user)) {
      throw new ForbiddenException('Community admin only');
    }
    const title = (body.title ?? '').trim();
    if (!title) throw new BadRequestException('Title is required');
    const minSpeakLevel = (body.minSpeakLevel ?? 'a1').trim();
    if (!isLiveTalkMinLevel(minSpeakLevel)) {
      throw new BadRequestException('minSpeakLevel must be a1, a2, or listen_all');
    }
    const room = await this.prisma.liveTalkRoom.create({
      data: {
        title: title.slice(0, 50),
        description: (body.description ?? '').trim().slice(0, 160),
        minSpeakLevel,
        hostUserId: user.id,
        livekitRoomName: `lt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        participants: {
          create: { userId: user.id, role: 'host' },
        },
      },
      include: {
        host: { select: { id: true, displayName: true, avatarId: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarId: true } },
          },
        },
      },
    });
    return {
      room: this.toRoomView(room),
      role: 'host' as const,
      ...this.tokenFor(user, room.livekitRoomName, true),
    };
  }

  async joinRoom(
    user: UserRow,
    roomId: string,
    requested: 'speaker' | 'listener' = 'listener',
  ) {
    const room = await this.requireLiveRoom(roomId);
    const speakerCount = room.participants.filter((p) =>
      countsAsSpeaker(p.role),
    ).length;
    const existing = room.participants.find((p) => p.userId === user.id);
    const decision = decideJoin({
      requested,
      roomStatus: room.status,
      speakerCount: existing && countsAsSpeaker(existing.role)
        ? speakerCount - 1
        : speakerCount,
      band: placementBandOf(user),
      minSpeakLevel: room.minSpeakLevel as LiveTalkMinSpeakLevel,
      isHost: room.hostUserId === user.id,
    });
    if (!decision.ok) {
      throw new ForbiddenException(decision.reason);
    }
    if (existing) {
      if (existing.role !== decision.role) {
        await this.prisma.liveTalkParticipant.update({
          where: { id: existing.id },
          data: { role: decision.role, leftAt: null },
        });
      }
    } else {
      await this.prisma.liveTalkParticipant.create({
        data: { roomId: room.id, userId: user.id, role: decision.role },
      });
    }
    const fresh = await this.requireLiveRoom(room.id);
    return {
      room: this.toRoomView(fresh),
      role: decision.role,
      ...this.tokenFor(user, room.livekitRoomName, countsAsSpeaker(decision.role)),
    };
  }

  async changeRole(
    user: UserRow,
    roomId: string,
    role: 'speaker' | 'listener',
  ) {
    const room = await this.requireLiveRoom(roomId);
    const existing = room.participants.find((p) => p.userId === user.id);
    if (!existing) throw new ForbiddenException('not_in_room');
    if (role === 'listener') {
      if (existing.role === 'host') {
        throw new ForbiddenException('host_stays_speaker');
      }
      await this.prisma.liveTalkParticipant.update({
        where: { id: existing.id },
        data: { role: 'listener' },
      });
    } else {
      const speakerCount = room.participants.filter((p) =>
        countsAsSpeaker(p.role),
      ).length;
      const decision = decidePromote({
        speakerCount: countsAsSpeaker(existing.role)
          ? speakerCount - 1
          : speakerCount,
        band: placementBandOf(user),
        minSpeakLevel: room.minSpeakLevel as LiveTalkMinSpeakLevel,
      });
      if (!decision.ok) throw new ForbiddenException(decision.reason);
      await this.prisma.liveTalkParticipant.update({
        where: { id: existing.id },
        data: { role: room.hostUserId === user.id ? 'host' : 'speaker' },
      });
    }
    const fresh = await this.requireLiveRoom(room.id);
    const next = fresh.participants.find((p) => p.userId === user.id);
    const nextRole = (next?.role ?? role) as LiveTalkRole;
    return {
      room: this.toRoomView(fresh),
      role: nextRole,
      ...this.tokenFor(user, room.livekitRoomName, countsAsSpeaker(nextRole)),
    };
  }

  async submitRating(
    user: UserRow,
    roomId: string,
    body: {
      rating?: string;
      feedback?: string;
      listenedSeconds?: number;
    },
  ) {
    const rating = body.rating === 'up' || body.rating === 'down'
      ? body.rating
      : null;
    if (!rating) throw new BadRequestException('rating must be up or down');

    const room = await this.prisma.liveTalkRoom.findUnique({
      where: { id: roomId },
      select: { id: true },
    });
    if (!room) throw new NotFoundException('live-talk room not found');

    const existing = await this.prisma.liveTalkRating.findUnique({
      where: { userId_roomId: { userId: user.id, roomId: room.id } },
    });
    if (existing) return { ok: true, rating: existing };

    const participants = await this.prisma.liveTalkParticipant.findMany({
      where: { roomId: room.id, userId: user.id },
      select: { joinedAt: true },
      orderBy: { joinedAt: 'asc' },
    });
    if (participants.length === 0) {
      throw new ForbiddenException('not_in_room');
    }

    const now = new Date();
    const joinedAt = participants[0]!.joinedAt;
    const listenedMs = Math.max(0, now.getTime() - joinedAt.getTime());
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { timezone: true },
    });
    const timezone = resolveLiveTalkTimezone(dbUser?.timezone);
    const last = await this.prisma.liveTalkRating.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const gate = canSubmitLiveTalkLeaveRating({
      listenedMs,
      lastRatedAt: last?.createdAt,
      timezone,
      now,
    });
    if (!gate.ok) throw new BadRequestException(gate.reason);

    const feedback =
      rating === 'down' ? body.feedback?.trim() || null : null;
    const listenedSeconds =
      typeof body.listenedSeconds === 'number' && body.listenedSeconds >= 0
        ? Math.round(body.listenedSeconds)
        : Math.round(listenedMs / 1000);

    const row = await this.prisma.liveTalkRating.create({
      data: {
        userId: user.id,
        roomId: room.id,
        rating,
        feedback,
        listenedSeconds,
      },
    });
    return { ok: true, rating: row };
  }

  async listRatings(opts?: { rating?: string; take?: number }) {
    const rating =
      opts?.rating === 'up' || opts?.rating === 'down' ? opts.rating : undefined;
    const take = Math.min(Math.max(opts?.take ?? 50, 1), 200);
    const rows = await this.prisma.liveTalkRating.findMany({
      where: rating ? { rating } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        room: { select: { id: true, title: true, status: true } },
        user: { select: { id: true, displayName: true } },
      },
    });
    return { ratings: rows };
  }

  async leaveRoom(user: UserRow, roomId: string) {
    const room = await this.requireRoom(roomId);
    await this.prisma.liveTalkParticipant.updateMany({
      where: { roomId: room.id, userId: user.id, leftAt: null },
      data: { leftAt: new Date() },
    });
    if (room.hostUserId === user.id && room.status === 'live') {
      await this.endRoom(user, room.id);
    }
    return { ok: true };
  }

  async endRoom(user: UserRow, roomId: string) {
    const room = await this.requireRoom(roomId);
    if (room.hostUserId !== user.id) {
      throw new ForbiddenException('host_only');
    }
    if (room.status === 'live') {
      await this.markRoomEnded(room);
    } else {
      // Already ended in DB — still kick anyone left on LiveKit.
      await deleteLiveKitRoom(room.livekitRoomName);
    }
    return { ok: true };
  }

  /**
   * Host force-quit / network drop: LiveKit fires participant_left while
   * others may still be in the room, so room_finished never arrives.
   * Non-host leaves are ignored here (role changes also disconnect).
   */
  async leaveByLivekitIdentity(livekitRoomName: string, identity: string) {
    const userId = identity.trim();
    if (!userId) return { ok: true, left: false };
    const room = await this.prisma.liveTalkRoom.findUnique({
      where: { livekitRoomName },
    });
    if (!room || room.status !== 'live') return { ok: true, left: false };
    if (room.hostUserId !== userId) {
      return { ok: true, left: false, ignored: true };
    }
    await this.markRoomEnded(room);
    return { ok: true, left: true, ended: true };
  }

  async endByLivekitName(livekitRoomName: string) {
    const room = await this.prisma.liveTalkRoom.findUnique({
      where: { livekitRoomName },
    });
    if (!room || room.status !== 'live') return { ok: true, ended: false };
    await this.markRoomEnded(room);
    return { ok: true, ended: true };
  }

  private async markRoomEnded(room: {
    id: string;
    livekitRoomName: string;
  }) {
    const endedAt = new Date();
    await this.prisma.liveTalkRoom.updateMany({
      where: { id: room.id, status: 'live' },
      data: { status: 'ended', endedAt },
    });
    await this.prisma.liveTalkParticipant.updateMany({
      where: { roomId: room.id, leftAt: null },
      data: { leftAt: endedAt },
    });
    await deleteLiveKitRoom(room.livekitRoomName);
  }

  private async requireRoom(roomId: string) {
    const room = await this.prisma.liveTalkRoom.findUnique({
      where: { id: roomId },
      include: {
        host: { select: { id: true, displayName: true, avatarId: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarId: true } },
          },
        },
      },
    });
    if (!room) throw new NotFoundException('live-talk room not found');
    return room;
  }

  private async requireLiveRoom(roomId: string) {
    const room = await this.requireRoom(roomId);
    if (room.status !== 'live') throw new ForbiddenException('room_ended');
    return room;
  }

  private tokenFor(
    user: UserRow,
    livekitRoomName: string,
    canPublish: boolean,
  ) {
    const cfg = liveKitConfigFromEnv();
    if (!cfg) {
      return { livekitUrl: '', token: '' };
    }
    return {
      livekitUrl: cfg.url,
      token: mintLiveKitJwt(
        {
          identity: user.id,
          displayName: user.displayName?.trim() || 'เพื่อน',
          room: livekitRoomName,
          canPublish,
        },
        cfg.apiKey,
        cfg.apiSecret,
      ),
    };
  }

  private toRoomView(room: {
    id: string;
    title: string;
    description: string;
    minSpeakLevel: string;
    hostUserId: string;
    livekitRoomName: string;
    status: string;
    createdAt: Date;
    host: { id: string; displayName: string | null; avatarId: string | null };
    participants: Array<{
      role: string;
      user: { id: string; displayName: string | null; avatarId: string | null };
    }>;
  }) {
    const speakers = room.participants.filter((p) => countsAsSpeaker(p.role));
    const listeners = room.participants.filter((p) => p.role === 'listener');
    return {
      id: room.id,
      title: room.title,
      description: room.description,
      minSpeakLevel: room.minSpeakLevel,
      status: room.status,
      speakerCap: LIVE_TALK_SPEAKER_CAP,
      speakerCount: speakers.length,
      listenerCount: listeners.length,
      host: this.person(room.host, true),
      speakers: speakers.slice(0, LIVE_TALK_SPEAKER_CAP).map((p) =>
        this.person(p.user, p.role === 'host'),
      ),
      listeners: listeners.slice(0, 8).map((p) => this.person(p.user, false)),
      createdAt: room.createdAt.toISOString(),
    };
  }

  private person(
    user: { id: string; displayName: string | null; avatarId: string | null },
    isHost: boolean,
  ) {
    return {
      userId: user.id,
      displayName: user.displayName?.trim() || 'เพื่อน',
      avatarId: user.avatarId,
      isHost,
    };
  }
}
