import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LiveTalkGameLevel } from './live-talk-games.content';
import {
  changeWord,
  confirmCorrect,
  createGame,
  endGame,
  GameRuleError,
  isGameType,
  publicView,
  secretFor,
  submitGuess,
  syncSpeakers,
  tick,
  type GamePerson,
  type LiveTalkGame,
} from './live-talk-games.rules';
import { sendLiveKitData } from './live-talk.livekit';
import { canModerateInRoom, countsAsSpeaker } from './live-talk.rules';

/** LiveKit data topic the app listens on for game state. */
export const LIVE_TALK_GAME_TOPIC = 'lt-game';
const TICK_MS = 1_000;
const SYNC_EVERY_TICKS = 4;

type Entry = { game: LiveTalkGame; livekitRoomName: string; ticks: number };

/**
 * One game per Live Talk room, held in memory (single API instance). The API
 * owns turns, timers and scores; every change is pushed to the room over the
 * existing LiveKit data channel (topic `lt-game`). Clients that miss a packet
 * or join late call `GET rooms/:id/game`. A deploy/restart drops running
 * games (acceptable for the MVP: a game lasts ~10 min).
 */
@Injectable()
export class LiveTalkGamesService implements OnModuleDestroy {
  private readonly logger = new Logger(LiveTalkGamesService.name);
  private readonly games = new Map<string, Entry>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // -------------------------------------------------------------------------
  // Commands

  async start(
    userId: string,
    roomId: string,
    body: { type?: unknown; level?: unknown; turnSeconds?: unknown },
  ) {
    const room = await this.loadRoom(roomId);
    this.requireModerator(userId, room);
    if (!isGameType(body.type)) throw new BadRequestException('bad_game_type');
    const running = this.games.get(roomId);
    if (running && running.game.phase !== 'over') throw new BadRequestException('game_running');
    const level: LiveTalkGameLevel =
      body.level === 'A2' || body.level === 'a2' || (!body.level && room.minSpeakLevel === 'a2')
        ? 'A2'
        : 'A1';
    const game = this.rule(() =>
      createGame({
        id: randomUUID(),
        roomId,
        type: body.type as 'draw' | 'who',
        level,
        turnSeconds: body.turnSeconds === undefined ? undefined : Number(body.turnSeconds),
        hostUserId: room.hostUserId,
        speakers: speakersOf(room),
        now: Date.now(),
        rng: Math.random,
      }),
    );
    this.games.set(roomId, { game, livekitRoomName: room.livekitRoomName, ticks: 0 });
    this.ensureTimer();
    await this.broadcast(roomId);
    return { game: publicView(game, Date.now()) };
  }

  async stop(userId: string, roomId: string) {
    const room = await this.loadRoom(roomId);
    this.requireModerator(userId, room);
    const entry = this.games.get(roomId);
    if (!entry) return { game: null };
    endGame(entry.game, Date.now());
    await this.broadcast(roomId);
    return { game: publicView(entry.game, Date.now()) };
  }

  view(roomId: string) {
    const entry = this.games.get(roomId);
    return { game: entry ? publicView(entry.game, Date.now()) : null };
  }

  /** The word (drawer) or the card (everyone but the asker). Room members only. */
  async secret(userId: string, roomId: string) {
    const entry = this.games.get(roomId);
    if (!entry) return { secret: null, seq: null };
    const room = await this.loadRoom(roomId);
    const inRoom = room.hostUserId === userId || room.participants.some((p) => p.userId === userId);
    if (!inRoom) throw new ForbiddenException('not_in_room');
    return { secret: secretFor(entry.game, userId), seq: entry.game.seq };
  }

  async changeWord(userId: string, roomId: string) {
    const entry = this.requireGame(roomId);
    this.rule(() => changeWord(entry.game, userId, Date.now(), Math.random));
    await this.broadcast(roomId);
    return { secret: secretFor(entry.game, userId), seq: entry.game.seq };
  }

