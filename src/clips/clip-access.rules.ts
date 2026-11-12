/** Clips practice lock: Dictation · Shadowing · word meanings (one unlock covers all three). */
export const CLIP_UNLOCK_COST = 2;
/** Clips a user can practise without bananas (lifetime, distinct clips). */
export const CLIP_FREE_UNLOCKS = 3;
/** Thailand time (UTC+7, no DST): a banana unlock lasts until midnight there. */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function bangkokDay(d: Date): string {
  return new Date(d.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}
/** Firebase Remote Config key (parameter default "true" turns the lock on). */
export const CLIPS_LOCK_RC_KEY = 'clips_lock_enabled';

export type ClipAccessKind = 'off' | 'pro_max' | 'free' | 'banana';

export type ClipAccessDecision =
  | { status: 'unlocked'; kind: ClipAccessKind; reuseUnlockId?: string }
  | { status: 'create_free' }
  | { status: 'locked' }
  | { status: 'insufficient' }
  | { status: 'spend' };

export type ExistingUnlock = { id: string; kind: string; createdAt: Date };

export function lockEnabledFrom(rc: Record<string, string> | null | undefined): boolean {
  return (rc?.[CLIPS_LOCK_RC_KEY] ?? '').trim().toLowerCase() === 'true';
}

/** Still usable: a free unlock never expires; a banana unlock lasts the rest of that (Bangkok) day. */
export function unlockValid(u: ExistingUnlock, now = new Date()): boolean {
  if (u.kind === 'free') return true;
  return bangkokDay(u.createdAt) === bangkokDay(now);
}

/**
 * What POST /clips/:id/unlock does. [existing] = this user's unlocks for this
 * clip; [token] = the unlock the app still holds for this clip page (if any).
 */
export function decideClipAccess(p: {
  lockEnabled: boolean;
  proMax: boolean;
  existing: ExistingUnlock[];
  token?: string | null;
  freeUsed: number;
  balance: number;
  spend: boolean;
  now?: Date;
}): ClipAccessDecision {
  if (!p.lockEnabled) return { status: 'unlocked', kind: 'off' };
  if (p.proMax) return { status: 'unlocked', kind: 'pro_max' };
  const now = p.now ?? new Date();
  const free = p.existing.find((u) => u.kind === 'free');
  if (free) return { status: 'unlocked', kind: 'free', reuseUnlockId: free.id };
  // Paid today for this clip → practise all day (any device, no token needed).
  const today = p.existing.find((u) => u.kind === 'banana' && unlockValid(u, now));
  if (today) return { status: 'unlocked', kind: 'banana', reuseUnlockId: today.id };
  if (p.freeUsed < CLIP_FREE_UNLOCKS) return { status: 'create_free' };
  if (p.balance < CLIP_UNLOCK_COST) return { status: 'insufficient' };
  return p.spend ? { status: 'spend' } : { status: 'locked' };
}

/** Word meaning allowed? (server-side check for GET …/words/:wordIdx) */
export function wordAccessAllowed(p: {
  lockEnabled: boolean;
  proMax: boolean;
  existing: ExistingUnlock[];
  token?: string | null;
  now?: Date;
}): boolean {
  if (!p.lockEnabled || p.proMax) return true;
  const now = p.now ?? new Date();
  return p.existing.some((u) => unlockValid(u, now));
}
