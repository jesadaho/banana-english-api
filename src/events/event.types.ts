export const EVENT_GAME_KEYS = [
  'emoji_speak_endless',
  'word_cards_endless',
  'explain_it_challenge',
] as const;

export type EventGameKey = (typeof EVENT_GAME_KEYS)[number];

export const EVENT_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'ENDED',
  'FINALIZING',
  'REWARDED',
  'ARCHIVED',
] as const;

export type EventLifecycleStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_TZ = 'Asia/Bangkok';
export const FINALIZING_DELAY_MS = 15 * 60 * 1000;
export const ENDING_SOON_MS = 24 * 60 * 60 * 1000;
export const EVENT_LEADERBOARD_TOP = 100;
export const ANOMALY_SCORE_THRESHOLD = 90_000;
export const ANOMALY_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
export const ANOMALY_ATTEMPT_COUNT = 20;
export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export const EVENT_CTA_ROUTES: Record<EventGameKey, string> = {
  emoji_speak_endless: '/games/emoji-speak?board=event',
  word_cards_endless: '/games/speak-card?board=event',
  explain_it_challenge: '/games/explain-it?board=event',
};

export const EVENT_GAME_LABELS: Record<EventGameKey, string> = {
  emoji_speak_endless: 'Emoji Speak Endless',
  word_cards_endless: 'Word Cards Endless',
  explain_it_challenge: 'Explain It Challenge',
};

export type EventClock = {
  enabled: boolean;
  startsAt: Date;
  endsAt: Date;
  status: EventLifecycleStatus;
  rewardHold: boolean;
  autoDistributeRewards: boolean;
  snapshotAt: Date | null;
};

export type EventRewardTierInput = {
  rankFrom: number;
  rankTo: number;
  avatarId?: string | null;
  avatarImageUrl?: string | null;
  nameTh: string;
  nameEn: string;
};

export type EventAvatarGrant = {
  id: string;
  imageUrl: string;
  nameTh: string;
  nameEn: string;
};

export type EventLeaderboardEntryDto = {
  rank: number;
  name: string;
  score: number;
  avatarId: string | null;
  isYou?: boolean;
};
