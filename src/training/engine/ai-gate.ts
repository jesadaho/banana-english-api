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

/** Exported for tests — PoolGate out-of-pool classification rubric. */
export const ASSESS_CLASSIFICATION_RUBRIC =
  'You are evaluating a beginner English learner\'s spoken response.\n' +
  'Classify the learner\'s response into exactly one of: correct | close | incorrect.\n' +
  'Judge primarily against the TUTOR QUESTION above — not exact string matching.\n' +
  'Do NOT require matching board cards or any fixed phrase list.\n\n' +
  'CORRECT — The response successfully communicates the intended meaning and satisfies the task.\n' +
  'Minor pronunciation, transcription, punctuation, capitalization, filler words, or harmless ' +
  'grammatical variations should still be correct.\n' +
  'Natural alternative expressions are also correct even if they do not exactly match the example.\n' +
  'Examples:\n' +
  'Expected: "I live in Bangkok." → Learner: "I live in Bangkok." → correct\n' +
  'Expected: "My name is Nana." → Learner: "I\'m Nana." → correct (natural alternative)\n' +
  'Expected: "I live in Bangkok." → Learner: "I currently live in Bangkok." → correct\n' +
  'Task asks where the learner lives and Chiang Mai is a valid lesson choice → ' +
  '"I live in Chiang Mai." → correct\n\n' +
  'CLOSE — The learner clearly understands the task and their intended meaning is recognizable, ' +
  'but there is a meaningful English error worth correcting. The listener can understand what ' +
  'they mean, but the sentence should be recast.\n' +
  'Examples:\n' +
  'Expected pattern: "I live in..." → Learner: "I live Bangkok." → close\n' +
  'Expected: "I\'m from Thailand." → Learner: "I from Thailand." → close\n' +
  'Expected: "Nice to meet you." → Learner: "Nice meet you." → close\n' +
  'Expected: "My name is Nana." → Learner: "My name Nana." → close\n' +
  'Expected pattern: "I work as a..." → Learner: "I work teacher." → close\n\n' +
  'INCORRECT — The response does not answer the task, expresses a substantially different meaning, ' +
  'or is too incomplete/unclear to confidently infer the intended response.\n' +
  'Examples:\n' +
  'Question/task: Tell me where you live. → Learner: "I like pizza." → incorrect\n' +
  'Expected: "Nice to meet you too." → Learner: "Goodbye." → incorrect\n' +
  'Task: say your name → Learner: "Good morning." → incorrect\n\n' +
  'Important rules:\n' +
  '1. Evaluate meaning and communicative success, not exact string matching.\n' +
  '2. Do not mark a response close only because it differs from the expected phrase.\n' +
  '3. A grammatically correct personal answer is correct even if its content differs from the example.\n' +
  '4. Use close only when there is a specific English error worth teaching.\n' +
  '5. If the response is understandable and natural English, prefer correct.\n' +
  '6. Do not judge pronunciation quality from transcript text.\n' +
  '7. Proper names may be transcribed imperfectly by speech recognition. ' +
  'Do not mark an answer close solely because a person\'s name differs slightly from the expected name.';

const ASSESS_OUTPUT_RULES =
  'OUTPUT (assess mode):\n' +
  'REQUIRED assessmentTier = correct | close | incorrect.\n' +
  '- correct or close: brief Thai praise in textEn. For close, model the correct phrase briefly (พูดว่า …) — server rebuilds full recast+advance copy. Do NOT ask พูดตาม or repeat. Server advances.\n' +
  '- incorrect: brief Thai explain + one model phrase + ask พูดตาม once. Stay on SAME step.\n' +
  'textEn MUST be Thai-primary. NEVER return guidedSpeaking or emojiChoice — server pins boards.';

const ASSESS_RULES = `${ASSESS_CLASSIFICATION_RUBRIC}\n\n${ASSESS_OUTPUT_RULES}`;

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
  mode?: 'softTeach' | 'validate' | 'assess';
};

export type ChoiceLessonAiGateInput = Omit<AiGateInput, 'attempt' | 'matched' | 'mode'> & {
  /** The tutor line the learner is answering (primary assess context). */
  tutorQuestion: string | null;
  /** Example answer for incorrect-tier modeling only — NOT required for acceptance. */
  exampleAnswer?: string | null;
  /** Board-authored Thai guide for incorrect-tier feedback. */
  incorrectHintTh?: string | null;
};

/** @deprecated Use ChoiceLessonAiGateInput */
export type DailyRoutineAiGateInput = ChoiceLessonAiGateInput;

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

  async runChoiceLessonAssess(input: ChoiceLessonAiGateInput): Promise<{
    reply: TrainingTurnReply;
    aiDebug: AiDebug;
  }> {
    const historyLines = this.compactHistory(input.history, 4);
    const question =
      input.tutorQuestion?.trim() ||
      input.exampleAnswer ||
      input.expectedSpeech ||
      '';
    const example =
      input.exampleAnswer?.trim() ||
      input.expectedSpeech?.trim() ||
      null;

    const stepHint = [
      `${input.lessonTitle} step ${input.coreStep}.`,
      question ? `TUTOR QUESTION (judge the learner against THIS):\n"${question}"` : '',
      example
        ? `Example OK answer (for incorrect-tier modeling only — NOT required): "${example}".`
        : '',
      input.incorrectHintTh?.trim()
        ? `Incorrect-tier feedback guide (when tier=incorrect, use as textEn base; keep Thai-primary tone):\n"${input.incorrectHintTh.trim()}"`
        : '',
      ASSESS_RULES,
    ]
      .filter(Boolean)
      .join('\n');

    const userPayload = [
      'mode=assess',
      `step=${input.coreStep}`,
      question
        ? `question="${question.replace(/"/g, '\\"')}"`
        : 'question=unknown',
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
      assessMode: true,
    });
  }

  /** @deprecated Use runChoiceLessonAssess */
  async runDailyRoutine(input: ChoiceLessonAiGateInput): Promise<{
    reply: TrainingTurnReply;
    aiDebug: AiDebug;
  }> {
    return this.runChoiceLessonAssess(input);
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
