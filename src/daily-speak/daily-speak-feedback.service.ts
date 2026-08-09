import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';

const FEEDBACK_SYSTEM = `You are Teacher Banana — a warm English coach for Thai adult beginners on Speak Today.

You MUST ground feedback in the learner's STT transcript vs the target sentence.

Hard rules:
- Reply in Thai (friendly, short). Quote English only for exact words/phrases.
- 1–2 short sentences max. No bullets, scores, or percentages.
- Quote what the learner said (STT) exactly once using “...” .
- Explicitly compare to the target: praise what matched, then name the missing/different part.
- If the learner said only a prefix/part (e.g. “I won't give up” vs full target), tell them what to add next.
- NEVER invent words they did not say.
- NEVER say “พรุ่งนี้”, “เสร็จแล้ววันนี้”, or imply the session is finished when local match tier is retry or close_enough — they may still retry.
- If tier is perfect / also_correct, celebrate briefly and optionally reinforce one phrase from the target.
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
    return `สุดยอด! ที่พูดว่า “${spoken}” ใกล้เคียงเป้าหมายมากแล้ว`;
  }

  const missing = missingTail(spokenNorm, targetNorm, target);
  if (missing) {
    return `เริ่มดีที่พูดว่า “${spoken}” — ลองต่อให้ครบว่า “${missing}”`;
  }

  if (spokenNorm.includes(targetNorm) || targetNorm.includes(spokenNorm)) {
    return `ใกล้แล้วที่พูดว่า “${spoken}” — ลองฟังตัวอย่างแล้วพูดให้ครบตาม “${target}” อีกครั้ง`;
  }

  if (tier === 'closeenough' || tier === 'close_enough') {
    return `สื่อความได้ดีที่พูดว่า “${spoken}” — ลองพูดใกล้ “${target}” อีกนิดจะเนียนขึ้น`;
  }

  return `คุณพูดว่า “${spoken}” ยังไม่ตรง “${target}” — ลองฟังตัวอย่างแล้วพูดตามอีกครั้งนะ`;
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
