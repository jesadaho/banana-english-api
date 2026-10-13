import { createHmac, timingSafeEqual } from 'crypto';

export const PRO_BANANA_CAP = 15;
export const PRO_REFILL_HOURS = 2;

export const FOUNDER_PRESALE_PRICE_THB = 150;
export const FOUNDER_PRESALE_SEATS = 30;
export const FOUNDER_PRESALE_YEARS = 1;
export const PRESALE_QR_TTL_MS = 15 * 60 * 1000;

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

/** Beam signs the raw body with HMAC-SHA256 and sends the digest as base64. */
export function beamSignatureMatches(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(signature.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
