import { completedOnLocalDay } from '../common/timezone.util';
import { placementBandFromResult } from '../placement/placement-band';

export const LIVE_TALK_SPEAKER_CAP = 10;
export const LIVE_TALK_LISTENER_CAP = 8;
/** Leave-sheet thumbs: listen this long before we may ask. */
export const LIVE_TALK_RATING_MIN_LISTEN_MS = 3 * 60 * 1000;
/** Fraction of eligible exits that show the rating question. */
export const LIVE_TALK_RATING_SAMPLE_RATE = 0.3;
/** Host has this long to connect to LiveKit before an empty room is swept. */
export const LIVE_TALK_CONNECT_GRACE_MS = 2 * 60 * 1000;
/** Hard cap when LiveKit occupancy cannot be checked. */
export const LIVE_TALK_MAX_LIVE_MS = 3 * 60 * 60 * 1000;

export const LIVE_TALK_MIN_LEVELS = ['a1', 'a2', 'listen_all'] as const;
export type LiveTalkMinSpeakLevel = (typeof LIVE_TALK_MIN_LEVELS)[number];
export type LiveTalkRole = 'host' | 'cohost' | 'speaker' | 'listener';

/** Co-hosts per room (spec: at most 2). */
export const LIVE_TALK_COHOST_CAP = 2;
/** After a role-change token, the old connection's leave webhook is ignored this long. */
export const LIVE_TALK_RECONNECT_GRACE_MS = 20 * 1000;
/** In-room invites (scout / co-host) expire after this. */
export const LIVE_TALK_INVITE_TTL_MS = 10 * 60 * 1000;

export const HOST_LEVELS = ['none', 'trainee', 'host', 'official'] as const;
export type HostLevel = (typeof HOST_LEVELS)[number];

const HOST_LEVEL_RANK: Record<HostLevel, number> = {
  none: 0,
  trainee: 1,
  host: 2,
  official: 3,
};

export function isHostLevel(value: unknown): value is HostLevel {
  return typeof value === 'string' && (HOST_LEVELS as readonly string[]).includes(value);
}

export function hostLevelOf(user: { hostLevel?: string | null }): HostLevel {
  return isHostLevel(user.hostLevel) ? user.hostLevel : 'none';
}

export function hostLevelAtLeast(
  user: { hostLevel?: string | null },
  min: HostLevel,
): boolean {
  return HOST_LEVEL_RANK[hostLevelOf(user)] >= HOST_LEVEL_RANK[min];
}

/** Official Hosts scout Trainees and change Trainee / Host levels. */
export function canManageHosts(user: {
  hostLevel?: string | null;
  communityAdmin?: boolean;
}): boolean {
  return user.communityAdmin === true || hostLevelOf(user) === 'official';
}

/**
 * Who may set [target] to [to]. Official is admin-only (web admin), so the
 * in-app path never grants or removes it.
 */
export function canChangeHostLevel(input: {
  actor: { hostLevel?: string | null; communityAdmin?: boolean };
  from: HostLevel;
  to: HostLevel;
}): boolean {
  if (!canManageHosts(input.actor)) return false;
  if (input.from === input.to) return false;
  return input.from !== 'official' && input.to !== 'official';
}

const BAND_RANK: Record<string, number> = {
  Seed: 0,
  'Seed+': 1,
  'Seed++': 2,
  A1: 3,
  'A1+': 4,
  A2: 5,
  B1: 6,
};

export function isLiveTalkMinLevel(
  value: string,
): value is LiveTalkMinSpeakLevel {
  return (LIVE_TALK_MIN_LEVELS as readonly string[]).includes(value);
}

export function bandRank(band: string | null | undefined): number {
  if (!band) return -1;
  return BAND_RANK[band] ?? -1;
}

export function canSpeakAtLevel(
  band: string | null | undefined,
  minSpeakLevel: LiveTalkMinSpeakLevel,
): boolean {
  const rank = bandRank(band);
  if (minSpeakLevel === 'listen_all') return rank >= 0 || rank === -1;
  if (rank < 0) return false;
  if (minSpeakLevel === 'a2') return rank >= BAND_RANK.A2;
  return rank >= BAND_RANK.A1;
}

export function placementBandOf(user: { placementResult?: unknown }): string | null {
  return placementBandFromResult(user.placementResult ?? null);
}

export function countsAsSpeaker(role: string): boolean {
  return role === 'host' || role === 'cohost' || role === 'speaker';
}

/** Host and co-hosts may mute; only the host kicks, ends, or names co-hosts. */
export function canModerateInRoom(role: string | undefined): boolean {
  return role === 'host' || role === 'cohost';
}

