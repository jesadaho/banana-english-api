export interface MissionRewardTier {
  minScore: number;
  ratingLabel: string;
  xp: number;
  seeds: number;
}

export const MISSION_REWARD_TIERS: MissionRewardTier[] = [
  { minScore: 90, ratingLabel: 'Excellent', xp: 50, seeds: 25 },
  { minScore: 70, ratingLabel: 'Great Job', xp: 40, seeds: 15 },
  { minScore: 50, ratingLabel: 'Keep Going', xp: 30, seeds: 10 },
  { minScore: 0, ratingLabel: "Don't Give Up", xp: 20, seeds: 5 },
];

export const STREAK_MILESTONES: Array<{ days: number; seeds: number }> = [
  { days: 3, seeds: 20 },
  { days: 7, seeds: 50 },
  { days: 14, seeds: 100 },
  { days: 30, seeds: 300 },
];

export const LESSON_BANANA_COST = 1;
export const LESSON_REWARD_XP = 20;
export const LESSON_REWARD_SEEDS = 10;

export const ONBOARDING_BANANA_BONUS = 2;
export const DAILY_BANANA_DROP = 1;
export const DEBUG_BANANA_REFILL = 2;
/** Soft cap on banana balance — credits never push above this. */
export const MAX_BANANA_BALANCE = 5;

/** Env keys — defaults above apply when unset / invalid. */
export const ENV_ONBOARDING_BANANA_BONUS = 'ONBOARDING_BANANA_BONUS';
export const ENV_DAILY_BANANA_DROP = 'DAILY_BANANA_DROP';
export const ENV_DEBUG_BANANA_REFILL = 'DEBUG_BANANA_REFILL';
export const ENV_MAX_BANANA_BALANCE = 'MAX_BANANA_BALANCE';

/** How many bananas can still be credited without exceeding the cap. */
export function cappedBananaCredit(
  currentBalance: number,
  amount: number,
  maxBalance = MAX_BANANA_BALANCE,
): number {
  if (amount <= 0) return 0;
  const room = Math.max(0, maxBalance - currentBalance);
  return Math.min(amount, room);
}

export function getMissionReward(score: number): MissionRewardTier {
  const clamped = Math.max(0, Math.min(100, score));
  for (const tier of MISSION_REWARD_TIERS) {
    if (clamped >= tier.minScore) {
      return tier;
    }
  }
  return MISSION_REWARD_TIERS[MISSION_REWARD_TIERS.length - 1];
}

/** Stars for Journey activity / mission details (1–5). */
export function getStarRating(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped >= 90) return 5;
  if (clamped >= 70) return 4;
  if (clamped >= 50) return 3;
  return 2;
}
