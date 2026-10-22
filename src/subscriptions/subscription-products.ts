/** Store subscription products sold through RevenueCat (offerings `membership`, `early_bird`). */
export type SubscriptionProduct = {
  productId: string;
  tier: 'PRO' | 'PRO_MAX';
  months: number;
  priceThb: number;
  earlyBird: boolean;
};

export const EARLY_BIRD_PRODUCT_ID = 'promax_yearly_earlybird';

const PRODUCTS: SubscriptionProduct[] = [
  { productId: 'pro_monthly', tier: 'PRO', months: 1, priceThb: 120, earlyBird: false },
  { productId: 'pro_quarterly', tier: 'PRO', months: 3, priceThb: 240, earlyBird: false },
  { productId: 'pro_yearly', tier: 'PRO', months: 12, priceThb: 360, earlyBird: false },
  { productId: 'promax_monthly', tier: 'PRO_MAX', months: 1, priceThb: 280, earlyBird: false },
  { productId: 'promax_quarterly', tier: 'PRO_MAX', months: 3, priceThb: 380, earlyBird: false },
  { productId: 'promax_yearly', tier: 'PRO_MAX', months: 12, priceThb: 780, earlyBird: false },
  { productId: EARLY_BIRD_PRODUCT_ID, tier: 'PRO_MAX', months: 12, priceThb: 280, earlyBird: true },
];

const BY_ID = new Map(PRODUCTS.map((p) => [p.productId, p]));

/**
 * Play subscriptions arrive as `productId:basePlanId`; App Store ids are bare.
 */
export function normalizeSubscriptionProductId(raw: string | undefined | null): string {
  return (raw ?? '').trim().split(':')[0] ?? '';
}

export function subscriptionProduct(raw: string | undefined | null): SubscriptionProduct | null {
  return BY_ID.get(normalizeSubscriptionProductId(raw)) ?? null;
}

const TIER_RANK = { FREE: 0, PRO: 1, PRO_MAX: 2 } as const;

/**
 * Merge a store period into the current plan. A lower tier never replaces an
 * active higher tier, and the same tier never shortens a longer grant
 * (Founder Presale buyers keep their year).
 */
export function mergeStorePeriod(params: {
  currentTier: 'FREE' | 'PRO' | 'PRO_MAX';
  currentExpiresAt: Date | null;
  newTier: 'PRO' | 'PRO_MAX';
  newExpiresAt: Date;
  now?: Date;
}): { tier: 'PRO' | 'PRO_MAX'; expiresAt: Date; changed: boolean } {
  const now = params.now ?? new Date();
  const active =
    params.currentTier !== 'FREE' &&
    !!params.currentExpiresAt &&
    params.currentExpiresAt.getTime() > now.getTime();
  if (!active) {
    return { tier: params.newTier, expiresAt: params.newExpiresAt, changed: true };
  }
  const current = params.currentTier as 'PRO' | 'PRO_MAX';
  const currentExpiresAt = params.currentExpiresAt as Date;
  const rankNew = TIER_RANK[params.newTier];
  const rankCurrent = TIER_RANK[current];
  if (rankNew > rankCurrent) {
    return { tier: params.newTier, expiresAt: params.newExpiresAt, changed: true };
  }
  if (rankNew < rankCurrent) {
    return { tier: current, expiresAt: currentExpiresAt, changed: false };
  }
  if (params.newExpiresAt.getTime() > currentExpiresAt.getTime()) {
    return { tier: current, expiresAt: params.newExpiresAt, changed: true };
  }
  return { tier: current, expiresAt: currentExpiresAt, changed: false };
}

/** `offer_day_<n>` (post-lesson offer), `settings`, or `debug`; anything else → `other`. */
export function earlyBirdReserveSource(raw: string | undefined | null): string {
  const value = (raw ?? '').trim();
  if (/^offer_day_\d{1,2}$/.test(value) || value === 'settings' || value === 'debug') {
    return value;
  }
  return 'other';
}