export type JoinDecision =
  | { ok: true; role: LiveTalkRole }
  | {
      ok: false;
      reason: 'room_ended' | 'speaker_full' | 'listener_full' | 'level_too_low';
    };

export function decideJoin(input: {
  requested: 'speaker' | 'listener';
  roomStatus: string;
  speakerCount: number;
  listenerCount?: number;
  band: string | null;
  minSpeakLevel: LiveTalkMinSpeakLevel;
  isHost: boolean;
}): JoinDecision {
  if (input.roomStatus !== 'live') return { ok: false, reason: 'room_ended' };
  if (input.requested === 'listener') {
    if ((input.listenerCount ?? 0) >= LIVE_TALK_LISTENER_CAP) {
      return { ok: false, reason: 'listener_full' };
    }
    return { ok: true, role: 'listener' };
  }
  if (input.isHost) return { ok: true, role: 'host' };
  if (!canSpeakAtLevel(input.band, input.minSpeakLevel)) {
    return { ok: false, reason: 'level_too_low' };
  }
  if (input.speakerCount >= LIVE_TALK_SPEAKER_CAP) {
    return { ok: false, reason: 'speaker_full' };
  }
  return { ok: true, role: 'speaker' };
}

export function decidePromote(input: {
  speakerCount: number;
  band: string | null;
  minSpeakLevel: LiveTalkMinSpeakLevel;
}): JoinDecision {
  return decideJoin({
    requested: 'speaker',
    roomStatus: 'live',
    speakerCount: input.speakerCount,
    band: input.band,
    minSpeakLevel: input.minSpeakLevel,
    isHost: false,
  });
}

/** Staging / explicit flag: anyone can host. Production stays community-admin. */
export function liveTalkCreateOpen(
  env: NodeJS.Dict<string | undefined> = process.env,
): boolean {
  const flag = (env.LIVE_TALK_OPEN_CREATE ?? '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  const hay = [
    env.RAILWAY_ENVIRONMENT,
    env.RAILWAY_ENVIRONMENT_NAME,
    env.RAILWAY_PUBLIC_DOMAIN,
    env.RAILWAY_STATIC_URL,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes('staging');
}

export function canCreateLiveTalkRoom(
  user: { communityAdmin?: boolean; hostLevel?: string | null },
  env: NodeJS.Dict<string | undefined> = process.env,
): boolean {
  return (
    user.communityAdmin === true ||
    hostLevelAtLeast(user, 'host') ||
    liveTalkCreateOpen(env)
  );
}

export type LiveTalkSweepRoom = {
  id: string;
  livekitRoomName: string;
  createdAt: Date;
  activeCount: number;
};

/**
 * Empty DB roster, gone/empty LiveKit room (after grace), or past max age
 * when occupancy is unknown.
 */
export function isStaleLiveTalkRoom(
  room: LiveTalkSweepRoom,
  now: Date,
  occupancy: Map<string, number> | null,
  opts?: { graceMs?: number; maxAgeMs?: number },
): boolean {
  if (room.activeCount <= 0) return true;
  const age = now.getTime() - room.createdAt.getTime();
  const graceMs = opts?.graceMs ?? LIVE_TALK_CONNECT_GRACE_MS;
  const maxAgeMs = opts?.maxAgeMs ?? LIVE_TALK_MAX_LIVE_MS;
  if (occupancy) {
    const n = occupancy.get(room.livekitRoomName) ?? 0;
    return n <= 0 && age >= graceMs;
  }
  return age >= maxAgeMs;
}

export type LiveTalkRatingGate =
  | { ok: true }
  | { ok: false; reason: 'too_soon' | 'already_rated_today' };

/** Server guard: 3 minutes in-room and at most one rating per local day. */
export function canSubmitLiveTalkLeaveRating(params: {
  listenedMs: number;
  lastRatedAt?: Date | null;
  timezone: string;
  now?: Date;
}): LiveTalkRatingGate {
  const now = params.now ?? new Date();
  if (params.listenedMs < LIVE_TALK_RATING_MIN_LISTEN_MS) {
    return { ok: false, reason: 'too_soon' };
  }
  if (completedOnLocalDay(params.lastRatedAt, params.timezone, now)) {
    return { ok: false, reason: 'already_rated_today' };
  }
  return { ok: true };
}

/** Client sample: [0, 1) — keep 30% of eligible leaves. */
export function shouldSampleLiveTalkLeaveRating(sample: number): boolean {
  return sample >= 0 && sample < LIVE_TALK_RATING_SAMPLE_RATE;
}
