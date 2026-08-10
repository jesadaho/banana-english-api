import { Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';

export type StoryBuilderEvalTier =
  | 'perfect'
  | 'also_correct'
  | 'close_enough'
  | 'retry';

const EVAL_SYSTEM = `You grade Thai learners' spoken English for a mini-game called Story Builder.
They see a set of emojis and must say what happened in a past-tense English sentence.

Tiers (pick exactly one):
- perfect: sentence clearly matches the emoji story AND reference; past tense; natural
- also_correct: different wording but still a valid past-tense story that fits ALL emojis shown
- close_enough: past tense, mostly fits emojis, minor grammar issues but meaning clear
- retry: unrelated to emojis OR present tense OR nonsense OR missing the main story

Rules:
- Must use past tense (verb form 2) for also_correct / perfect / close_enough.
  Reject "I have a party" / "I get a gift" → retry.
- Accept synonyms: gift/present, photo/picture, friends/friend, celebrate/party.
- Singular/plural and extra details OK if emoji story still fits.
- Be generous when the learner clearly describes the birthday / party scene shown.

Return JSON only with field "tier".`;

@Injectable()
export class StoryBuilderEvaluateService {
  private readonly logger = new Logger(StoryBuilderEvaluateService.name);

  constructor(private readonly gemini: GeminiChatService) {}

  async evaluate(params: {
    transcript: string;
    emojiSet: string;
    targetEn: string;
  }): Promise<StoryBuilderEvalTier> {
    const transcript = params.transcript.trim();
    const targetEn = params.targetEn.trim();
    const emojiSet = params.emojiSet.trim();
    if (!transcript || !targetEn || !emojiSet) return 'retry';

    const userPrompt = [
      `Emojis: ${emojiSet}`,
      `Reference sentence: ${targetEn}`,
      `Learner said (STT): ${transcript}`,
      'Does the learner sentence relate to the emojis as a past story?',
    ].join('\n');

    try {
      const result = await this.gemini.evaluateSpeakChallengeUtterance({
        systemInstruction: EVAL_SYSTEM,
        userPrompt,
      });
      return result.tier;
    } catch (error) {
      this.logger.warn(
        `Story builder AI evaluate failed: ${String(error).slice(0, 120)}`,
      );
      return 'retry';
    }
  }
}
