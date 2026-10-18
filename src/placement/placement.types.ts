export const PLACEMENT_RUBRIC_VERSION = 'placement-v1';
export const PLACEMENT_SCENARIO_ID = 'onboarding_placement_bee';

export type PlacementEntrySource = 'onboarding' | 'profile_settings';
export type PlacementBandId = 'A1' | 'A1.5' | 'A2' | 'A2.5' | 'B1';
export type PlacementScore = 0 | 1 | 2;
export type PlacementItemStatus =
  | 'scored'
  | 'skipped'
  | 'technical_retry'
  | 'needs_review'
  | 'assisted'
  | 'not_administered';
export type PlacementReasonCode =
  | 'target_met'
  | 'target_partially_demonstrated'
  | 'off_topic'
  | 'no_communicative_answer'
  | 'user_skipped'
  | 'capture_error'
  | 'uncertain_transcription'
  | 'assistance_used';
export type PlacementResultStatus =
  | 'completed'
  | 'early_exit'
  | 'provisional'
  | 'insufficient_evidence'
  | 'cancelled';
export type PlacementStopReason =
  | 'b1_confirmed'
  | 'band_not_confirmed'
  | 'early_zero_streak'
  | 'insufficient_evidence'
  | 'cancelled';

export type PlacementDelivery = 'text_audio' | 'picture_text_audio' | 'picture_audio' | 'audio_only';

export interface PlacementQuestion {
  id: string;
  band: PlacementBandId;
  skill: string;
  npcEn: string;
  target: string;
  requiredEvidence: string;
  anchors2: string[];
  anchors1: string[];
  delivery: PlacementDelivery;
  imagePath?: string;
  sceneFacts?: string;
  /** Thai line played once before this item (ungraded). */
  transitionTh?: string;
  afterScoreEn?: string;
}

export interface PlacementItemResult {
  questionId: string;
  attemptId: string;
  status: PlacementItemStatus;
  score: PlacementScore | null;
  eligibleForPlacement: boolean;
  evidence: string[];
  reasonCode: PlacementReasonCode;
  exactPrompt: string;
  variantId: string;
}

export interface PlacementFacts {
  weekendActivity?: string;
  preference?: 'beach' | 'mountains' | 'other';
  storyProblem?: string;
}

export interface PlacementRuntimeState {
  scenarioId: typeof PLACEMENT_SCENARIO_ID;
  entrySource: PlacementEntrySource;
  learnerName: string;
  openingPlayed: boolean;
  audioOnlyAnnounced: boolean;
  currentQuestionId: string | null;
  askedQuestionIds: string[];
  results: Record<string, PlacementItemResult>;
  captureRetries: Record<string, number>;
  consecutiveZeros: number;
  facts: PlacementFacts;
  finished: boolean;
  result: PlacementSessionResult | null;
}

export interface PlacementSessionResult {
  demonstratedBand: PlacementBandId | null;
  resultStatus: PlacementResultStatus;
  resultLabel: string;
  recommendedStartKey: string;
  stopReason: PlacementStopReason;
  completedQuestionIds: string[];
  rubricVersion: string;
}

export interface PlacementTurnReply {
  aiResponse: string;
  textTh: string;
  expectsUserSpeech: boolean;
  canSkip: boolean;
  hideNpcTranscript: boolean;
  imagePath?: string;
  isTaskComplete: boolean;
  progressTurn: number;
  progressMax: number;
  result?: PlacementSessionResult;
}
