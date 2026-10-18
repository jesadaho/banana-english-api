import { createHmac, timingSafeEqual } from 'crypto';

export const PRO_BANANA_CAP = 15;
export const PRO_REFILL_HOURS = 2;

export const FOUNDER_PRESALE_PRICE_THB = 150;
export const FOUNDER_PRESALE_SEATS = 30;
/** Held off the public counter so the remaining seats look tighter. */
export const FOUNDER_PRESALE_HELD_SEATS = 8;
export const FOUNDER_PRESALE_YEARS = 1;
export const PRESALE_QR_TTL_MS = 15 * 60 * 1000;
/** Sale opens Sunday 18 Oct 2026, 21:00 Asia/Bangkok. */
export const FOUNDER_PRESALE_OPENS_AT = new Date('2026-10-18T14:00:00.000Z');

export function presaleSeatsRemaining(sold: number): number {
  return Math.max(0, FOUNDER_PRESALE_SEATS - FOUNDER_PRESALE_HELD_SEATS - sold);
}

export function presaleIsSoldOut(sold: number): boolean {
  return presaleSeatsRemaining(sold) <= 0;
}

export type SubscriptionTierName = 'FREE' | 'PRO' | 'PRO_MAX';

type TierUser = {
  subscriptionTier: string;
  subscriptionExpiresAt: Date | null;
};

/** Active tier. An expiry in the past falls back to free. */
export function effectiveSubscriptionTier(
  user: TierUser,
  now = new Date(),
): SubscriptionTierName {
  const tier = user.subscriptionTier;
  if (tier !== 'PRO' && tier !== 'PRO_MAX') return 'FREE';
  if (!user.subscriptionExpiresAt || user.subscriptionExpiresAt.getTime() <= now.getTime()) {
    return 'FREE';
  }
  return tier;
}

export function addYears(from: Date, years: number): Date {
  const next = new Date(from.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

/**
 * Beam Lighthouse shows the HMAC key as base64. Decode it to bytes, sign the
 * raw body with HMAC-SHA256, then compare the base64 digest to X-Beam-Signature.
 */
export function beamSignatureMatches(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  const trimmed = secret.trim();
  if (!signature || !trimmed) return false;
  const key = Buffer.from(trimmed, 'base64');
  if (key.length === 0) return false;
  const digest = createHmac('sha256', key).update(rawBody).digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(signature.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
