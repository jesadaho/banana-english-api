import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';

const FEEDBACK_SYSTEM = `You are Teacher Banana speaking out loud to a Thai adult beginner on Speak Today.

Invent a fresh, natural spoken line each time — like a real coach talking, not a template.

Tone example:
ขาดคำว่า “just” อีกนิดเดียวครับ
ลองพูดใหม่ว่า “I won't give up just because it's difficult.” นะ

Hard rules:
- Write 1–2 short spoken sentences in Thai. Use “ครับ”. No bullets, scores, or emoji.
- Be specific to THIS transcript vs THIS target (missing word, wrong phrase, or celebrate).
- Quote English only for key words / the model sentence.
- Do NOT copy the example verbatim unless it truly fits.
- NEVER invent words the learner did not say.
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

/** Deterministic fallback when Gemini is unavailable. */
export function localDailySpeakFeedback(params: {
  transcript: string;
  targetEn: string;
  tier?: string;
  reviewCase?: string;
}): string {
  const spoken = params.transcript.trim();
  const target = params.targetEn.trim().replace(/[.!?]+$/, '');
  if (!spoken || spoken === '…') {
    return 'ยังฟังไม่ค่อยชัดครับ ลองพูดอีกครั้งใกล้ไมค์หน่อยนะ';
  }

  const reviewCase = (params.reviewCase ?? '').trim().toLowerCase();
  const tier = (params.tier ?? '').trim().toLowerCase();
  const spokenNorm = softNorm(spoken);
  const targetNorm = softNorm(target);

  if (
    reviewCase === 'great' ||
    tier === 'perfect' ||
    tier === 'alsocorrect' ||
    tier === 'also_correct'
  ) {
    return `เยี่ยมมากครับ ที่พูดว่า “${spoken}” ได้ชัดเลย ลองฟังอีกครั้งด้านล่างนะ`;
  }

  if (reviewCase === 'rough') {
    return 'ไม่เป็นไรครับ เดี๋ยวลองทีละส่วนตามนี้เลยนะ';
  }

  const missing = missingTail(spokenNorm, targetNorm, target);
  if (missing) {
    const firstMissing = missing.split(/\s+/)[0] ?? missing;
    if (firstMissing && !firstMissing.includes(' ')) {
      return `ขาดคำว่า “${firstMissing}” อีกนิดเดียวครับ ลองพูดใหม่ตามด้านล่างนะ`;
    }
  }

  return `ใกล้แล้วครับ ลองพูดใหม่ตามด้านล่างนะ`;
}

function caseGuidance(reviewCase?: string): string {
  switch ((reviewCase ?? '').trim().toLowerCase()) {
    case 'great':
      return 'Case: GREAT — celebrate briefly, invite them to listen to the model line below.';
    case 'almost':
      return 'Case: ALMOST — name the small gap (e.g. missing word) if clear, then invite them to say the full target (shown as a listen chip below — you may quote it).';
    case 'rough':
      return 'Case: ROUGH — encourage gently; say you will model it part by part (chips below). Do not dump a harsh correction list.';
    case 'unclear':
      return 'Case: UNCLEAR — ask them to speak closer to the mic; do not claim they said wrong words.';
    default:
      return 'Coach helpfully based on transcript vs target.';
  }
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
    reviewCase?: string;
  }): Promise<string> {
    const transcript = params.transcript.trim();
    const targetEn = params.targetEn.trim();
    if (!transcript || !targetEn) {
      return localDailySpeakFeedback({
        transcript,
        targetEn,
        tier: params.tier,
        reviewCase: params.reviewCase,
      });
    }

    const tier = params.tier?.trim();
    const reviewCase = params.reviewCase?.trim();
    const userPrompt = [
      caseGuidance(reviewCase),
      params.promptTh?.trim()
        ? `Thai meaning: ${params.promptTh.trim()}`
        : null,
      `Target sentence: ${targetEn}`,
      `Learner said (STT): ${transcript}`,
      tier ? `Local match tier: ${tier}` : null,
      reviewCase ? `Review case: ${reviewCase}` : null,
      params.tipWord?.trim()
        ? `Optional pronunciation tip: “${params.tipWord.trim()}”${
            params.tipIpa?.trim() ? ` → ${params.tipIpa.trim()}` : ''
          }`
        : null,
      'Invent a short spoken coaching line for the learner now.',
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
        const lower = text.toLowerCase();
        const stillPracticing =
          reviewCase === 'almost' ||
          reviewCase === 'rough' ||
          reviewCase === 'unclear' ||
          tier === 'retry' ||
          tier === 'closeEnough' ||
          tier === 'close_enough';
        if (
          stillPracticing &&
          (text.includes('พรุ่งนี้') || lower.includes('tomorrow'))
        ) {
          return localDailySpeakFeedback({
            transcript,
            targetEn,
            tier,
            reviewCase,
          });
        }
        return text;
      }
    } catch (error) {
      this.logger.warn(
        `Daily speak AI feedback failed: ${String(error).slice(0, 120)}`,
      );
    }

    return localDailySpeakFeedback({
      transcript,
      targetEn,
      tier,
      reviewCase,
    });
  }
}
