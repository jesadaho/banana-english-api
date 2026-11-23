import { createHash } from 'node:crypto';
import type { BananaDayBonusConfig } from './banana-day-caps';

/**
 * A/B test: signup-day banana bonus.
 *   A = Day 0 +2 only (control)
 *   B = Day 0 +3 · Day 1 +2 · Day 2 +2
 * New users from the start time are split 50/50 by a stable hash of their id;
 * the arm is stored on the user (`bananaBonusArm`) the first time it matters.
 * Users created before the start keep the bonus (no arm).
 *
 * Env: BANANA_BONUS_AB=off stops new assignments (stored arms still apply,
 * so nobody flips mid-test); BANANA_BONUS_AB_START=<ISO time>.
 */
export const BANANA_BONUS_EXPERIMENT = 'banana_bonus_2026_11';
export const ENV_BANANA_BONUS_AB = 'BANANA_BONUS_AB';
export const ENV_BANANA_BONUS_AB_START = 'BANANA_BONUS_AB_START';
export const DEFAULT_BANANA_BONUS_AB_START = '2026-11-23T00:00:00+07:00';

export type BananaBonusArm = 'A' | 'B';

export type BananaBonusAbSettings = { enabled: boolean; start: Date };

export function parseBananaBonusAbSettings(
  enabledRaw?: string | null,
  startRaw?: string | null,
): BananaBonusAbSettings {
  const flag = (enabledRaw ?? '').trim().toLowerCase();
  const enabled = !['off', '0', 'false', 'no'].includes(flag);
  const parsed = new Date((startRaw ?? '').trim() || DEFAULT_BANANA_BONUS_AB_START);
  const start = Number.isNaN(parsed.getTime()) ? new Date(DEFAULT_BANANA_BONUS_AB_START) : parsed;
  return { enabled, start };
}

/** Stable 50/50 split by user id. */
export function hashBananaBonusArm(userId: string): BananaBonusArm {
  const byte = createHash('sha256').update(`${BANANA_BONUS_EXPERIMENT}:${userId}`).digest()[0];
  return byte % 2 === 0 ? 'A' : 'B';
}

/** The user's arm: stored one first; else a new one if eligible; null = not in the test. */
export function bananaBonusArmFor(
  user: { id: string; createdAt: Date; bananaBonusArm?: string | null },
  settings: BananaBonusAbSettings,
): BananaBonusArm | null {
  if (user.bananaBonusArm === 'A' || user.bananaBonusArm === 'B') return user.bananaBonusArm;
  if (!settings.enabled || user.createdAt < settings.start) return null;
  return hashBananaBonusArm(user.id);
}

/** Arm A: Day 0 +2 only. Arm B / null: full cfg (Day 0 +3 · Day 1–2 +2). */
export function applyBananaBonusArm(
  cfg: BananaDayBonusConfig,
  arm: BananaBonusArm | null,
): BananaDayBonusConfig {
  return arm === 'A' ? { ...cfg, day0: 2, day1: 0, day2: 0 } : cfg;
}

/** Two-sided p-value for a difference of two proportions (null if too few). */
export function twoProportionPValue(x1: number, n1: number, x2: number, n2: number): number | null {
  if (n1 < 5 || n2 < 5) return null;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = Math.abs(x1 / n1 - x2 / n2) / se;
  return Math.round(2 * (1 - normalCdf(z)) * 1000) / 1000;
}

function normalCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const erf =
    1 -
    t *
      (0.254829592 +
        t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
      Math.exp(-(z * z) / 2);
  return 0.5 * (1 + erf);
}
