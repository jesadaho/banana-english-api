import { getUserLocalTime, parseDateKey, resolveUserTimezone } from '../common/timezone.util';

/**
 * Free banana pool cap by local calendar day since signup.
 * Day 0 = signup day; Day 3+ is the steady-state free cap.
 *
 * Config (later wins): code defaults → Firebase RC `banana_day_caps` → env.
 * Env (Railway):
 *   BANANA_DAY_CAPS={"day0":8,"day1to2":7,"day3plus":5}
 *   or BANANA_CAP_DAY0 / BANANA_CAP_DAY1TO2 / BANANA_CAP_DAY3PLUS
 *   (MAX_BANANA_BALANCE still aliases day3plus)
 */
export const BANANA_DAY_CAPS_RC_KEY = 'banana_day_caps';
export const ENV_BANANA_DAY_CAPS = 'BANANA_DAY_CAPS';
export const ENV_BANANA_CAP_DAY0 = 'BANANA_CAP_DAY0';
export const ENV_BANANA_CAP_DAY1TO2 = 'BANANA_CAP_DAY1TO2';
export const ENV_BANANA_CAP_DAY3PLUS = 'BANANA_CAP_DAY3PLUS';

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

/** Parse `{"day0":8,"day1to2":7,"day3plus":5}` — invalid → null. */
export function parseBananaDayCapsJson(raw: string | null | undefined): BananaDayCaps | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
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

/** Parse RC JSON; invalid / missing → null. */
export function parseBananaDayCapsFromRc(
  rc: Record<string, string> | null | undefined,
): BananaDayCaps | null {
  return parseBananaDayCapsJson(rc?.[BANANA_DAY_CAPS_RC_KEY]);
}

export type BananaDayCapsEnv = {
  /** Full JSON blob `BANANA_DAY_CAPS`. */
  dayCapsJson?: string | null;
  day0?: string | null;
  day1to2?: string | null;
  day3plus?: string | null;
  /** Legacy alias for day3plus (`MAX_BANANA_BALANCE`). */
  maxBananaBalance?: string | null;
};

/** Apply individual env ints on top of a base (only set keys win). */
export function applyBananaDayCapEnv(
  base: BananaDayCaps,
  env: BananaDayCapsEnv,
): BananaDayCaps {
  const fromJson = parseBananaDayCapsJson(env.dayCapsJson ?? undefined);
  let caps = fromJson ?? base;
  if (env.day0 != null && String(env.day0).trim() !== '') {
    caps = { ...caps, day0: positiveInt(env.day0, caps.day0) };
  }
  if (env.day1to2 != null && String(env.day1to2).trim() !== '') {
    caps = { ...caps, day1to2: positiveInt(env.day1to2, caps.day1to2) };
  }
  const day3 =
    env.day3plus != null && String(env.day3plus).trim() !== ''
      ? env.day3plus
      : env.maxBananaBalance;
  if (day3 != null && String(day3).trim() !== '') {
    caps = { ...caps, day3plus: positiveInt(day3, caps.day3plus) };
  }
  return caps;
}

/**
 * Resolve live caps: defaults → RC → env (Railway env wins when set).
 */
export function resolveBananaDayCaps(input: {
  rc?: Record<string, string> | null;
  env?: BananaDayCapsEnv;
}): BananaDayCaps {
  const fromRc = parseBananaDayCapsFromRc(input.rc) ?? DEFAULT_BANANA_DAY_CAPS;
  return applyBananaDayCapEnv(fromRc, input.env ?? {});
}
