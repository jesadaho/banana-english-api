import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';

const FEEDBACK_SYSTEM = `You are Teacher Banana — a warm, encouraging English coach for Thai adult beginners.
Give brief coaching feedback after a Daily Speak (Speak Today) practice.

Rules:
- Reply in Thai (natural, friendly, short). Use English only for quoted words/phrases.
- 1–2 short sentences max. No bullet lists. No scores or percentages.
- Be encouraging first. If the learner was close, praise the attempt then give one clear tip.
- If they matched well, celebrate briefly and optionally reinforce one useful phrase.
- Focus on meaning and naturalness for THIS target sentence — not a full grammar lecture.
- Do not invent that they said something they didn't (use the STT transcript as-is).
- Return JSON only with field "feedbackTh".`;

@Injectable()
export class DailySpeakFeedbackService {
  private readonly logger = new Logger(DailySpeakFeedbackService.name);

  constructor(private readonly gemini: GeminiChatService) {}

  async generate(params: {
    transcript: string;
    targetEn: string;
    promptTh?: string;
    tipWord?: string;
    tipIpa?: string;
    tier?: string;
  }): Promise<string> {
    const transcript = params.transcript.trim();
    const targetEn = params.targetEn.trim();
    if (!transcript || !targetEn) {
      return 'เก่งมากที่กล้าพูดวันนี้ — ลองฟังตัวอย่างแล้วพูดตามอีกครั้งนะ';
    }

    const userPrompt = [
      params.promptTh?.trim()
        ? `Thai meaning: ${params.promptTh.trim()}`
        : null,
      `Target sentence: ${targetEn}`,
      `Learner said (STT): ${transcript}`,
      params.tier?.trim() ? `Local match tier: ${params.tier.trim()}` : null,
      params.tipWord?.trim()
        ? `Pronunciation tip word: “${params.tipWord.trim()}”${
            params.tipIpa?.trim() ? ` → ${params.tipIpa.trim()}` : ''
          }`
        : null,
      'Write short coaching feedback for the learner.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await this.gemini.generateDailySpeakFeedback({
        systemInstruction: FEEDBACK_SYSTEM,
        userPrompt,
      });
      const text = result.feedbackTh?.trim() ?? '';
      if (text) return text;
    } catch (error) {
      this.logger.warn(
        `Daily speak AI feedback failed: ${String(error).slice(0, 120)}`,
      );
    }

    return 'เก่งมากที่ฝึกพูดวันนี้ — พรุ่งนี้ลองอีกประโยคเลยนะ';
  }
}
