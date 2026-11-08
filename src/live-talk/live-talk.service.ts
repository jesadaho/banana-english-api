import { effectiveSubscriptionTier } from '../subscriptions/subscription.constants';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { FcmService } from '../notifications/fcm.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  deleteLiveKitRoom,
  dispatchCaptionsAgent,
  fetchLiveKitOccupancy,
  grantLiveKitPublish,
  removeLiveKitParticipant,
  setLiveKitParticipantMuted,
} from './live-talk.livekit';
import { resolveUserTimezone } from '../common/timezone.util';
import {
  LIVE_TALK_COHOST_CAP,
  LIVE_TALK_INVITE_TTL_MS,
  LIVE_TALK_LISTENER_CAP,
  LIVE_TALK_RECONNECT_GRACE_MS,
  LIVE_TALK_SPEAKER_CAP,
  canChangeHostLevel,
  canManageHosts,
  canModerateInRoom,
  hostLevelOf,
  isHostLevel,
  type HostLevel,
  canSpeakAtLevel,
  canSubmitLiveTalkLeaveRating,
  countsAsSpeaker,
  decideJoin,
  decidePromote,
  canCreateLiveTalkRoom,
  isLiveTalkMinLevel,
  isStaleLiveTalkRoom,
  placementBandOf,
  type LiveTalkMinSpeakLevel,
  type LiveTalkRole,
} from './live-talk.rules';
import { liveKitConfigFromEnv, mintLiveKitJwt } from './live-talk.token';

type UserRow = {
  id: string;
  displayName: string | null;
  avatarId: string | null;
  communityAdmin: boolean;
  hostLevel?: string | null;
  placementResult?: unknown;
};

type PersonRow = {
  id: string;
  displayName: string | null;
  avatarId: string | null;
  subscriptionTier?: string;
  subscriptionExpiresAt?: Date | null;
  hostLevel?: string | null;
};

const HOST_LEVEL_ORDER: HostLevel[] = ['none', 'trainee', 'host', 'official'];
function isLevelUp(from: HostLevel, to: HostLevel): boolean {
  return HOST_LEVEL_ORDER.indexOf(to) > HOST_LEVEL_ORDER.indexOf(from);
}

@Injectable()
export class LiveTalkService {
  private readonly logger = new Logger(LiveTalkService.name);
  private lastSweepAt = 0;
  /** `${livekitRoom}:${userId}` → when we last minted a token for them. */
  private readonly recentTokens = new Map<string, number>();
  private sweepInFlight: Promise<number> | null = null;

