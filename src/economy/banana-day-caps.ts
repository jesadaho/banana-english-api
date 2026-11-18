import { getUserLocalTime, parseDateKey, resolveUserTimezone } from '../common/timezone.util';

/**
 * Free banana pool stays at `baseCap` (timed +1 / 4h).
 * Signup-day bonuses are one-shot uncapped credits:
 *   Day 0 → +day0, Day 1 → +day1, Day 2 → +day2, Day 3+ → none.
 *
 * Config (later wins): defaults → RC `banana_day_bonus` → Railway env.
 *   BANANA_DAY_BONUS={"baseCap":5,"day0":3,"day1":2,"day2":2}
 *   or BANANA_BONUS_DAY0 / BANANA_BONUS_DAY1 / BANANA_BONUS_DAY2
 *   MAX_BANANA_BALANCE aliases baseCap.
 *
 * Legacy RC/env `banana_day_caps` / BANANA_DAY_CAPS entitlements
 * ({"day0":8,"day1to2":7,"day3plus":5}) still map to base+bonus.
 */
export const BANANA_DAY_BONUS_RC_KEY = 'banana_day_bonus';
/** @deprecated entitlement shape — still accepted */
export const BANANA_DAY_CAPS_RC_KEY = 'banana_day_caps';
export const ENV_BANANA_DAY_BONUS = 'BANANA_DAY_BONUS';
export const ENV_BANANA_DAY_CAPS = 'BANANA_DAY_CAPS';
export const ENV_BANANA_BONUS_DAY0 = 'BANANA_BONUS_DAY0';
export const ENV_BANANA_BONUS_DAY1 = 'BANANA_BONUS_DAY1';
export const ENV_BANANA_BONUS_DAY2 = 'BANANA_BONUS_DAY2';
export const ENV_BANANA_CAP_DAY0 = 'BANANA_CAP_DAY0';
export const ENV_BANANA_CAP_DAY1TO2 = 'BANANA_CAP_DAY1TO2';
export const ENV_BANANA_CAP_DAY3PLUS = 'BANANA_CAP_DAY3PLUS';

export const SIGNUP_DAY_BONUS_SOURCE = 'signup_day_bonus';

export type BananaDayBonusConfig = {
  /** Free pool cap (timed refill). */
  baseCap: number;
  day0: number;
  day1: number;
  day2: number;
};

export const DEFAULT_BANANA_DAY_BONUS: BananaDayBonusConfig = {
  baseCap: 5,
  day0: 3,
  day1: 2,
  day2: 2,
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

export function signupDayBonusAmount(
  dayIndex: number,
  cfg: BananaDayBonusConfig = DEFAULT_BANANA_DAY_BONUS,
): number {
  if (dayIndex === 0) return cfg.day0;
  if (dayIndex === 1) return cfg.day1;
  if (dayIndex === 2) return cfg.day2;
  return 0;
}

/** Free pool + today's one-shot bonus (UI "รวมสิทธิ์"). */
export function signupDayEntitlement(
  dayIndex: number,
  cfg: BananaDayBonusConfig = DEFAULT_BANANA_DAY_BONUS,
): number {
  return cfg.baseCap + signupDayBonusAmount(dayIndex, cfg);
}

export function signupDayBonusRef(dayIndex: number): string {
  return `day${dayIndex}`;
}

function positiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(100, Math.floor(n));
}

function positiveCap(value: unknown, fallback: number): number {
  const n = positiveInt(value, fallback);
  return n < 1 ? fallback : n;
}

