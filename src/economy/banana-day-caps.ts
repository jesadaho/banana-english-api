import { getUserLocalTime, parseDateKey, resolveUserTimezone } from '../common/timezone.util';

/**
 * Free banana pool cap by local calendar day since signup.
 * Day 0 = signup day; Day 3+ is the steady-state free cap.
 *
 * Firebase Remote Config key `banana_day_caps` (JSON string), e.g.
 * `{"day0":8,"day1to2":7,"day3plus":5}`
 */
export const BANANA_DAY_CAPS_RC_KEY = 'banana_day_caps';

export type BananaDayCaps = {
  day0: number;
  day1to2: number;
  day3plus: number;
};

export const DEFAULT_BANANA_DAY_CAPS: BananaDayCaps = {
  day0: 8,
  day1to2: 7,
  day3plus: 5,
};

/** Local calendar days since signup (0 on the signup day). */
export function signupLocalDayIndex(
  createdAt: Date,
  timezone?: string | null,
  now = new Date(),
): number {
  const tz = resolveUserTimezone(timezone);
  const signupKey = getUserLocalTime(tz, createdAt).dateKey;
  const todayKey = getUserLocalTime(tz, now).dateKey;
  const ms = parseDateKey(todayKey).getTime() - parseDateKey(signupKey).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function freeBananaCapForSignupDay(
  dayIndex: number,
  caps: BananaDayCaps = DEFAULT_BANANA_DAY_CAPS,
): number {
  if (dayIndex <= 0) return caps.day0;
  if (dayIndex <= 2) return caps.day1to2;
  return caps.day3plus;
}

function positiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(100, Math.floor(n));
}

/** Parse RC JSON; invalid / missing → null (caller keeps defaults). */
export function parseBananaDayCapsFromRc(
  rc: Record<string, string> | null | undefined,
): BananaDayCaps | null {
  const raw = rc?.[BANANA_DAY_CAPS_RC_KEY]?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      day0: positiveInt(parsed.day0, DEFAULT_BANANA_DAY_CAPS.day0),
      day1to2: positiveInt(parsed.day1to2, DEFAULT_BANANA_DAY_CAPS.day1to2),
      day3plus: positiveInt(parsed.day3plus, DEFAULT_BANANA_DAY_CAPS.day3plus),
    };
  } catch {
    return null;
  }
}
