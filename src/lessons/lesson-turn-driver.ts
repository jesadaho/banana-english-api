import {
  EMOJI_SPEAK_COMPLETE_SENTINEL,
  TAP_TO_CONTINUE_SENTINEL,
  type EmojiChoicePrompt,
  type EmojiSpeakPrompt,
  type GuidedSpeakingPrompt,
} from '../common/api.types';

export type LessonTurnView = {
  expectsUserSpeech?: boolean;
  expectedSpeech?: string | null;
  isTaskComplete?: boolean;
  guidedSpeaking?: GuidedSpeakingPrompt | null;
  emojiChoice?: EmojiChoicePrompt | null;
  emojiSpeak?: EmojiSpeakPrompt | null;
  emojiSpeakSet?: EmojiSpeakPrompt[] | null;
};

/** What the smoke driver should post for the next API turn (or null when done). */
export function pickUserSpeechForTurn(turn: LessonTurnView): string | null {
  if (turn.isTaskComplete) return null;

  if (turn.expectsUserSpeech === false) {
    if (Array.isArray(turn.emojiSpeakSet) && turn.emojiSpeakSet.length > 0) {
      return EMOJI_SPEAK_COMPLETE_SENTINEL;
    }
    return TAP_TO_CONTINUE_SENTINEL;
  }

  const expected = turn.expectedSpeech?.trim();
  if (expected) return expected;

  const guided = turn.guidedSpeaking;
  if (guided?.speak?.trim()) return guided.speak.trim();
  const guidedOption = guided?.options?.find((o) => o.speak?.trim());
  if (guidedOption?.speak?.trim()) return guidedOption.speak.trim();

  const emojiAnswer = turn.emojiSpeak?.answer?.trim();
  if (emojiAnswer) return emojiAnswer;

  const choice = turn.emojiChoice?.options?.find(
    (o) => o.speak?.trim() || o.label?.trim(),
  );
  if (choice?.speak?.trim()) return choice.speak.trim();
  if (choice?.label?.trim()) return choice.label.trim();

  return "I'm ready";
}

export function toLessonTurnView(block: Record<string, unknown>): LessonTurnView {
  const gs = block.guidedSpeaking as GuidedSpeakingPrompt | null | undefined;
  return {
    expectsUserSpeech: block.expectsUserSpeech as boolean | undefined,
    expectedSpeech: (block.expectedSpeech as string | null | undefined) ?? null,
    isTaskComplete: block.isTaskComplete as boolean | undefined,
    guidedSpeaking: gs ?? null,
    emojiChoice: (block.emojiChoice as EmojiChoicePrompt | null | undefined) ?? null,
    emojiSpeak: (block.emojiSpeak as EmojiSpeakPrompt | null | undefined) ?? null,
    emojiSpeakSet:
      (block.emojiSpeakSet as EmojiSpeakPrompt[] | null | undefined) ?? null,
  };
}
