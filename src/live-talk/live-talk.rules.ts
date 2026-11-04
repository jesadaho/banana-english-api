import { getUserLocalTime } from '../common/timezone.util';
import { placementBandFromResult } from '../placement/placement-band';

export const LIVE_TALK_SPEAKER_CAP = 10;
/** Leave-sheet thumbs: listen this long before we may ask. */
export const LIVE_TALK_RATING_MIN_LISTEN_MS = 3 * 60 * 1000;
/** Fraction of eligible exits that show the rating question. */
export const LIVE_TALK_RATING_SAMPLE_RATE = 0.3;

export const LIVE_TALK_MIN_LEVELS = ['a1', 'a2', 'listen_all'] as const;
export type LiveTalkMinSpeakLevel = (typeof LIVE_TALK_MIN_LEVELS)[number];
export type LiveTalkRole = 'host' | 'speaker' | 'listener';

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
  return role === 'host' || role === 'speaker';
}

export type JoinDecision =
  | { ok: true; role: LiveTalkRole }
  | { ok: false; reason: 'room_ended' | 'speaker_full' | 'level_too_low' };

export function decideJoin(input: {
  requested: 'speaker' | 'listener';
  roomStatus: string;
  speakerCount: number;
  band: string | null;
  minSpeakLevel: LiveTalkMinSpeakLevel;
  isHost: boolean;
}): JoinDecision {
  if (input.roomStatus !== 'live') return { ok: false, reason: 'room_ended' };
  if (input.requested === 'listener') {
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
  user: { communityAdmin?: boolean },
  env: NodeJS.Dict<string | undefined> = process.env,
): boolean {
  return user.communityAdmin === true || liveTalkCreateOpen(env);
}

export type LiveTalkRatingGate =
  | { ok: true }
  | { ok: false; reason: 'too_soon' | 'already_rated_today' };

export function resolveLiveTalkTimezone(timezone?: string | null): string {
  return timezone?.trim() || 'Asia/Bangkok';
}

function ratedOnLocalDay(
  at: Date | string | null | undefined,
  timezone: string,
  now: Date,
): boolean {
  if (!at) return false;
  const when = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(when.getTime())) return false;
  return (
    getUserLocalTime(timezone, when).dateKey ===
    getUserLocalTime(timezone, now).dateKey
  );
}

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
  if (ratedOnLocalDay(params.lastRatedAt, params.timezone, now)) {
    return { ok: false, reason: 'already_rated_today' };
  }
  return { ok: true };
}

/** Client sample: [0, 1) — keep 30% of eligible leaves. */
export function shouldSampleLiveTalkLeaveRating(sample: number): boolean {
  return sample >= 0 && sample < LIVE_TALK_RATING_SAMPLE_RATE;
}
