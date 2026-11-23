import { createHash } from 'node:crypto';

/**
 * A/B test: which plan the membership paywall preselects. Every plan stays
 * visible; only the default (selected) option changes.
 *   A = Pro yearly ฿299 · B = Pro monthly ฿120 · C = Pro Max monthly ฿280
 * Anyone who opens the paywall after the start joins (a stable 1/3 split by
 * user id); the arm and first exposure are stored on the user.
 *
 * Env: PAYWALL_AB=off stops the test (the app falls back to Pro yearly);
 * PAYWALL_AB_START=<ISO time>.
 */
export const PAYWALL_EXPERIMENT = 'paywall_default_2026_11';
export const ENV_PAYWALL_AB = 'PAYWALL_AB';
export const ENV_PAYWALL_AB_START = 'PAYWALL_AB_START';
export const DEFAULT_PAYWALL_AB_START = '2026-11-24T00:00:00+07:00';

export type PaywallArm = 'A' | 'B' | 'C';
export type PaywallOffer = { plan: 'pro' | 'promax'; period: 'year1' | 'month1'; productId: string };

export const PAYWALL_ARMS: Record<PaywallArm, PaywallOffer & { label: string }> = {
  A: { plan: 'pro', period: 'year1', productId: 'pro_yearly', label: 'Pro yearly ฿299' },
  B: { plan: 'pro', period: 'month1', productId: 'pro_monthly', label: 'Pro monthly ฿120' },
  C: { plan: 'promax', period: 'month1', productId: 'promax_monthly', label: 'Pro Max monthly ฿280' },
};

/** Default when the test is off: push Pro yearly. */
export const PAYWALL_DEFAULT: PaywallOffer = { plan: 'pro', period: 'year1', productId: 'pro_yearly' };

export type PaywallAbSettings = { enabled: boolean; start: Date };

export function parsePaywallAbSettings(
  enabledRaw?: string | null,
  startRaw?: string | null,
): PaywallAbSettings {
  const flag = (enabledRaw ?? '').trim().toLowerCase();
  const enabled = !['off', '0', 'false', 'no'].includes(flag);
  const parsed = new Date((startRaw ?? '').trim() || DEFAULT_PAYWALL_AB_START);
  const start = Number.isNaN(parsed.getTime()) ? new Date(DEFAULT_PAYWALL_AB_START) : parsed;
  return { enabled, start };
}

export function isPaywallArm(v: unknown): v is PaywallArm {
  return v === 'A' || v === 'B' || v === 'C';
}

/** Stable 1/3 split by user id. */
export function hashPaywallArm(userId: string): PaywallArm {
  const n = createHash('sha256').update(`${PAYWALL_EXPERIMENT}:${userId}`).digest().readUInt32BE(0);
  return (['A', 'B', 'C'] as const)[n % 3]!;
}

/**
 * Arm to serve now: null when the test is off or not started (app default).
 * A stored arm always wins so nobody flips mid-test.
 */
export function paywallArmFor(
  user: { id: string; paywallArm?: string | null },
  settings: PaywallAbSettings,
  now = new Date(),
): PaywallArm | null {
  if (!settings.enabled || now < settings.start) return null;
  if (isPaywallArm(user.paywallArm)) return user.paywallArm;
  return hashPaywallArm(user.id);
}
