import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import { greetingsEmojiChoiceForStep } from '../scripts/greetings.script';
import { greetingsExpectedSpeechForStep } from './lesson-step.resolver';

/** Server-owned UI chrome — strip AI boards and pin script boards per step. */
export function pinGreetingsReplyChrome(
  reply: TrainingTurnReply,
  coreStep: number,
): TrainingTurnReply {
  const pinned = greetingsEmojiChoiceForStep(coreStep);
  const expected = greetingsExpectedSpeechForStep(coreStep);

  return {
    textEn: reply.textEn,
    textTh: reply.textTh,
    isLessonComplete: reply.isLessonComplete,
    expectsUserSpeech: reply.isLessonComplete
      ? false
      : (reply.expectsUserSpeech ?? true),
    expectedSpeech:
      expected ??
      (reply.expectedSpeech?.trim() ? reply.expectedSpeech.trim() : undefined),
    emojiChoice: pinned ?? undefined,
    emojiSpeak: undefined,
    emojiSpeakSet: undefined,
    guidedSpeaking: undefined,
    roleplayIntro: undefined,
    roleplayNpc: undefined,
    scene: undefined,
  };
}
