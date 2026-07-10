export interface GptReply {
  textEn: string;
  textTh: string;
}

export type SessionType = 'intro' | 'legacy' | 'simulation' | 'training';

export interface FeedbackHints {
  grammarTip?: string;
  mispronouncedWords: string[];
}

export interface TurnExchangeResponse {
  aiResponse: string;
  textTh: string;
  audioBase64?: string;
  contentType?: string;
  isTaskComplete: boolean;
  updatedCheckpoints: Record<string, boolean>;
  feedbackHints: FeedbackHints;
  currentTurn: number;
}

export interface SimulationConfigResponse {
  simulationId: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  bananaCost: number;
  systemInstruction: string;
  successCriteria: string[];
  maxTurns: number;
}

export interface SimulationSessionResponse {
  id: string;
  sessionType: 'simulation';
  simulationId: string;
  startedAt: string;
  currentTurn: number;
  maxTurns: number;
  checkpointStates: Record<string, boolean>;
  isComplete: boolean;
}

export interface StartSimulationResponse {
  session: SimulationSessionResponse;
  simulation: SimulationConfigResponse;
  opening: TurnExchangeResponse;
}

export interface HintOption {
  id: string;
  label: string;
  sentenceEn: string;
}

export interface HintsResponse {
  hints: HintOption[];
}

export interface VocabItem {
  word: string;
  meaningTh: string;
  exampleEn: string;
}

export interface GptReport {
  feedbackEn: string;
  feedbackTh: string;
  bestSentenceEn: string;
  bestSentenceNoteTh: string;
  grammarTip: string;
  grammarTipTh: string;
  vocab: VocabItem[];
  pronunciationIssues: Array<{ word: string; scorePercent: number }>;
}

export interface MissionResultResponse extends GptReport {
  sessionId: string;
  durationSeconds: number;
  topicId?: string;
  missionTitleTh?: string;
  overallScore?: number;
  scoreLabel?: string;
  goldBananasEarned?: number;
  checkpointSummary?: Record<string, boolean>;
  rewards?: SessionRewardSummary;
}

export interface GptIntroReport {
  userName: string;
  levelTitle: string;
  levelEmoji: string;
  summaryTh: string;
  pronunciationScore: number;
  confidenceScore: number;
  listeningScore: number;
}

export interface SessionRewardSummary {
  xpEarned: number;
  seedsEarned: number;
  ratingLabel: string;
  streakDays: number;
  previousStreakDays: number;
  streakBonus?: { days: number; seedsEarned: number };
  balances: { bananas: number; xp: number; seeds: number };
  isDailyMission: boolean;
}

export interface IntroReportResponse extends GptIntroReport {
  sessionId: string;
}

export interface UserProfileResponse {
  anonymousId: string;
  displayName: string;
  onboardingCompleted: boolean;
  bananaBalance: number;
  xpBalance: number;
  bananaSeedBalance: number;
  streakDays: number;
  dailyUsedToday: boolean;
  timezone: string;
}
