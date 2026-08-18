import { Injectable } from '@nestjs/common';
import {
  GeminiChatService,
  type TrainingTurnReply,
} from '../../gemini/gemini-chat.service';
import type { AiDebug } from '../../common/api.types';
import type { ChatTurn } from '../../session-store/session-store.service';
import {
  GREETINGS_STEP3_EXPECTED,
  GREETINGS_STEP7_EXPECTED,
  greetingsExpectedSpeechForStep,
} from './lesson-step.resolver';

const GREETINGS_STEP_HINTS: Record<number, string> = {
  1: 'Target phrase: "Hello".',
  2: 'Target phrase: "Hi".',
  3:
    'Recognition: friend scenario — correct answer is "Hi". Keep emojiChoice Hello/Hi board.',
  4: 'Target phrase: "Good morning".',
  5: 'Target phrase: "Good afternoon".',
  6: 'Target phrase: "Good evening".',
  7:
    'Recognition: 7am scenario — correct answer is "Good morning". Keep time-of-day emojiChoice board.',
  8: 'Free recall — accept any taught greeting phrase.',
  9: 'Summary + celebrate → isLessonComplete=true.',
};

const SOFT_TEACH_RULES =
  'SOFT-TEACH (wrong attempt 1): Briefly acknowledge the mistake in a friendly way. ' +
  'Model the EXACT correct target phrase clearly. Ask the learner to repeat it (พูดตาม). ' +
  'Stay on the SAME core step — do NOT advance. expectsUserSpeech=true. ' +
  'Set expectedSpeech to the exact target phrase. ' +
  'On recognition steps 3 and 7, keep the required emojiChoice board.';

export type AiGateInput = {
  lessonTitle: string;
  coreStep: number;
  coreStepMax: number;
  attempt: number;
  matched: boolean;
  expectedSpeech: string | null;
  userText: string;
  originalText: string;
  history: ChatTurn[];
  learnerFirstName: string;
  mode?: 'softTeach';
};

@Injectable()
export class TrainingAiGate {
  constructor(private readonly chat: GeminiChatService) {}

  async runGreetings(input: AiGateInput): Promise<{
    reply: TrainingTurnReply;
    aiDebug: AiDebug;
  }> {
    const historyLines = this.compactHistory(input.history, 4);
    const expected =
      input.expectedSpeech ??
      greetingsExpectedSpeechForStep(input.coreStep) ??
      (input.coreStep === 3
        ? GREETINGS_STEP3_EXPECTED
        : input.coreStep === 7
          ? GREETINGS_STEP7_EXPECTED
          : null);

    const baseHint = GREETINGS_STEP_HINTS[input.coreStep] ?? '';
    const stepHint =
      input.mode === 'softTeach'
        ? `${baseHint}\n${SOFT_TEACH_RULES}`
        : baseHint;

    const userPayload = [
      `mode=${input.mode ?? 'default'}`,
      `step=${input.coreStep}`,
      `attempt=${input.attempt}`,
      `match=${input.matched ? 'yes' : 'wrong'}`,
      expected ? `expected=${expected}` : 'expected=any_greeting',
      `transcript="${input.originalText.replace(/"/g, '\\"')}"`,
    ].join(' ');

    return this.chat.generateTrainingV2Turn({
      lessonTitle: input.lessonTitle,
      coreStep: input.coreStep,
      coreStepMax: input.coreStepMax,
      stepHint,
      userPayload,
      historyLines,
      learnerFirstName: input.learnerFirstName,
    });
  }

  private compactHistory(history: ChatTurn[], maxTurns: number): string[] {
    const lines: string[] = [];
    for (const turn of history.slice(-maxTurns * 2)) {
      const text = turn.textEn?.trim();
      if (!text) continue;
      lines.push(
        turn.speaker === 'ai' ? `Tutor: ${text}` : `Learner: ${text}`,
      );
    }
    return lines.slice(-maxTurns * 2);
  }
}
