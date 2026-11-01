export type WeeklyReportLocale = 'th' | 'en';

export type WeeklySpeakSegment = 'active' | 'light' | 'idle_app';
export type WeeklySendSegment = WeeklySpeakSegment | 'idle' | 'first_week';
export type WeeklyDecision =
  | { send: false; reason: 'gone' | 'idle_stopped' }
  | { send: true; speak: WeeklySpeakSegment | 'idle'; segment: WeeklySendSegment };

export type WeeklyCopyVars = {
  n?: number;
  w?: number;
  d?: number;
  k?: number;
  s?: number;
  r?: number;
  x?: number;
  game?: string;
  badge?: string;
  chapter?: string;
  name?: string;
  level?: string;
  count?: number;
};

export type WeeklyAddonKind =
  | 'interview'
  | 'level_test'
  | 'leaderboard_top'
  | 'leaderboard'
  | 'badge'
  | 'streak'
  | 'perfect'
  | 'vocab';

export type WeeklyAddon = {
  kind: WeeklyAddonKind;
  rank: 1 | 2 | 3;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  route: string;
  icon: string;
  vars: WeeklyCopyVars;
};

export type WeeklyStats = {
  sentences: number;
  minutes: number;
  words: number;
  speakSessions: number;
  lessonsCompleted: number;
  activeDayCount: number;
  activeDays: string;
  streakDays: number;
  streakRecord: boolean;
  addons: WeeklyAddon[];
  chapter?: number;
  chapterName?: string;
  chapterProgress?: number;
  remainingLessons?: number;
  chapterComplete?: boolean;
  rank?: number;
  game?: string;
};

export type WeeklyReportPayload = WeeklyStats & {
  weekKey: string;
  dateLabel: string;
  displayName: string;
  languageLevel: string | null;
  firstWeek: boolean;
  compare: boolean;
  deltas: {
    minutes: number;
    speakSessions: number;
    words: number;
    lessonsCompleted: number;
  };
};
