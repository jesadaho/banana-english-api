import type { User } from '@prisma/client';

/** Must match the app's RevenueCat login id for users without Firebase. */
export const GUEST_APP_USER_PREFIX = 'guest_';

type PurchaseIdentity = Pick<User, 'firebaseUid' | 'anonymousId'>;

export function guestAppUserId(anonymousId: string): string {
  return `${GUEST_APP_USER_PREFIX}${anonymousId}`;
}

export function revenueCatAppUserId(user: PurchaseIdentity): string {
  return user.firebaseUid?.trim() || guestAppUserId(user.anonymousId);
}

/**
 * Ids a store transaction may be filed under: guest packs bought before
 * signing in stay on the guest RevenueCat user.
 */
export function revenueCatAppUserIdCandidates(user: PurchaseIdentity): string[] {
  const ids = [revenueCatAppUserId(user), guestAppUserId(user.anonymousId)];
  return [...new Set(ids)];
}

export function anonymousIdFromGuestAppUserId(appUserId: string): string | null {
  if (!appUserId.startsWith(GUEST_APP_USER_PREFIX)) return null;
  const id = appUserId.slice(GUEST_APP_USER_PREFIX.length).trim();
  return id || null;
}
