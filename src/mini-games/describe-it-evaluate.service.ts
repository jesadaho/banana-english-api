import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';

export type DescribeItEvalTier =
  | 'perfect'
  | 'also_correct'
  | 'close_enough'
  | 'retry';

const EVAL_SYSTEM = `You grade Thai learners describing one picture in See and Say.
The reference sentence is the one fact that must be true of the picture.

Tiers (pick exactly one):
- perfect: same fact, clear English, close to the reference
- also_correct: same fact with different wording
- close_enough: same fact, but a small slip (article, plural, word order, contraction, or speech-to-text noise)
- retry: a different person, object, place, time, or frequency than the reference

Rules:
- Do not require the whole reference sentence. A shorter line is fine when the fact is still clear.
- a/an/the, singular/plural, and contractions do not make it wrong.
- "seven" and "7", "he's" and "he is", "there's" and "there is" are the same.
- Reject a different target even if the grammar is perfect.
- Other accepted sentences, when given, are also correct facts.

Return JSON only with field "tier".`;

@Injectable()
export class DescribeItEvaluateService {
  private readonly logger = new Logger(DescribeItEvaluateService.name);

  constructor(private readonly gemini: GeminiChatService) {}

  async evaluate(params: {
    transcript: string;
    targetEn: string;
    promptTh?: string;
    acceptedEn?: string;
  }): Promise<DescribeItEvalTier> {
    const transcript = params.transcript.trim();
    const targetEn = params.targetEn.trim();
    if (!transcript || !targetEn) return 'retry';

    const userPrompt = [
      params.promptTh?.trim() ? `Thai prompt: ${params.promptTh.trim()}` : null,
      `Reference sentence: ${targetEn}`,
      params.acceptedEn?.trim()
        ? `Also accepted: ${params.acceptedEn.trim()}`
        : null,
      `Learner said (STT): ${transcript}`,
      'Does the learner state the same picture fact?',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await this.gemini.evaluateSpeakChallengeUtterance({
        systemInstruction: EVAL_SYSTEM,
        userPrompt,
      });
      return result.tier;
    } catch (error) {
      this.logger.warn(
        `See and Say AI evaluate failed: ${String(error).slice(0, 120)}`,
      );
      return 'retry';
    }
  }
}
