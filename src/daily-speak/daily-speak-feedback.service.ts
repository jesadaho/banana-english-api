import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';

const FEEDBACK_SYSTEM = `You are Teacher Banana (Teacher B) speaking to a Thai adult beginner on Speak Today.

You do NOT grade. Local diagnosis is 100% ground truth.
Your only job: turn the diagnosis into a short, warm spoken coaching line.

Hard rules:
- Use ONLY facts in the diagnosis JSON. Never invent missing/wrong words.
- 1–2 short spoken Thai sentences. End naturally with “ครับ”.
- No bullets, scores, or emoji in the spoken line.
- Fix / mention at most ONE issue (prefer the first missingWord).
- Quote English only for that one word and/or the model sentence when helpful.
- If reviewCase is "great": celebrate briefly; do not invent problems.
- If reviewCase is "almost": mention the one missing/wrong fact, then invite them to say the full target.
- If reviewCase is "rough": encourage gently; invite starting from listenLines[0] if present. Do not list many errors.
- NEVER say “พรุ่งนี้” or imply the session is finished.
- Return JSON only: { "feedbackTh": string }.`;

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

/** Deterministic fallback when Gemini is unavailable. */
export function localDailySpeakFeedback(
  diagnosis: DailySpeakDiagnosisPayload,
): string {
  const target = (diagnosis.target ?? '').trim().replace(/[.!?]+$/, '');
  const transcript = (diagnosis.transcript ?? '').trim();
  const reviewCase = (diagnosis.reviewCase ?? '').trim().toLowerCase();
  const missing = diagnosis.missingWords ?? [];
  const listenLines = diagnosis.listenLines ?? [];

  switch (reviewCase) {
    case 'great':
      return 'ดีมากครับ! ประโยคนี้พูดได้ชัดเจนเลย';
    case 'almost':
      if (missing.length === 1) {
        return `ขาดคำว่า “${missing[0]}” อีกนิดเดียวครับ ลองพูดใหม่ว่า “${target}” นะ`;
      }
      if (missing.length > 1 && missing.length <= 3) {
        const words = missing.map((w) => `“${w}”`).join(' ');
        return `ใกล้แล้วครับ ยังขาด ${words} นิดหน่อย ลองพูดใหม่ว่า “${target}” นะ`;
      }
      return `ใกล้แล้วครับ ลองพูดใหม่ว่า “${target}” นะ`;
    case 'rough': {
      const first = listenLines[0] ?? target;
      return `ไม่เป็นไรครับ ค่อย ๆ พูดไปทีละส่วนก็ได้ ลองเริ่มจาก “${first}” ก่อนนะ`;
    }
    case 'unclear':
    default:
      if (!transcript) {
        return 'ยังฟังไม่ค่อยชัดครับ ลองพูดอีกครั้งนะ';
      }
      return 'ยังฟังไม่ค่อยชัดครับ ลองพูดอีกครั้งนะ';
  }
}

@Injectable()
export class DailySpeakFeedbackService {
  private readonly logger = new Logger(DailySpeakFeedbackService.name);

  constructor(private readonly gemini: GeminiChatService) {}

  async generate(params: {
    diagnosis: DailySpeakDiagnosisPayload;
  }): Promise<string> {
    const diagnosis = params.diagnosis;
    const reviewCase = (diagnosis.reviewCase ?? '').trim().toLowerCase();

    // Unclear / great: local only (no Gemini).
    if (reviewCase === 'unclear' || reviewCase === 'great') {
      return localDailySpeakFeedback(diagnosis);
    }

    const target = (diagnosis.target ?? '').trim();
    const transcript = (diagnosis.transcript ?? '').trim();
    if (!target || !transcript) {
      return localDailySpeakFeedback(diagnosis);
    }

    const userPrompt = [
      'Diagnosis (ground truth — do not contradict):',
      JSON.stringify(diagnosis, null, 2),
      'Write one short Teacher B spoken coaching line now.',
    ].join('\n');

    try {
      const result = await this.gemini.generateDailySpeakFeedback({
        systemInstruction: FEEDBACK_SYSTEM,
        userPrompt,
      });
      const text = result.feedbackTh?.trim() ?? '';
      if (text) {
        if (text.includes('พรุ่งนี้') || text.toLowerCase().includes('tomorrow')) {
          return localDailySpeakFeedback(diagnosis);
        }
        return text;
      }
    } catch (error) {
      this.logger.warn(
        `Daily speak AI feedback failed: ${String(error).slice(0, 120)}`,
      );
    }

    return localDailySpeakFeedback(diagnosis);
  }
}
