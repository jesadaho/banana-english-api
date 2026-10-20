export const PLACEMENT_QUESTION_VERSION = 'placement-q-v2.2';
export const PLACEMENT_RUBRIC_VERSION = 'placement-rubric-v2.2';
export const PLACEMENT_ROUTING_VERSION = 'placement-routing-v2.1';
export const PLACEMENT_MAPPING_VERSION = 'placement-start-v2.1';
export const PLACEMENT_SCENARIO_ID = 'onboarding_placement_bee';
export const PLACEMENT_MODEL_VERSION = 'placement-eval-v2.2';
export const PLACEMENT_PROMPT_VERSION = 'placement-prompt-v2.2';

export type PlacementEntrySource = 'onboarding' | 'profile_settings';
export type PlacementStageId =
  | 'foundation_entry'
  | 'a1'
  | 'a2'
  | 'b1';
export type PlacementPublicResult =
  | 'Seed'
  | 'Seed+'
  | 'A1'
  | 'A1+'
  | 'A2'
  | 'A2+'
  | 'B1';
export type PlacementBaseLevel = 'A1' | 'A2' | 'B1';
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
  | 'cancelled'
  | 'user_finished_after_a2';
export type PlacementRecommendationType =
  | 'course_start'
  | 'chapter_start'
  | 'review_checkpoint'
  | 'coming_soon';

export type PlacementDelivery =
  | 'text_audio'
  | 'picture_text_audio'
  | 'picture_audio'
  | 'audio_only';

export interface PlacementQuestion {
  id: string;
  stage: PlacementStageId;
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
  /** Second speaking turn on the same item (invite follow-up, hotel constraint). */
  followUp?: PlacementFollowUp;
}

export type PlacementFollowUp = {
  kind: 'invite_schedule' | 'constraint';
  timePrompt?: string;
  placePrompt?: string;
  prompt?: string;
  target: string;
  requiredEvidence: string;
  anchors2: string[];
  anchors1: string[];
};

export interface PlacementPendingFollowUp {
  questionId: string;
  prompt: string;
  variant: string;
  first: PlacementItemResult;
}

export interface PlacementItemResult {
  questionId: string;
  attemptId: string;
  status: PlacementItemStatus;
  score: PlacementScore | null;
  eligibleForPlacement: boolean;
  evidence: string[];
  reasonCode: PlacementReasonCode;
  /** Short debug explanation for why this score was given. */
  reason?: string;
  exactPrompt: string;
  variantId: string;
}

export interface PlacementFacts {
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
  pendingFollowUp: PlacementPendingFollowUp | null;
  finished: boolean;
  result: PlacementSessionResult | null;
}

export interface PlacementGateResults {
  entry: boolean;
  a1: boolean;
  a2: boolean;
  b1: boolean;
  a1Plus: boolean;
  a2Plus: boolean;
}

export interface PlacementQuestionResultRow {
  questionId: string;
  status: PlacementItemStatus;
  score: PlacementScore | null;
  eligibleForPlacement: boolean;
  evidence: string[];
  reasonCode: PlacementReasonCode;
  reason: string;
}

export interface PlacementSessionResult {
  /** Highest confirmed internal stage, for audit. Not a public badge. */
  demonstratedBand: PlacementStageId | null;
  publicResult: PlacementPublicResult | null;
  baseLevel: PlacementBaseLevel | null;
  gateResults: PlacementGateResults;
  resultStatus: PlacementResultStatus;
  resultLabel: string;
  recommendedStartKey: string;
  recommendationType: PlacementRecommendationType;
  intendedNextLevel: 'B1' | 'B2' | null;
  recommendedPathId: string | null;
  recommendedChapterId: string | null;
  recommendedNodeId: string | null;
  recommendedTitleEn: string | null;
  recommendedTitleTh: string | null;
  recommendedAppRoute: string | null;
  recommendedContentRef: Record<string, string> | null;
  usedFallback: boolean;
  fallbackPathId: string | null;
  fallbackChapterId: string | null;
  fallbackNodeId: string | null;
  fallbackNoticeTh: string | null;
  stopReason: PlacementStopReason;
  entrySource: PlacementEntrySource;
  completedQuestionIds: string[];
  questionResults: PlacementQuestionResultRow[];
  taskEvidence: string[];
  taskGaps: string[];
  /** 0/1/2 scored, -1 unevaluable, null not asked. */
  progressScores: Array<PlacementScore | -1 | null>;
  questionVersion: string;
  rubricVersion: string;
  routingVersion: string;
  mappingVersion: string;
  modelVersion: string;
  promptVersion: string;
  resolvedCatalogVersion: string | null;
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
  /** 0/1/2 scored, -1 unevaluable, null not asked. */
  progressScores: Array<PlacementScore | -1 | null>;
  lastDebug?: {
    questionId: string;
    score: PlacementScore | null;
    status: PlacementItemStatus;
    reason: string;
  };
  /** Same chime contract as Final Interview: 2 → correct, 1 → close, 0 → incorrect. */
  assessmentTier?: 'correct' | 'close' | 'incorrect';
  result?: PlacementSessionResult;
}
