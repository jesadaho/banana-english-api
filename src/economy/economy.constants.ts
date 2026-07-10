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

export const ONBOARDING_BANANA_BONUS = 2;
export const DAILY_BANANA_DROP = 1;
export const DEBUG_BANANA_REFILL = 2;

export function getMissionReward(score: number): MissionRewardTier {
  const clamped = Math.max(0, Math.min(100, score));
  for (const tier of MISSION_REWARD_TIERS) {
    if (clamped >= tier.minScore) {
      return tier;
    }
  }
  return MISSION_REWARD_TIERS[MISSION_REWARD_TIERS.length - 1];
}
