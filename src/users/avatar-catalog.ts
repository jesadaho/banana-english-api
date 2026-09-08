/**
 * Avatar catalog costs — keep in sync with Flutter DefaultAvatars.seedCostsById.
 */
export const AVATAR_SEED_COSTS: Record<string, number> = {
  bogy: 0,
  nana: 0,
  kenji: 500,
  sky: 500,
  ray: 500,
  linda: 700,
  captain_banana: 2500,
};

/** Keep in sync with Flutter DefaultAvatars.minPerfectStarsById */
export const AVATAR_MIN_PERFECT_STARS: Record<string, number> = {
  linda: 15,
};

export const FREE_AVATAR_IDS = ['bogy', 'nana'] as const;

export function isKnownAvatarId(avatarId: string): boolean {
  return Object.prototype.hasOwnProperty.call(AVATAR_SEED_COSTS, avatarId);
}

export function avatarSeedCost(avatarId: string): number {
  return AVATAR_SEED_COSTS[avatarId] ?? Number.POSITIVE_INFINITY;
}

export function avatarMinPerfectStars(avatarId: string): number {
  return AVATAR_MIN_PERFECT_STARS[avatarId] ?? 0;
}

/** Same face Lesson intro / recent-learners show when avatarId is empty. */
export function resolveDisplayedAvatarId(
  avatarId: string | null | undefined,
  unlockedAvatarIds: string[] | null | undefined,
  userId: string,
): string {
  const trimmed = avatarId?.trim();
  if (trimmed && isKnownAvatarId(trimmed)) return trimmed;
  for (const unlocked of unlockedAvatarIds ?? []) {
    const id = unlocked.trim();
    if (id && isKnownAvatarId(id)) return id;
  }
  const catalog = Object.keys(AVATAR_SEED_COSTS);
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash + userId.charCodeAt(i) * (i + 1)) % catalog.length;
  }
  return catalog[hash] ?? 'bogy';
}
