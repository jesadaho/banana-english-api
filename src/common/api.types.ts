export interface GptReply {
  textEn: string;
  textTh: string;
}

/** Structured Free Talk turn (client still only needs textEn/textTh). */
export interface FreeTalkTurnReply extends GptReply {
  phase: string;
  nextAction: string;
  intent?: string;
  emotion?: string;
  grammarNote?: string;
  topic?: string;
  conversationDepth?: string;
  /** Internal only — not returned to the app. */
  grammarDamage?: 'none' | 'low' | 'medium' | 'high';
  naturalnessDamage?: 'none' | 'low' | 'medium' | 'high';
  issueNote?: string;
  softRecastEn?: string;
  softRecastTh?: string;
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
  pronunciation?: string;
}

export interface HintsResponse {
  hints: HintOption[];
}

export interface VocabItem {
  word: string;
  meaningTh: string;
  exampleEn: string;
}

export type TurnFeedbackStatus = 'great' | 'good' | 'needs_improvement';

/** Coaching feedback for one learner utterance (Mission History transcript). */
export interface TurnFeedback {
  status: TurnFeedbackStatus;
  headlineTh: string;
  detailTh?: string | null;
  /** Natural alternative ("ลองพูด"). Empty when status is great/good. */
  suggestionEn?: string | null;
  /** Why the alternative is better ("เหตุผล"). */
  suggestionReasonTh?: string | null;
}

export interface TurnFeedbackItem extends TurnFeedback {
  /** 0-based index among learner turns only. */
  userTurnIndex: number;
}

export interface StoredChatTurn {
  speaker: 'user' | 'ai';
  textEn: string;
  textTh?: string | null;
  /** Raw STT / spoken text before Thai Mix. Null when identical or legacy. */
  originalTextEn?: string | null;
  feedback?: TurnFeedback | null;
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
  /** Per-learner-turn coaching; aligned by userTurnIndex. */
  turnFeedback?: TurnFeedbackItem[];
}

/** Free Talk wrap-up extras (also used to overwrite user memories). */
export interface FreeTalkSessionSummary extends GptReport {
  conversationSummaryEn: string;
  conversationSummaryTh: string;
  /** Up to 5 most important lasting facts from this session. */
  memories: string[];
}

export interface MissionResultResponse extends GptReport {
  sessionId: string;
  durationSeconds: number;
  topicId?: string;
  missionTitleTh?: string;
  overallScore?: number;
  scoreLabel?: string;
  starRating?: number;
  goldBananasEarned?: number;
  checkpointSummary?: Record<string, boolean>;
  rewards?: SessionRewardSummary;
  simulationId?: string;
  seriesId?: string;
  seriesTitleEn?: string;
  seriesTitleTh?: string;
  completedAt?: string;
  /** Text-only conversation turns (no audio). */
  turns?: StoredChatTurn[];
  conversationSummaryEn?: string;
  conversationSummaryTh?: string;
  memories?: string[];
}

export interface ActivityItemResponse {
  sessionId: string;
  simulationId: string;
  seriesId: string;
  seriesTitleEn: string;
  seriesTitleTh: string;
  titleEn: string;
  titleTh: string;
  coverImage: string;
  completedAt: string;
  overallScore: number;
  scoreLabel: string;
  starRating: number;
  xpEarned: number;
  seedsEarned: number;
  /** False when score/report were never persisted (legacy sessions). */
  hasDetails: boolean;
}

export interface ActivityListResponse {
  items: ActivityItemResponse[];
  nextCursor: string | null;
}

export interface ActivityDaysResponse {
  dates: string[];
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
  unlockedAvatarIds: string[];
}