  /** Draw & Guess: the Game Mic transcript (STT runs on the device). */
  async guess(userId: string, roomId: string, transcript: unknown) {
    const entry = this.requireGame(roomId);
    const text = typeof transcript === 'string' ? transcript.slice(0, 200) : '';
    const outcome = this.rule(() => submitGuess(entry.game, userId, text, Date.now()));
    await this.broadcast(roomId);
    return outcome;
  }

  /** Who Am I?: someone who can see the card confirms the asker got it. */
  async correct(userId: string, roomId: string) {
    const entry = this.requireGame(roomId);
    this.rule(() => confirmCorrect(entry.game, userId, Date.now()));
    await this.broadcast(roomId);
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Timers

  private ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.onTick(), TICK_MS);
    this.timer.unref?.();
  }

  private async onTick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      for (const [roomId, entry] of [...this.games]) {
        entry.ticks += 1;
        let changed = false;
        if (entry.ticks % SYNC_EVERY_TICKS === 0) changed = (await this.syncRoom(roomId, entry)) || changed;
        const result = tick(entry.game, now, Math.random);
        if (result === 'ended') {
          this.games.delete(roomId);
          await this.send(entry.livekitRoomName, null);
          continue;
        }
        if (changed || result === 'changed') await this.broadcast(roomId);
      }
      if (!this.games.size && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    } catch (error) {
      this.logger.warn(`Live Talk game tick failed: ${String(error)}`);
    } finally {
      this.ticking = false;
    }
  }

  /** Stage changes (leave / step down / rejoin / host gone / room ended). */
  private async syncRoom(roomId: string, entry: Entry): Promise<boolean> {
    const room = await this.findRoom(roomId);
    if (!room || room.status !== 'live') {
      this.games.delete(roomId);
      await this.send(entry.livekitRoomName, null);
      return false;
    }
    return syncSpeakers(entry.game, speakersOf(room), Date.now()) === 'changed';
  }

  // -------------------------------------------------------------------------
  // Broadcast

  private async broadcast(roomId: string) {
    const entry = this.games.get(roomId);
    if (!entry) return;
    await this.send(entry.livekitRoomName, publicView(entry.game, Date.now()));
  }

  private async send(livekitRoomName: string, game: ReturnType<typeof publicView> | null) {
    const ok = await sendLiveKitData(
      livekitRoomName,
      JSON.stringify({ v: 1, game }),
      LIVE_TALK_GAME_TOPIC,
    );
    if (!ok) this.logger.warn(`Live Talk game broadcast failed (${livekitRoomName})`);
  }

  // -------------------------------------------------------------------------
  // Helpers

  private rule<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof GameRuleError) throw new BadRequestException(error.code);
      throw error;
    }
  }

  private requireGame(roomId: string): Entry {
    const entry = this.games.get(roomId);
    if (!entry) throw new NotFoundException('no_game');
    return entry;
  }

  private requireModerator(userId: string, room: RoomRow) {
    if (room.hostUserId === userId) return;
    const role = room.participants.find((p) => p.userId === userId)?.role;
    if (!canModerateInRoom(role)) throw new ForbiddenException('host_only');
  }

  private findRoom(roomId: string): Promise<RoomRow | null> {
    return this.prisma.liveTalkRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, displayName: true, avatarId: true } } },
        },
      },
    });
  }

  private async loadRoom(roomId: string): Promise<RoomRow> {
    const room = await this.findRoom(roomId);
    if (!room) throw new NotFoundException('live-talk room not found');
    if (room.status !== 'live') throw new ForbiddenException('room_ended');
    return room;
  }
}


type RoomRow = {
  id: string;
  hostUserId: string;
  livekitRoomName: string;
  minSpeakLevel: string;
  status: string;
  participants: Array<{
    userId: string;
    role: string;
    joinedAt: Date;
    user: { id: string; displayName: string | null; avatarId: string | null };
  }>;
};

/** On-stage people (host, co-hosts, speakers), in join order. */
export function speakersOf(room: Pick<RoomRow, 'participants'>): GamePerson[] {
  return [...room.participants]
    .filter((p) => countsAsSpeaker(p.role))
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((p) => ({
      userId: p.userId,
      name: p.user.displayName?.trim() || 'Player',
      avatarId: p.user.avatarId,
    }));
}