  /** Topic every Live Talk–enabled app subscribes to. */
  static readonly ROOMS_TOPIC = 'live_talk';
  private lastRoomsPingAt = 0;
  private roomsPingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly fcm?: FcmService,
  ) {}

  /**
   * Silent FCM ping so open apps refresh their room list. Coalesced: at most
   * one ping per 5s; a change inside that window sends one trailing ping.
   */
  private pingRoomsChanged() {
    if (!this.fcm) return;
    const send = () => {
      this.lastRoomsPingAt = Date.now();
      void this.fcm?.sendTopicData(LiveTalkService.ROOMS_TOPIC, {
        type: 'live_talk_rooms_changed',
        at: String(this.lastRoomsPingAt),
      });
    };
    const wait = 5000 - (Date.now() - this.lastRoomsPingAt);
    if (wait <= 0) {
      send();
      return;
    }
    if (this.roomsPingTimer) return;
    this.roomsPingTimer = setTimeout(() => {
      this.roomsPingTimer = null;
      send();
    }, wait);
  }

  /**
   * Silent FCM data so apps in the foreground can show an in-app "room is
   * live" banner. Not coalesced: each new room is its own announcement; the
   * app merges rooms that arrive close together and caps how often it shows.
   */
  private announceRoomOpened(
    roomId: string,
    title: string,
    host: { id: string; displayName?: string | null; avatarId?: string | null },
  ) {
    if (!this.fcm) return;
    void this.fcm.sendTopicData(LiveTalkService.ROOMS_TOPIC, {
      type: 'live_talk_room_opened',
      roomId,
      title,
      hostId: host.id,
      hostName: host.displayName?.trim() || '',
      hostAvatarId: host.avatarId?.trim() || '',
      at: String(Date.now()),
    });
  }

  @Cron('*/2 * * * *')
  async cronSweepStaleRooms() {
    try {
      const ended = await this.sweepStaleRooms();
      if (ended > 0) {
        this.logger.log(`Ended ${ended} stale Live Talk room(s)`);
      }
    } catch (error) {
      this.logger.warn(`Live Talk sweep failed: ${String(error)}`);
    }
  }

  async getRoom(roomId: string, user?: UserRow) {
    const room = await this.requireRoom(roomId);
    const myInvite = user ? await this.pendingInviteFor(user.id, room.id) : null;
    // Whether *I* may step up to speak myself (room level). Host can still
    // invite anyone (see [setSpeaker]).
    const myCanSpeak = user
      ? canSpeakAtLevel(
          placementBandOf(user),
          room.minSpeakLevel as LiveTalkMinSpeakLevel,
        )
      : null;
    return { room: this.toRoomView(room), myInvite, myCanSpeak };
  }

  async listRooms() {
    await this.sweepStaleRoomsIfDue();
    const rooms = await this.prisma.liveTalkRoom.findMany({
      where: { status: 'live' },
      orderBy: { createdAt: 'desc' },
      include: {
        host: { select: { id: true, displayName: true, avatarId: true, subscriptionTier: true, subscriptionExpiresAt: true, hostLevel: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarId: true, subscriptionTier: true, subscriptionExpiresAt: true, hostLevel: true } },
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
      throw new ForbiddenException('host_only');
    }
    const title = (body.title ?? '').trim();
    if (!title) throw new BadRequestException('Title is required');
    const minSpeakLevel = (body.minSpeakLevel ?? 'listen_all').trim();
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
        host: { select: { id: true, displayName: true, avatarId: true, subscriptionTier: true, subscriptionExpiresAt: true, hostLevel: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarId: true, subscriptionTier: true, subscriptionExpiresAt: true, hostLevel: true } },
          },
        },
      },
    });
    this.pingRoomsChanged();
    this.announceRoomOpened(room.id, room.title, user);
    // Captions (CC): host-only STT agent on LiveKit Cloud. Never blocks create.
    void dispatchCaptionsAgent(room.livekitRoomName, user.id).catch(() => false);
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
    const prior = await this.prisma.liveTalkParticipant.findFirst({
      where: { roomId: room.id, userId: user.id },
      orderBy: { joinedAt: 'desc' },
      select: { kickedAt: true, mutedByHost: true },
    });
    if (prior?.kickedAt) throw new ForbiddenException('kicked');
    const speakerCount = room.participants.filter((p) =>
      countsAsSpeaker(p.role),
    ).length;
    const listenerCount = room.participants.filter(
      (p) => p.role === 'listener',
    ).length;
    const existing = room.participants.find((p) => p.userId === user.id);
    const keepCohost = existing?.role === 'cohost' && requested === 'speaker';
    const decision = keepCohost
      ? ({ ok: true, role: 'cohost' } as const)
      : decideJoin({
      requested,
      roomStatus: room.status,
      speakerCount: existing && countsAsSpeaker(existing.role)
        ? speakerCount - 1
        : speakerCount,
      listenerCount:
        existing && existing.role === 'listener'
          ? listenerCount - 1
          : listenerCount,
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
        data: {
          roomId: room.id,
          userId: user.id,
          role: decision.role,
          mutedByHost: prior?.mutedByHost ?? false,
        },
      });
    }
    const fresh = await this.requireLiveRoom(room.id);
    const next = fresh.participants.find((p) => p.userId === user.id);
    return {
      room: this.toRoomView(fresh),
      role: decision.role,
      ...this.tokenFor(
        user,
        room.livekitRoomName,
        this.canPublish(decision.role, next?.mutedByHost ?? prior?.mutedByHost),
      ),
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
      if (existing.role !== 'listener') {
        const listenerCount = room.participants.filter(
          (p) => p.role === 'listener',
        ).length;
        if (listenerCount >= LIVE_TALK_LISTENER_CAP) {
          throw new ForbiddenException('listener_full');
        }
      }
      await this.prisma.liveTalkParticipant.update({
        where: { id: existing.id },
        data: { role: 'listener', cohostSince: null },
      });
    } else if (countsAsSpeaker(existing.role)) {
      // Already on stage (co-host, or invited up by the host past the level
      // rule): a "speak" request only refreshes the publishing token.
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
    // The app reconnects with this token: ignore the old connection's leave.
    this.noteTokenMinted(room.livekitRoomName, user.id);
    return {
      room: this.toRoomView(fresh),
      role: nextRole,
      ...this.tokenFor(
        user,
        room.livekitRoomName,
        this.canPublish(nextRole, next?.mutedByHost),
      ),
    };
  }

  async kickParticipant(user: UserRow, roomId: string, targetUserId: string) {
    const room = await this.requireLiveRoom(roomId);
    const target = this.requireModerationTarget(user, room, targetUserId);
    const now = new Date();
    await this.prisma.liveTalkParticipant.updateMany({
      where: { roomId: room.id, userId: target.userId, leftAt: null },
      data: { leftAt: now, kickedAt: now },
    });
    await removeLiveKitParticipant(room.livekitRoomName, target.userId);
    this.pingRoomsChanged();
    const fresh = await this.requireLiveRoom(room.id);
    return { ok: true as const, room: this.toRoomView(fresh) };
  }

  async muteParticipant(
    user: UserRow,
    roomId: string,
    targetUserId: string,
    muted: boolean,
  ) {
    const room = await this.requireLiveRoom(roomId);
    const target = this.requireModerationTarget(user, room, targetUserId, {
      allowCohost: true,
    });
    await this.prisma.liveTalkParticipant.updateMany({
      where: { roomId: room.id, userId: target.userId, leftAt: null },
      data: { mutedByHost: muted },
    });
    if (countsAsSpeaker(target.role)) {
      await setLiveKitParticipantMuted(
        room.livekitRoomName,
        target.userId,
        muted,
      );
    }
    const fresh = await this.requireLiveRoom(room.id);
    return { ok: true as const, room: this.toRoomView(fresh) };
  }

  /** Room host names (or removes) a co-host among people already in the room. */
  async setCohost(
    user: UserRow,
    roomId: string,
    targetUserId: string,
    on: boolean,
  ) {
    const room = await this.requireLiveRoom(roomId);
    if (room.hostUserId !== user.id) throw new ForbiddenException('host_only');
    if (targetUserId === user.id) {
      throw new ForbiddenException('cannot_moderate_self');
    }
    const target = room.participants.find((p) => p.userId === targetUserId);
    if (!target) throw new ForbiddenException('not_in_room');
    if (on) {
      if (target.role !== 'cohost') await this.makeCohost(room, target);
    } else if (target.role === 'cohost') {
      await this.prisma.liveTalkParticipant.update({
        where: { id: target.id },
        data: { role: 'speaker', cohostSince: null },
      });
    }
    this.pingRoomsChanged();
    const fresh = await this.requireLiveRoom(room.id);
    return { ok: true as const, room: this.toRoomView(fresh) };
  }

  /**
   * Host / co-host calls someone up to speak (level rule skipped: it is the
   * teacher's call; seat cap still applies) or sends them back to listen.
   * The mic is granted on their live connection; it stays off until they
   * tap it.
   */
  async setSpeaker(
    user: UserRow,
    roomId: string,
    targetUserId: string,
    on: boolean,
  ) {
    const room = await this.requireLiveRoom(roomId);
    const actorRole = room.participants.find((p) => p.userId === user.id)?.role;
    const isRoomHost = room.hostUserId === user.id;
    if (!isRoomHost && !canModerateInRoom(actorRole)) {
      throw new ForbiddenException('host_only');
    }
    if (targetUserId === user.id || targetUserId === room.hostUserId) {
      throw new ForbiddenException('cannot_moderate_host');
    }
    const target = room.participants.find((p) => p.userId === targetUserId);
    if (!target) throw new ForbiddenException('not_in_room');

    if (on) {
      if (!countsAsSpeaker(target.role)) {
        await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "LiveTalkRoom" WHERE "id" = ${room.id} FOR UPDATE`;
          const speakers = await tx.liveTalkParticipant.count({
            where: {
              roomId: room.id,
              leftAt: null,
              role: { in: ['host', 'cohost', 'speaker'] },
            },
          });
          if (speakers >= LIVE_TALK_SPEAKER_CAP) {
            throw new ForbiddenException('speaker_full');
          }
          await tx.liveTalkParticipant.update({
            where: { id: target.id },
            data: { role: 'speaker' },
          });
        });
        await grantLiveKitPublish(room.livekitRoomName, target.userId);
      }
    } else if (countsAsSpeaker(target.role)) {
      if (target.role === 'cohost' && !isRoomHost) {
        throw new ForbiddenException('cannot_moderate_cohost');
      }
      await this.prisma.liveTalkParticipant.update({
        where: { id: target.id },
        data: { role: 'listener', cohostSince: null },
      });
      // Revokes publish too (UpdateParticipant can_publish=false).
      await setLiveKitParticipantMuted(room.livekitRoomName, target.userId, true);
    }
    this.pingRoomsChanged();
    const fresh = await this.requireLiveRoom(room.id);
    return { ok: true as const, room: this.toRoomView(fresh) };
  }

  /**
   * Official Host invites someone in the room to become a Host Trainee.
   * Nothing changes until they accept the rules (see [respondInvite]).
   */
  async scoutTrainee(user: UserRow, roomId: string, targetUserId: string) {
    if (!canManageHosts(user)) throw new ForbiddenException('official_only');
    const room = await this.requireLiveRoom(roomId);
    if (targetUserId === user.id) {
      throw new ForbiddenException('cannot_moderate_self');
    }
    const target = room.participants.find((p) => p.userId === targetUserId);
    if (!target) throw new ForbiddenException('not_in_room');
    if (hostLevelOf(target.user) !== 'none') {
      throw new BadRequestException('already_host_level');
    }
    const invite = await this.createInvite(
      'trainee',
      room.id,
      user.id,
      targetUserId,
    );
    return { ok: true as const, invite };
  }

  /** Accept or decline an in-room invite (trainee scout or co-host). */
  async respondInvite(user: UserRow, inviteId: string, accept: boolean) {
    const now = new Date();
    const invite = await this.prisma.liveTalkInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.inviteeId !== user.id) {
      throw new NotFoundException('invite not found');
    }
    if (invite.status !== 'pending' || invite.expiresAt <= now) {
      throw new BadRequestException('invite_expired');
    }
    if (!accept) {
      await this.prisma.liveTalkInvite.update({
        where: { id: invite.id },
        data: { status: 'declined', respondedAt: now },
      });
      return { ok: true as const, accepted: false };
    }
    const room = await this.requireLiveRoom(invite.roomId);
    let hostLevel: HostLevel = hostLevelOf(user);
    await this.prisma.$transaction(async (tx) => {
      await tx.liveTalkInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', respondedAt: now },
      });
      if (invite.kind !== 'trainee') return;
      const fresh = await tx.user.findUnique({
        where: { id: user.id },
        select: { hostLevel: true, hostRulesAcceptedAt: true },
      });
      const from = hostLevelOf(fresh ?? {});
      if (from !== 'none') {
        hostLevel = from;
        return;
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          hostLevel: 'trainee',
          hostLevelAt: now,
          hostRulesAcceptedAt: fresh?.hostRulesAcceptedAt ?? now,
        },
      });
      await tx.hostLevelEvent.create({
        data: {
          userId: user.id,
          fromLevel: from,
          toLevel: 'trainee',
          actorUserId: invite.inviterId,
          reason: 'scout_accepted',
          roomId: room.id,
        },
      });
      hostLevel = 'trainee';
    });

    // Accepting makes them co-host here and now, when the room host invited.
    const me = room.participants.find((p) => p.userId === user.id);
    if (me && me.role !== 'cohost' && room.hostUserId === invite.inviterId) {
      try {
        await this.makeCohost(room, me);
      } catch (error) {
        // Full room: keep the new level, they co-host next time.
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    this.pingRoomsChanged();
    const fresh = await this.requireLiveRoom(room.id);
    const next = fresh.participants.find((p) => p.userId === user.id);
    const role = (next?.role ?? 'listener') as LiveTalkRole;
    this.noteTokenMinted(room.livekitRoomName, user.id);
    return {
      ok: true as const,
      accepted: true,
      hostLevel,
      room: this.toRoomView(fresh),
      role,
      ...this.tokenFor(
        user,
        room.livekitRoomName,
        this.canPublish(role, next?.mutedByHost),
      ),
    };
  }

  /** Official Host (in app) or admin (web) changes someone's host level. */
  async setHostLevel(
    actor: UserRow | 'admin',
    targetUserId: string,
    to: string,
    note?: string,
  ) {
    if (!isHostLevel(to)) throw new BadRequestException('unknown host level');
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, hostLevel: true },
    });
    if (!target) throw new NotFoundException('user not found');
    const from = hostLevelOf(target);
    if (from === to) return { ok: true as const, userId: target.id, hostLevel: to };
    if (
      actor !== 'admin' &&
      !canChangeHostLevel({ actor, from, to })
    ) {
      throw new ForbiddenException('cannot_change_level');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.id },
        data: { hostLevel: to, hostLevelAt: now },
      }),
      this.prisma.hostLevelEvent.create({
        data: {
          userId: target.id,
          fromLevel: from,
          toLevel: to,
          actorUserId: actor === 'admin' ? null : actor.id,
          reason: isLevelUp(from, to) ? 'manual' : 'demoted',
          note: note?.trim().slice(0, 300) || null,
        },
      }),
    ]);
    return { ok: true as const, userId: target.id, hostLevel: to };
  }

  /** Level + history for the Growth page (Phase 3 adds stats). */
  async myHostStatus(user: UserRow) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { hostLevel: true, hostLevelAt: true, hostRulesAcceptedAt: true },
    });
    return {
      hostLevel: hostLevelOf(row ?? {}),
      hostLevelAt: row?.hostLevelAt?.toISOString() ?? null,
      rulesAcceptedAt: row?.hostRulesAcceptedAt?.toISOString() ?? null,
    };
  }

  /**
   * Room-level lock (SELECT … FOR UPDATE) so two "make co-host" taps can't
   * both see 1 co-host and end at 3. Same speaker-level rule as joining.
   */
  private async makeCohost(
    room: { id: string; livekitRoomName: string; minSpeakLevel: string },
    target: { id: string; userId: string; role: string },
  ) {
    if (!countsAsSpeaker(target.role)) {
      const user = await this.prisma.user.findUnique({
        where: { id: target.userId },
        select: { placementResult: true },
      });
      const band = placementBandOf({ placementResult: user?.placementResult });
      if (
        !canSpeakAtLevel(band, room.minSpeakLevel as LiveTalkMinSpeakLevel)
      ) {
        throw new ForbiddenException('level_too_low');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "LiveTalkRoom" WHERE "id" = ${room.id} FOR UPDATE`;
      const current = await tx.liveTalkParticipant.findUnique({
        where: { id: target.id },
        select: { role: true, leftAt: true },
      });
      if (!current || current.leftAt) throw new ForbiddenException('not_in_room');
      if (current.role === 'cohost') return;
      const cohosts = await tx.liveTalkParticipant.count({
        where: { roomId: room.id, leftAt: null, role: 'cohost' },
      });
      if (cohosts >= LIVE_TALK_COHOST_CAP) {
        throw new ForbiddenException('cohost_full');
      }
      if (!countsAsSpeaker(current.role)) {
        const speakers = await tx.liveTalkParticipant.count({
          where: {
            roomId: room.id,
            leftAt: null,
            role: { in: ['host', 'cohost', 'speaker'] },
          },
        });
        if (speakers >= LIVE_TALK_SPEAKER_CAP) {
          throw new ForbiddenException('speaker_full');
        }
      }
      await tx.liveTalkParticipant.update({
        where: { id: target.id },
        data: { role: 'cohost', cohostSince: new Date(), mutedByHost: false },
      });
    });
    // Grant the mic on the live connection: no reconnect, so no
    // participant_left webhook. The app only reconnects if this fails.
    await grantLiveKitPublish(room.livekitRoomName, target.userId);
  }

  private async createInvite(
    kind: 'trainee' | 'cohost',
    roomId: string,
    inviterId: string,
    inviteeId: string,
  ) {
    const now = new Date();
    await this.prisma.liveTalkInvite.updateMany({
      where: { roomId, inviteeId, kind, status: 'pending' },
      data: { status: 'expired', respondedAt: now },
    });
    const invite = await this.prisma.liveTalkInvite.create({
      data: {
        kind,
        roomId,
        inviterId,
        inviteeId,
        expiresAt: new Date(now.getTime() + LIVE_TALK_INVITE_TTL_MS),
      },
      include: { inviter: { select: { id: true, displayName: true, avatarId: true } } },
    });
    return this.inviteView(invite);
  }

  private async pendingInviteFor(userId: string, roomId: string) {
    const invite = await this.prisma.liveTalkInvite.findFirst({
      where: {
        inviteeId: userId,
        roomId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: { inviter: { select: { id: true, displayName: true, avatarId: true } } },
    });
    return invite ? this.inviteView(invite) : null;
  }

  private inviteView(invite: {
    id: string;
    kind: string;
    roomId: string;
    expiresAt: Date;
    inviter: { id: string; displayName: string | null; avatarId: string | null };
  }) {
    return {
      id: invite.id,
      kind: invite.kind,
      roomId: invite.roomId,
      expiresAt: invite.expiresAt.toISOString(),
      inviter: {
        userId: invite.inviter.id,
        displayName: invite.inviter.displayName?.trim() || 'เพื่อน',
        avatarId: invite.inviter.avatarId,
      },
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
    const timezone = resolveUserTimezone(dbUser?.timezone);
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

  /** Admin dashboard: host roster, live rooms, booked sessions, recent ratings. */
  async adminOverview(now = new Date()) {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const [
      hosts,
      liveRooms,
      upcomingSessions,
      recentRatings,
      ratingUp7d,
      ratingDown7d,
      roomsEnded7d,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { hostLevel: { not: 'none' } },
        orderBy: [{ hostLevel: 'desc' }, { hostLevelAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarId: true,
          hostLevel: true,
          hostLevelAt: true,
          hostRulesAcceptedAt: true,
          communityAdmin: true,
        },
      }),
      this.prisma.liveTalkRoom.findMany({
        where: { status: 'live' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          host: {
            select: {
              id: true,
              displayName: true,
              hostLevel: true,
            },
          },
          participants: {
            where: { leftAt: null },
            select: { role: true },
          },
        },
      }),
      this.prisma.liveTalkSession.findMany({
        where: {
          status: 'scheduled',
          startsAt: {
            gte: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            lt: horizon,
          },
        },
        orderBy: { startsAt: 'asc' },
        take: 100,
        include: {
          host: {
            select: {
              id: true,
              displayName: true,
              hostLevel: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.liveTalkRating.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          room: { select: { id: true, title: true } },
          user: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.liveTalkRating.count({
        where: { rating: 'up', createdAt: { gte: weekAgo } },
      }),
      this.prisma.liveTalkRating.count({
        where: { rating: 'down', createdAt: { gte: weekAgo } },
      }),
      this.prisma.liveTalkRoom.count({
        where: { status: 'ended', endedAt: { gte: weekAgo } },
      }),
    ]);

    const byLevel = { none: 0, trainee: 0, host: 0, official: 0 };
    for (const h of hosts) {
      const level = hostLevelOf(h);
      byLevel[level] += 1;
    }

    return {
      generatedAt: now.toISOString(),
      byLevel,
      kpis: {
        hosts: hosts.length,
        official: byLevel.official,
        host: byLevel.host,
        trainee: byLevel.trainee,
        liveRooms: liveRooms.length,
        upcomingSessions: upcomingSessions.length,
        roomsEnded7d,
        ratingUp7d,
        ratingDown7d,
      },
      hosts: hosts.map((h) => ({
        userId: h.id,
        displayName: h.displayName?.trim() || 'เพื่อน',
        email: h.email,
        avatarId: h.avatarId,
        hostLevel: hostLevelOf(h),
        hostLevelAt: h.hostLevelAt?.toISOString() ?? null,
        rulesAcceptedAt: h.hostRulesAcceptedAt?.toISOString() ?? null,
        communityAdmin: h.communityAdmin === true,
      })),
      liveRooms: liveRooms.map((room) => {
        const speakers = room.participants.filter((p) =>
          countsAsSpeaker(p.role),
        ).length;
        const listeners = room.participants.filter(
          (p) => p.role === 'listener',
        ).length;
        return {
          id: room.id,
          title: room.title,
          minSpeakLevel: room.minSpeakLevel,
          createdAt: room.createdAt.toISOString(),
          host: {
            userId: room.host.id,
            displayName: room.host.displayName?.trim() || 'เพื่อน',
            hostLevel: hostLevelOf(room.host),
          },
          speakerCount: speakers,
          listenerCount: listeners,
        };
      }),
      upcomingSessions: upcomingSessions.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        startsAt: row.startsAt.toISOString(),
        durationMin: row.durationMin,
        host: {
          userId: row.host.id,
          displayName: row.host.displayName?.trim() || 'เพื่อน',
          email: row.host.email,
          hostLevel: hostLevelOf(row.host),
        },
      })),
      recentRatings: recentRatings.map((row) => ({
        id: row.id,
        rating: row.rating,
        feedback: row.feedback,
        listenedSeconds: row.listenedSeconds,
        createdAt: row.createdAt.toISOString(),
        room: row.room,
        user: {
          userId: row.user.id,
          displayName: row.user.displayName?.trim() || 'เพื่อน',
        },
      })),
    };
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
    await this.markRoomsEnded([room.id]);
    return { ok: true };
  }

  async leaveByLivekitIdentity(livekitRoomName: string, identity: string) {
    const userId = identity.trim();
    if (!userId) return { ok: true, left: false };
    // A role change swaps the token: the app disconnects and reconnects at
    // once. That old connection's participant_left is not a real leave.
    if (this.isReconnecting(livekitRoomName, userId)) {
      return { ok: true, left: false, reconnecting: true };
    }
    const room = await this.prisma.liveTalkRoom.findUnique({
      where: { livekitRoomName },
    });
    if (!room || room.status !== 'live') return { ok: true, left: false };
    await this.prisma.liveTalkParticipant.updateMany({
      where: { roomId: room.id, userId, leftAt: null },
      data: { leftAt: new Date() },
    });
    if (room.hostUserId === userId) {
      await this.markRoomsEnded([room.id]);
    }
    return { ok: true, left: true };
  }

  async endByLivekitName(livekitRoomName: string) {
    const room = await this.prisma.liveTalkRoom.findUnique({
      where: { livekitRoomName },
    });
    if (!room || room.status !== 'live') return { ok: true, ended: false };
    await this.markRoomsEnded([room.id]);
    return { ok: true, ended: true };
  }

  async sweepStaleRooms(
    now = new Date(),
    occupancy?: Map<string, number> | null,
  ): Promise<number> {
    const live = await this.prisma.liveTalkRoom.findMany({
      where: { status: 'live' },
      select: {
        id: true,
        livekitRoomName: true,
        createdAt: true,
        participants: {
          where: { leftAt: null },
          select: { id: true },
        },
      },
    });
    if (live.length === 0) return 0;
    const occupancyMap =
      occupancy === undefined ? await fetchLiveKitOccupancy() : occupancy;
    const staleIds = live
      .filter((room) =>
        isStaleLiveTalkRoom(
          {
            id: room.id,
            livekitRoomName: room.livekitRoomName,
            createdAt: room.createdAt,
            activeCount: room.participants.length,
          },
          now,
          occupancyMap,
        ),
      )
      .map((room) => room.id);
    if (staleIds.length === 0) return 0;
    await this.markRoomsEnded(staleIds, now);
    return staleIds.length;
  }

  private async sweepStaleRoomsIfDue() {
    const now = Date.now();
    if (now - this.lastSweepAt < 30_000) return;
    if (this.sweepInFlight) {
      await this.sweepInFlight;
      return;
    }
    this.lastSweepAt = now;
    this.sweepInFlight = this.sweepStaleRooms().finally(() => {
      this.sweepInFlight = null;
    });
    try {
      await this.sweepInFlight;
    } catch (error) {
      this.logger.warn(`Live Talk sweep failed: ${String(error)}`);
    }
  }

  private async markRoomsEnded(ids: string[], endedAt = new Date()) {
    if (ids.length === 0) return;
    const rooms = await this.prisma.liveTalkRoom.findMany({
      where: { id: { in: ids } },
      select: { livekitRoomName: true },
    });
    await this.prisma.liveTalkRoom.updateMany({
      where: { id: { in: ids }, status: 'live' },
      data: { status: 'ended', endedAt },
    });
    await this.prisma.liveTalkParticipant.updateMany({
      where: { roomId: { in: ids }, leftAt: null },
      data: { leftAt: endedAt },
    });
    await Promise.all(
      rooms.map((room) => deleteLiveKitRoom(room.livekitRoomName)),
    );
    this.pingRoomsChanged();
  }

  private async requireRoom(roomId: string) {
    const room = await this.prisma.liveTalkRoom.findUnique({
      where: { id: roomId },
      include: {
        host: { select: { id: true, displayName: true, avatarId: true, subscriptionTier: true, subscriptionExpiresAt: true, hostLevel: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarId: true, subscriptionTier: true, subscriptionExpiresAt: true, hostLevel: true } },
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

  private requireModerationTarget(
    host: UserRow,
    room: {
      hostUserId: string;
      participants: Array<{ userId: string; role: string }>;
    },
    targetUserId: string,
    opts?: { allowCohost?: boolean },
  ) {
    const actorRole = room.participants.find((p) => p.userId === host.id)?.role;
    const isRoomHost = room.hostUserId === host.id;
    if (!isRoomHost && !(opts?.allowCohost && canModerateInRoom(actorRole))) {
      throw new ForbiddenException('host_only');
    }
    if (!isRoomHost) {
      const targetRole = room.participants.find(
        (p) => p.userId === targetUserId,
      )?.role;
      // Co-hosts moderate speakers and listeners, not each other.
      if (targetRole === 'cohost') {
        throw new ForbiddenException('cannot_moderate_cohost');
      }
    }
    if (targetUserId === host.id) {
      throw new ForbiddenException('cannot_moderate_self');
    }
    if (targetUserId === room.hostUserId) {
      throw new ForbiddenException('cannot_moderate_host');
    }
    const target = room.participants.find((p) => p.userId === targetUserId);
    if (!target) throw new ForbiddenException('not_in_room');
    return target;
  }

  private canPublish(role: string, mutedByHost?: boolean) {
    return countsAsSpeaker(role) && !mutedByHost;
  }

  private isReconnecting(livekitRoomName: string, userId: string, now = Date.now()) {
    const at = this.recentTokens.get(`${livekitRoomName}:${userId}`);
    return at !== undefined && now - at < LIVE_TALK_RECONNECT_GRACE_MS;
  }

  private noteTokenMinted(livekitRoomName: string, userId: string) {
    const now = Date.now();
    this.recentTokens.set(`${livekitRoomName}:${userId}`, now);
    if (this.recentTokens.size > 500) {
      for (const [key, at] of this.recentTokens) {
        if (now - at >= LIVE_TALK_RECONNECT_GRACE_MS) this.recentTokens.delete(key);
      }
    }
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
    host: PersonRow;
    participants: Array<{
      role: string;
      mutedByHost?: boolean;
      user: PersonRow;
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
      listenerCap: LIVE_TALK_LISTENER_CAP,
      listenerCount: listeners.length,
      host: this.person(room.host, true, false, 'host'),
      speakers: speakers.slice(0, LIVE_TALK_SPEAKER_CAP).map((p) =>
        this.person(p.user, p.role === 'host', p.mutedByHost, p.role),
      ),
      listeners: listeners.slice(0, LIVE_TALK_LISTENER_CAP).map((p) =>
        this.person(p.user, false, p.mutedByHost, p.role),
      ),
      cohostCount: room.participants.filter((p) => p.role === 'cohost').length,
      createdAt: room.createdAt.toISOString(),
    };
  }

  private person(
    user: PersonRow,
    isHost: boolean,
    mutedByHost = false,
    role = 'listener',
  ) {
    return {
      role,
      hostLevel: hostLevelOf(user),
      userId: user.id,
      displayName: user.displayName?.trim() || 'เพื่อน',
      avatarId: user.avatarId,
      subscriptionTier: effectiveSubscriptionTier({subscriptionTier: user.subscriptionTier ?? 'FREE', subscriptionExpiresAt: user.subscriptionExpiresAt ?? null}),
      isHost,
      mutedByHost: mutedByHost === true,
    };
  }
}
