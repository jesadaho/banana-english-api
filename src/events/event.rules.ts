import {
  ANOMALY_ATTEMPT_COUNT,
  ANOMALY_SCORE_THRESHOLD,
  BANGKOK_OFFSET_MS,
  EVENT_CTA_ROUTES,
  EVENT_GAME_KEYS,
  EVENT_TZ,
  ENDING_SOON_MS,
  FINALIZING_DELAY_MS,
  type EventClock,
  type EventGameKey,
  type EventLifecycleStatus,
  type EventRewardTierInput,
} from './event.types';

export function isEventGameKey(value: string): value is EventGameKey {
  return (EVENT_GAME_KEYS as readonly string[]).includes(value);
}

/** Events API is on for staging/production; set EVENTS_ENABLED=false to kill-switch. */
export function eventsApiEnabled(
  env: NodeJS.Dict<string | undefined> = process.env,
): boolean {
  const flag = (env.EVENTS_ENABLED ?? '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

export function defaultCtaRoute(gameKey: EventGameKey): string {
  return EVENT_CTA_ROUTES[gameKey];
}

export function defaultEventAvatarId(eventId: string, rankFrom: number): string {
  const compact = eventId.replace(/-/g, '').slice(0, 12);
  return `event_${compact}_${rankFrom}`;
}

export function bangkokMinuteKey(now: Date = new Date()): string {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

export function parseBangkokDateTime(
  raw: string,
  options: { endOfDay?: boolean } = {},
): Date {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Date is required');
  }
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid datetime: ${raw}`);
    }
    return date;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const time = options.endOfDay ? '23:59:59' : '00:00:00';
    return new Date(`${trimmed}T${time}+07:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    const suffix = options.endOfDay && trimmed.endsWith('T00:00')
      ? ':00+07:00'
      : ':00+07:00';
    if (options.endOfDay && /T00:00$/.test(trimmed)) {
      return new Date(`${trimmed.slice(0, 10)}T23:59:59+07:00`);
    }
    return new Date(`${trimmed}${suffix}`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    if (options.endOfDay && /T00:00:00$/.test(trimmed)) {
      return new Date(`${trimmed.slice(0, 10)}T23:59:59+07:00`);
    }
    return new Date(`${trimmed}+07:00`);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${raw}`);
  }
  return date;
}

export function clockStatus(event: EventClock, now: Date): EventLifecycleStatus {
  if (event.status === 'ARCHIVED' || event.status === 'REWARDED') {
    return event.status;
  }
  if (event.status === 'FINALIZING') {
    return 'FINALIZING';
  }
  if (!event.enabled) {
    if (event.status === 'ACTIVE' && now.getTime() <= event.endsAt.getTime()) {
      return 'ACTIVE';
    }
    if (
      event.status === 'ENDED' ||
      (event.status === 'ACTIVE' && now.getTime() > event.endsAt.getTime())
    ) {
      return 'ENDED';
    }
    return 'DRAFT';
  }
  if (now.getTime() < event.startsAt.getTime()) {
    return 'SCHEDULED';
  }
  if (now.getTime() <= event.endsAt.getTime()) {
    return 'ACTIVE';
  }
  if (event.snapshotAt) {
    return 'FINALIZING';
  }
  return 'ENDED';
}

export function shouldSnapshot(event: EventClock, now: Date): boolean {
  if (event.snapshotAt) return false;
  if (now.getTime() <= event.endsAt.getTime()) return false;
  return event.status === 'ACTIVE' || event.status === 'ENDED';
}

export function shouldDistribute(event: EventClock, now: Date): boolean {
  if (event.status !== 'FINALIZING') return false;
  if (event.rewardHold) return false;
  if (!event.autoDistributeRewards) return false;
  if (!event.snapshotAt) return false;
  return now.getTime() >= event.snapshotAt.getTime() + FINALIZING_DELAY_MS;
}

export function shouldNotifyEndingSoon(
  event: EventClock,
  now: Date,
  alreadyNotified: boolean,
): boolean {
  if (alreadyNotified) return false;
  if (clockStatus(event, now) !== 'ACTIVE') return false;
  const remaining = event.endsAt.getTime() - now.getTime();
  return remaining > 0 && remaining <= ENDING_SOON_MS;
}

export function rankMatchesTier(
  rank: number,
  rankFrom: number,
  rankTo: number,
): boolean {
  return rank >= rankFrom && rank <= rankTo;
}

export function tierForRank<T extends { rankFrom: number; rankTo: number }>(
  rank: number,
  tiers: T[],
): T | null {
  return tiers.find((tier) => rankMatchesTier(rank, tier.rankFrom, tier.rankTo)) ?? null;
}

export function isAnomalousScore(score: number): boolean {
  return score >= ANOMALY_SCORE_THRESHOLD;
}

export function isAnomalousAttemptRate(count: number): boolean {
  return count >= ANOMALY_ATTEMPT_COUNT;
}

export function validateRewardTiers(tiers: EventRewardTierInput[]): void {
  if (tiers.length === 0) return;
  const sorted = [...tiers].sort((a, b) => a.rankFrom - b.rankFrom);
  let cursor = 0;
  for (const tier of sorted) {
    if (!Number.isInteger(tier.rankFrom) || !Number.isInteger(tier.rankTo)) {
      throw new Error('Reward ranks must be integers');
    }
    if (tier.rankFrom < 1 || tier.rankTo < tier.rankFrom) {
      throw new Error('Reward rank range is invalid');
    }
    if (tier.rankFrom <= cursor) {
      throw new Error('Reward rank ranges overlap');
    }
    if (!tier.nameTh.trim() || !tier.nameEn.trim()) {
      throw new Error('Reward names are required');
    }
    cursor = tier.rankTo;
  }
}

export function eventTimezoneOrDefault(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed || EVENT_TZ;
}
