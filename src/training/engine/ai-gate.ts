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
  3: 'Recognition: friend scenario — correct answer is "Hi".',
  4: 'Target phrase: "Good morning".',
  5: 'Target phrase: "Good afternoon".',
  6: 'Target phrase: "Good evening".',
  7: 'Recognition: 7am scenario — correct answer is "Good morning".',
  8: 'Free recall — accept any taught greeting phrase.',
  9: 'Summary + celebrate → isLessonComplete=true.',
};

const SOFT_TEACH_RULES =
  'SOFT-TEACH (wrong attempt 1): Briefly acknowledge in Thai (ใกล้แล้ว/เกือบได้). ' +
  'Model the EXACT English target phrase in quotes. Ask learner to repeat (ลองพูดตาม / พูดตาม). ' +
  'textEn MUST be Thai-primary — match scripted tutor tone. Never English-only textEn. ' +
  'Stay on the SAME core step — do NOT advance. expectsUserSpeech=true. ' +
  'Set expectedSpeech to the exact target phrase. ' +
  'Do NOT return emojiChoice — server pins the board.';

const VALIDATE_RULES =
  'VALIDATE (acceptable alternate phrasing): Brief Thai praise (ถูกต้อง/ได้เลย). ' +
  'Accept their wording as OK — do NOT re-teach. Advance to the next teaching step. ' +
  'textEn MUST be Thai-primary. expectsUserSpeech=true on the next ask. ' +
  'Do NOT return emojiChoice or guidedSpeaking — server pins boards.';

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
  teachingLanguage?: 'thai' | 'english';
  languageMix?: { thai: number; english: number };
  mode?: 'softTeach' | 'validate';
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
        : input.mode === 'validate'
          ? `${baseHint}\n${VALIDATE_RULES}`
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
      teachingLanguage: input.teachingLanguage,
      languageMix: input.languageMix,
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
