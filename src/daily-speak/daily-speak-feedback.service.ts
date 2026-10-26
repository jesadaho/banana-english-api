import { Injectable } from '@nestjs/common';

export type DailySpeakDiagnosisPayload = {
  target: string;
  transcript: string;
  tier?: string;
  reviewCase: string;
  missingWords?: string[];
  extraWords?: string[];
  wrongWords?: string[];
  pronunciationIssues?: string[];
  coverage?: number;
  listenLines?: string[];
};

/** Fixed Teacher B lines — banked as MP3. Do not interpolate learner words. */
export const DAILY_SPEAK_TEACHER_LINES = {
  great: 'ดีมากครับ! ประโยคนี้พูดได้ชัดเจนเลย',
  almost: 'ใกล้แล้วครับ ลองพูดอีกครั้งให้ครบประโยคนะ',
  rough: 'ไม่เป็นไรครับ ค่อย ๆ พูดไปทีละส่วนก็ได้',
  unclear: 'ยังฟังไม่ค่อยชัดครับ ลองพูดอีกครั้งนะ',
} as const;

export function collectDailySpeakBankLines(): string[] {
  return [
    DAILY_SPEAK_TEACHER_LINES.great,
    DAILY_SPEAK_TEACHER_LINES.almost,
    DAILY_SPEAK_TEACHER_LINES.rough,
  ];
}

/** Deterministic coaching line — Daily Speak does not call Gemini. */
export function localDailySpeakFeedback(
  diagnosis: DailySpeakDiagnosisPayload,
): string {
  const reviewCase = (diagnosis.reviewCase ?? '').trim().toLowerCase();
  switch (reviewCase) {
    case 'great':
      return DAILY_SPEAK_TEACHER_LINES.great;
    case 'almost':
      return DAILY_SPEAK_TEACHER_LINES.almost;
    case 'rough':
      return DAILY_SPEAK_TEACHER_LINES.rough;
    case 'unclear':
    default:
      return DAILY_SPEAK_TEACHER_LINES.unclear;
  }
}

@Injectable()
export class DailySpeakFeedbackService {
  async generate(params: {
    diagnosis: DailySpeakDiagnosisPayload;
  }): Promise<string> {
    return localDailySpeakFeedback(params.diagnosis);
  }
}
