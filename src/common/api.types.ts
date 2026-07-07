export interface GptReply {
  textEn: string;
  textTh: string;
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
