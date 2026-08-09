import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';

const FEEDBACK_SYSTEM = `You are Teacher Banana speaking out loud to a Thai adult beginner on Speak Today.

Write natural spoken Thai coaching — like a friendly teacher talking, not a report.

Style example (follow this tone):
ขาดคำว่า “just” อีกนิดเดียวครับ
ลองพูดใหม่ว่า “I won't give up just because it's difficult.” นะ

Hard rules:
- 1–2 short spoken lines. Use “ครับ”. No bullets, scores, or emoji.
- Quote English only for missing words / the full model sentence.
- Be specific: name the missing/wrong bit when possible.
- End by inviting them to say the full target in quotes when helpful.
- NEVER invent words they did not say.
- NEVER say “พรุ่งนี้” or imply they finished for the day.
- Do NOT penalize Thai accent if intelligible.
- Return JSON only: { "feedbackTh": string }.`;

function softNorm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function missingTail(
  spokenNorm: string,
  targetNorm: string,
  targetRaw: string,
): string | null {
  if (
    !spokenNorm ||
    spokenNorm.length >= targetNorm.length ||
    !targetNorm.startsWith(spokenNorm)
  ) {
    return null;
  }
  const remainderNorm = targetNorm.slice(spokenNorm.length).trim();
  if (!remainderNorm) return null;

  const first = remainderNorm.split(' ')[0] ?? '';
  const idx = targetRaw.toLowerCase().indexOf(first);
  if (idx >= 0) {
    return targetRaw.slice(idx).trim().replace(/[.!?]+$/, '');
  }
  return remainderNorm;
}

/** Deterministic fallback that always references transcript vs target. */
export function localDailySpeakFeedback(params: {
  transcript: string;
  targetEn: string;
  tier?: string;
}): string {
  const spoken = params.transcript.trim();
  const target = params.targetEn.trim();
  if (!spoken || spoken === '…') {
    return 'ยังไม่ได้ยินประโยคชัด ๆ — ลองกดค้างไมค์แล้วพูดใหม่อีกครั้งนะ';
  }

  const tier = (params.tier ?? '').trim().toLowerCase();
  const spokenNorm = softNorm(spoken);
  const targetNorm = softNorm(target);

  if (tier === 'perfect' || tier === 'alsocorrect' || tier === 'also_correct') {
    return `เยี่ยมมากครับ ที่พูดว่า “${spoken}” ได้ชัดเลย ลองฟังอีกครั้งนะ “${target}”`;
  }

  const missing = missingTail(spokenNorm, targetNorm, target);
  if (missing) {
    const firstMissing = missing.split(/\s+/)[0] ?? missing;
    if (firstMissing && !firstMissing.includes(' ')) {
      return `ขาดคำว่า “${firstMissing}” อีกนิดเดียวครับ ลองพูดใหม่ว่า “${target}” นะ`;
    }
    return `ใกล้แล้วครับ ลองพูดใหม่ว่า “${target}” นะ`;
  }

  if (spokenNorm.includes(targetNorm) || targetNorm.includes(spokenNorm)) {
    return `ใกล้แล้วครับ ลองพูดใหม่ว่า “${target}” นะ`;
  }

  if (tier === 'closeenough' || tier === 'close_enough') {
    return `ใกล้แล้วครับ ลองพูดใหม่ว่า “${target}” นะ`;
  }

  return `ไม่เป็นไรครับ ลองฟังตัวอย่างแล้วพูดใหม่ว่า “${target}” นะ`;
}

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
      return localDailySpeakFeedback({ transcript, targetEn, tier: params.tier });
    }

    const tier = params.tier?.trim();
    const userPrompt = [
      params.promptTh?.trim()
        ? `Thai meaning: ${params.promptTh.trim()}`
        : null,
      `Target sentence: ${targetEn}`,
      `Learner said (STT): ${transcript}`,
      tier ? `Local match tier: ${tier}` : null,
      params.tipWord?.trim()
        ? `Optional pronunciation tip: “${params.tipWord.trim()}”${
            params.tipIpa?.trim() ? ` → ${params.tipIpa.trim()}` : ''
          }`
        : null,
      'Write feedback that quotes the STT line and compares it to the target.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await this.gemini.generateDailySpeakFeedback({
        systemInstruction: FEEDBACK_SYSTEM,
        userPrompt,
      });
      const text = result.feedbackTh?.trim() ?? '';
      if (text) {
        // Reject finished-for-today style hallucinations when learner still retrying.
        const lower = text.toLowerCase();
        const stillPracticing =
          tier === 'retry' ||
          tier === 'closeEnough' ||
          tier === 'close_enough';
        if (
          stillPracticing &&
          (text.includes('พรุ่งนี้') || lower.includes('tomorrow'))
        ) {
          return localDailySpeakFeedback({ transcript, targetEn, tier });
        }
        return text;
      }
    } catch (error) {
      this.logger.warn(
        `Daily speak AI feedback failed: ${String(error).slice(0, 120)}`,
      );
    }

    return localDailySpeakFeedback({ transcript, targetEn, tier });
  }
}
