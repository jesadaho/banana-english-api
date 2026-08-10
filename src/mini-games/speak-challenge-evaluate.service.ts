import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';

export type SpeakChallengeEvalTier =
  | 'perfect'
  | 'also_correct'
  | 'close_enough'
  | 'retry';

const EVAL_SCHEMA = {
  type: 'object',
  properties: {
    tier: {
      type: 'string',
      enum: ['perfect', 'also_correct', 'close_enough', 'retry'],
    },
  },
  required: ['tier'],
};

const EVAL_SYSTEM = `You grade Thai learners' spoken English for a mini-game called Speak Challenge.
Be generous with communicative success — this is NOT a strict grammar exam.

Tiers (pick exactly one):
- perfect: correct meaning; grammar OK; natural OR very close to the reference line
- also_correct: correct meaning with a valid alternative sentence (e.g. "I'd like a cake" vs "Can I get a cake?")
- close_enough: shortened but understandable ("Cake, please." / "Coffee?" with clear intent)
- retry: wrong meaning OR clearly broken ("I am cake.", "Looking cake." without "for")

Rules:
- Ordering: Can I get/have, I'd like, A X please — all fine if the item matches.
- Articles (a/an/the) and "one" are optional for also_correct / close_enough.
- Minor STT noise is OK if intent is clear.
- Past Simple Q&A (weekend / yesterday stories): accept valid alternatives that answer the question.
  Examples: "I took a photo." / "I took photos." / "I took many photos." — all also_correct for a beach-photo question.
  "Yes!" / "Yeah, I did." ≈ "Yes, I did." · "It was good/great/fun." ≈ "It was great."
- Vacation / past-story scenes (sentence hint with blank): learner must use PAST TENSE (verb form 2).
  Reject present tense: "I go to Japan." → retry. Accept: "I flew to Japan." / "I went to Japan." / "I traveled to Japan." for a Japan-travel scene.
  Different past verbs are OK if meaning fits the scene and key nouns match (Japan, hotel, ramen, beach, etc.).
- Singular/plural and quantifiers (a / some / many) usually do NOT block also_correct if verb + key noun match.
- Only use retry when communication would confuse a listener.

Return JSON only with field "tier".`;

@Injectable()
export class SpeakChallengeEvaluateService {
  private readonly logger = new Logger(SpeakChallengeEvaluateService.name);

  constructor(private readonly gemini: GeminiChatService) {}

  async evaluate(params: {
    transcript: string;
    targetEn: string;
    promptTh?: string;
    promptEn?: string;
  }): Promise<SpeakChallengeEvalTier> {
    const transcript = params.transcript.trim();
    const targetEn = params.targetEn.trim();
    if (!transcript || !targetEn) return 'retry';

    const promptTh = params.promptTh?.trim();
    const promptEn = params.promptEn?.trim();
    const userPrompt = [
      promptEn ? `English question: ${promptEn}` : null,
      promptTh ? `Thai prompt: ${promptTh}` : null,
      `Reference answer: ${targetEn}`,
      `Learner said (STT): ${transcript}`,
      'Grade the learner line.',
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
        `Speak challenge AI evaluate failed: ${String(error).slice(0, 120)}`,
      );
      return 'retry';
    }
  }
}
