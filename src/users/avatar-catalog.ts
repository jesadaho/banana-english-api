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
