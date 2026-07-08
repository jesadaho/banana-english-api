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
  grammarTip: string;
  vocab: VocabItem[];
}

export interface DailyReportResponse extends GptReport {
  sessionId: string;
  durationSeconds: number;
  topicId?: string;
  missionTitleTh?: string;
  overallScore?: number;
  scoreLabel?: string;
  goldBananasEarned?: number;
  bestSentenceEn?: string;
  bestSentenceNoteTh?: string;
  pronunciationIssues?: Array<{ word: string; scorePercent: number }>;
  checkpointSummary?: Record<string, boolean>;
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

export interface IntroReportResponse extends GptIntroReport {
  sessionId: string;
}
