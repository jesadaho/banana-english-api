/**
 * Avatar catalog costs — keep in sync with Flutter DefaultAvatars.seedCostsById.
 */
export const AVATAR_SEED_COSTS: Record<string, number> = {
  street_lion: 0,
  cool_black_cat: 0,
  banana_astronaut: 0,
  dj_tiger: 0,
  white_elephant: 2500,
  koala: 500,
  fox: 500,
  owl: 500,
  mini_banana: 0,
  cactus: 0,
  hamster: 0,
  chick: 0,
  penguin: 0,
  panda: 0,
  rabbit: 0,
  orange_cat: 0,
  thai_dog: 0,
  monkey: 0,
  bogy: 0,
  nana: 0,
  sunny: 0,
  zig: 0,
  bloo: 0,
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

export const FREE_AVATAR_IDS = ['bogy', 'nana', 'monkey', 'thai_dog', 'orange_cat', 'rabbit', 'panda', 'penguin', 'chick', 'hamster', 'cactus', 'mini_banana', 'sunny', 'zig', 'bloo'] as const;

export function isKnownAvatarId(avatarId: string): boolean {
  return Object.prototype.hasOwnProperty.call(AVATAR_SEED_COSTS, avatarId);
}

export function avatarSeedCost(avatarId: string): number {
  return AVATAR_SEED_COSTS[avatarId] ?? Number.POSITIVE_INFINITY;
}

export function avatarMinPerfectStars(avatarId: string): number {
  return AVATAR_MIN_PERFECT_STARS[avatarId] ?? 0;
}

/** Face shown for a user in recent-learner rows; matches the app default when unset. */
export function resolveDisplayedAvatarId(
  avatarId: string | null | undefined,
): string {
  const trimmed = avatarId?.trim();
  return trimmed && isKnownAvatarId(trimmed) ? trimmed : 'bogy';
}

export function avatarMembership(id: string): 'PRO' | 'PRO_MAX' | null {
  if (['dj_tiger', 'banana_astronaut'].includes(id)) return 'PRO';
  if (['cool_black_cat', 'street_lion'].includes(id)) return 'PRO_MAX';
  return null;
}
export function canUseMemberAvatar(id: string, tier: string): boolean {
  const required = avatarMembership(id);
  return !required || tier === 'PRO_MAX' || (required === 'PRO' && tier === 'PRO');
}
