import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';

export type ScriptTurnResult = TrainingTurnReply & {
  /** When true the engine should call the AI gate instead of returning this turn. */
  deferToAi?: boolean;
  /** AI gate mode when deferToAi is set. */
  aiMode?: 'softTeach';
};

export interface LessonScript {
  lessonId: string;
  buildOpening(learnerFirstName: string): ScriptTurnResult;
  buildAfterUser(input: {
    turns: Array<{ speaker: string; textEn?: string }>;
    userText: string;
    originalText: string;
    learnerFirstName: string;
    step: number;
    attempt: number;
    matched: boolean;
    matchedPhrase: string | null;
  }): ScriptTurnResult | null;
}