/** Bonus-shaped JSON `{"baseCap":5,"day0":3,"day1":2,"day2":2}`. */
export function parseBananaDayBonusJson(raw: string | null | undefined): BananaDayBonusConfig | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    // New shape
    if ('day0' in parsed || 'baseCap' in parsed || 'day1' in parsed) {
      if (!('day1to2' in parsed) && !('day3plus' in parsed)) {
        return {
          baseCap: positiveCap(parsed.baseCap, DEFAULT_BANANA_DAY_BONUS.baseCap),
          day0: positiveInt(parsed.day0, DEFAULT_BANANA_DAY_BONUS.day0),
          day1: positiveInt(parsed.day1, DEFAULT_BANANA_DAY_BONUS.day1),
          day2: positiveInt(parsed.day2, DEFAULT_BANANA_DAY_BONUS.day2),
        };
      }
    }
    // Legacy entitlement shape → bonuses = entitlement − base
    const base = positiveCap(parsed.day3plus ?? parsed.baseCap, DEFAULT_BANANA_DAY_BONUS.baseCap);
    const ent0 = positiveCap(parsed.day0, base + DEFAULT_BANANA_DAY_BONUS.day0);
    const ent12 = positiveCap(parsed.day1to2 ?? parsed.day1, base + DEFAULT_BANANA_DAY_BONUS.day1);
    return {
      baseCap: base,
      day0: Math.max(0, ent0 - base),
      day1: Math.max(0, ent12 - base),
      day2: Math.max(0, ent12 - base),
    };
  } catch {
    return null;
  }
}

export function parseBananaDayBonusFromRc(
  rc: Record<string, string> | null | undefined,
): BananaDayBonusConfig | null {
  return (
    parseBananaDayBonusJson(rc?.[BANANA_DAY_BONUS_RC_KEY]) ??
    parseBananaDayBonusJson(rc?.[BANANA_DAY_CAPS_RC_KEY])
  );
}

export type BananaDayBonusEnv = {
  bonusJson?: string | null;
  /** Legacy entitlement JSON. */
  capsJson?: string | null;
  day0?: string | null;
  day1?: string | null;
  day2?: string | null;
  /** Legacy entitlement ints. */
  capDay0?: string | null;
  capDay1to2?: string | null;
  capDay3plus?: string | null;
  maxBananaBalance?: string | null;
};

export function applyBananaDayBonusEnv(
  base: BananaDayBonusConfig,
  env: BananaDayBonusEnv,
): BananaDayBonusConfig {
  let cfg =
    parseBananaDayBonusJson(env.bonusJson ?? undefined) ??
    parseBananaDayBonusJson(env.capsJson ?? undefined) ??
    base;

  if (env.maxBananaBalance != null && String(env.maxBananaBalance).trim() !== '') {
    cfg = { ...cfg, baseCap: positiveCap(env.maxBananaBalance, cfg.baseCap) };
  }
  if (env.capDay3plus != null && String(env.capDay3plus).trim() !== '') {
    cfg = { ...cfg, baseCap: positiveCap(env.capDay3plus, cfg.baseCap) };
  }
  if (env.day0 != null && String(env.day0).trim() !== '') {
    cfg = { ...cfg, day0: positiveInt(env.day0, cfg.day0) };
  }
  if (env.day1 != null && String(env.day1).trim() !== '') {
    cfg = { ...cfg, day1: positiveInt(env.day1, cfg.day1) };
  }
  if (env.day2 != null && String(env.day2).trim() !== '') {
    cfg = { ...cfg, day2: positiveInt(env.day2, cfg.day2) };
  }
  // Legacy entitlement overrides → re-derive bonus from base
  if (env.capDay0 != null && String(env.capDay0).trim() !== '') {
    const ent = positiveCap(env.capDay0, cfg.baseCap + cfg.day0);
    cfg = { ...cfg, day0: Math.max(0, ent - cfg.baseCap) };
  }
  if (env.capDay1to2 != null && String(env.capDay1to2).trim() !== '') {
    const ent = positiveCap(env.capDay1to2, cfg.baseCap + cfg.day1);
    const bonus = Math.max(0, ent - cfg.baseCap);
    cfg = { ...cfg, day1: bonus, day2: bonus };
  }
  return cfg;
}

/** defaults → RC → env (Railway env wins when set). */
export function resolveBananaDayBonus(input: {
  rc?: Record<string, string> | null;
  env?: BananaDayBonusEnv;
}): BananaDayBonusConfig {
  const fromRc = parseBananaDayBonusFromRc(input.rc) ?? DEFAULT_BANANA_DAY_BONUS;
  return applyBananaDayBonusEnv(fromRc, input.env ?? {});
}
