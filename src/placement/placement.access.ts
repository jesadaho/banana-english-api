import { getUserLocalTime, parseDateKey } from '../common/timezone.util';
import type { PlacementEntrySource } from './placement.types';

export const PLACEMENT_RETEST_BANANA_COST = 5;
export const PLACEMENT_COOLDOWN_DAYS = 30;
export const PLACEMENT_MONTHLY_LIMIT_CODE = 'PLACEMENT_MONTHLY_LIMIT';

export type PlacementStartEntrySource =
  | 'onboarding'
  | 'profile_settings'
  | 'growth'
  | 'debug';

export function normalizePlacementEntrySource(
  raw?: string | null,
): PlacementStartEntrySource {
  if (
    raw === 'profile_settings' ||
    raw === 'growth' ||
    raw === 'debug'
  ) {
    return raw;
  }
  return 'onboarding';
}

export function isPaidPlacementRetest(
  source: PlacementStartEntrySource,
): boolean {
  return source === 'growth' || source === 'profile_settings';
}

export function shouldStampPlacementTest(
  source: PlacementStartEntrySource,
): boolean {
  return source !== 'debug';
}

export function placementRuntimeEntrySource(
  source: PlacementStartEntrySource,
): PlacementEntrySource {
  return source === 'onboarding' ? 'onboarding' : 'profile_settings';
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey).getTime();
  const to = parseDateKey(toKey).getTime();
  return Math.round((to - from) / 86_400_000);
}

export interface PlacementRetestStatus {
  available: boolean;
  bananaCost: number;
  daysRemaining: number;
  cooldownDays: number;
  nextAvailableDateKey: string | null;
}

export function placementRetestStatus(
  user: { timezone: string; lastPlacementTestAt?: Date | null },
  now = new Date(),
): PlacementRetestStatus {
  const last = user.lastPlacementTestAt ?? null;
  if (!last) {
    return {
      available: true,
      bananaCost: 0,
      daysRemaining: 0,
      cooldownDays: PLACEMENT_COOLDOWN_DAYS,
      nextAvailableDateKey: null,
    };
  }
  const lastKey = getUserLocalTime(user.timezone, last).dateKey;
  const nowKey = getUserLocalTime(user.timezone, now).dateKey;
  const nextKey = addDaysToDateKey(lastKey, PLACEMENT_COOLDOWN_DAYS);
  const remaining = daysBetweenDateKeys(nowKey, nextKey);
  if (remaining > 0) {
    return {
      available: false,
      bananaCost: PLACEMENT_RETEST_BANANA_COST,
      daysRemaining: remaining,
      cooldownDays: PLACEMENT_COOLDOWN_DAYS,
      nextAvailableDateKey: nextKey,
    };
  }
  return {
    available: true,
    bananaCost: PLACEMENT_RETEST_BANANA_COST,
    daysRemaining: 0,
    cooldownDays: PLACEMENT_COOLDOWN_DAYS,
    nextAvailableDateKey: null,
  };
}
