import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';
import {
  saidExplainItTargetWord,
} from '../explain-it/explain-it.data';

export type ExplainItEvalResult = {
  clarity: number;
  usefulClues: number;
  communication: number;
  total: number;
  saidTargetWord: boolean;
  /** Debug: how this score was produced. */
  source:
    | 'gemini'
    | 'target_word'
    | 'empty'
    | 'gemini_fallback';
};

const EVAL_SCHEMA = {
  type: 'object',
  properties: {
    clarity: { type: 'integer', minimum: 0, maximum: 50 },
    usefulClues: { type: 'integer', minimum: 0, maximum: 30 },
    communication: { type: 'integer', minimum: 0, maximum: 20 },
  },
  required: ['clarity', 'usefulClues', 'communication'],
};

const EVAL_SYSTEM = `You grade Thai learners' spoken English for a mini-game called Explain It.
The learner sees an emoji and must DESCRIBE the object in English WITHOUT saying the target word.
Grade how well a listener could guess the target from the description alone.

Scoring rubric (return integers only):
- clarity (0–50): Could someone identify the target from this description without knowing it in advance?
- usefulClues (0–30): Does it give helpful distinguishing clues — function, shape, material, where used, distinctive traits?
- communication (0–20): Is the English easy to understand? Do NOT penalize minor grammar mistakes if meaning is clear.

Calibration examples for target "Spoon":
- "It is in the kitchen." → clarity ~15, usefulClues ~10, communication ~18
- "You use it to eat soup." → clarity ~40, usefulClues ~20, communication ~19
- "It's a small tool with a handle. You use it to eat soup or cereal. It's usually made of metal." → clarity ~49, usefulClues ~29, communication ~20

Rules:
- Be generous on communication — focus on whether a listener would understand.
- Vague location-only clues ("in the kitchen") score low on clarity and usefulClues.
- Strong functional + physical clues score high.
- Minor STT noise is OK if intent is clear.
- Do NOT apply the "said target word" rule — the server handles that separately.

Return JSON only with fields clarity, usefulClues, communication.`;

@Injectable()
export class ExplainItEvaluateService {
  private readonly logger = new Logger(ExplainItEvaluateService.name);

  constructor(private readonly gemini: GeminiChatService) {}

  async evaluate(params: {
    transcript: string;
    targetEn: string;
    emoji: string;
    exampleDescriptionEn: string;
  }): Promise<ExplainItEvalResult> {
    const transcript = params.transcript.trim();
    const targetEn = params.targetEn.trim();
    if (!transcript || !targetEn) {
      return { ...this.zeroScore(true), source: 'empty' };
    }

    if (saidExplainItTargetWord(transcript, targetEn)) {
      return { ...this.zeroScore(true), source: 'target_word' };
    }

    const userPrompt = [
      `Target (SECRET — learner must NOT say this word): ${targetEn}`,
      `Emoji shown: ${params.emoji}`,
      `Reference description (quality anchor, not required verbatim): ${params.exampleDescriptionEn}`,
      `Learner said (STT): ${transcript}`,
      'Score the learner description using the rubric.',
    ].join('\n');

    try {
      const result = await this.gemini.evaluateExplainItUtterance({
        systemInstruction: EVAL_SYSTEM,
        userPrompt,
      });
      const clarity = clamp(result.clarity, 0, 50);
      const usefulClues = clamp(result.usefulClues, 0, 30);
      const communication = clamp(result.communication, 0, 20);
      return {
        clarity,
        usefulClues,
        communication,
        total: clarity + usefulClues + communication,
        saidTargetWord: false,
        source: 'gemini',
      };
    } catch (error) {
      this.logger.warn(
        `Explain It AI evaluate failed: ${String(error).slice(0, 120)}`,
      );
      return {
        clarity: 0,
        usefulClues: 0,
        communication: 10,
        total: 10,
        saidTargetWord: false,
        source: 'gemini_fallback',
      };
    }
  }

  private zeroScore(
    saidTargetWord: boolean,
    source: ExplainItEvalResult['source'] = 'empty',
  ): ExplainItEvalResult {
    return {
      clarity: 0,
      usefulClues: 0,
      communication: 0,
      total: 0,
      saidTargetWord,
      source,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
