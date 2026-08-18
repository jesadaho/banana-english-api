import { Injectable } from '@nestjs/common';
import type { AiDebug } from '../../common/api.types';
import type { LessonConfig } from '../../lessons/lessons.data';
import { teachingLanguageFromConfig } from '../../lessons/lesson-prompt';
import type { ChatTurn } from '../../session-store/session-store.service';
import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import { scriptedAiDebug } from '../../common/ai-debug';
import { TrainingAiGate } from './ai-gate';
import {
  resolveGreetingsStep,
  scoreGreetingsUserTurn,
  greetingsExpectedSpeechForStep,
} from './lesson-step.resolver';
import {
  buildGreetingsOpening,
  buildGreetingsAfterUser,
} from '../scripts/greetings.script';
import type { ScriptTurnResult } from '../scripts/types';

export type TrainingEngineTurnInput = {
  config: LessonConfig;
  turns: ChatTurn[];
  userText: string;
  originalText: string;
  learnerFirstName: string;
};

@Injectable()
export class TrainingTurnEngine {
  constructor(private readonly aiGate: TrainingAiGate) {}

  buildOpening(
    config: LessonConfig,
    learnerFirstName: string,
  ): { reply: TrainingTurnReply; aiDebug: AiDebug } {
    if (config.lessonId === 'greetings') {
      const reply = buildGreetingsOpening(learnerFirstName);
      return { reply, aiDebug: scriptedAiDebug() };
    }
    throw new Error(`Training v2 opening not implemented: ${config.lessonId}`);
  }

  async runTurn(
    input: TrainingEngineTurnInput,
  ): Promise<{ reply: TrainingTurnReply; aiDebug: AiDebug }> {
    if (input.config.lessonId === 'greetings') {
      return this.runGreetingsTurn(input);
    }
    throw new Error(`Training v2 turn not implemented: ${input.config.lessonId}`);
  }

  private async runGreetingsTurn(
    input: TrainingEngineTurnInput,
  ): Promise<{ reply: TrainingTurnReply; aiDebug: AiDebug }> {
    const priorTurns = input.turns.slice(0, -1);
    const { step, attempt: priorAttempt } = resolveGreetingsStep(priorTurns);
    const attempt = priorAttempt + 1;
    const score = scoreGreetingsUserTurn(
      step,
      input.userText,
      input.originalText,
    );

    const scripted = buildGreetingsAfterUser({
      step,
      attempt,
      matched: score.matched,
      learnerFirstName: input.learnerFirstName,
    });

    if (scripted && !scripted.deferToAi) {
      return {
        reply: this.toReply(scripted),
        aiDebug: scriptedAiDebug(),
      };
    }

    const lastAi = [...input.turns].reverse().find((t) => t.speaker === 'ai');
    const generated = await this.aiGate.runGreetings({
      lessonTitle: input.config.titleEn,
      coreStep: step,
      coreStepMax: input.config.progressMax ?? 9,
      attempt,
      matched: score.matched,
      expectedSpeech:
        greetingsExpectedSpeechForStep(step) ??
        (lastAi?.expectedSpeech?.trim() || null),
      userText: input.userText,
      originalText: input.originalText,
      history: input.turns,
      learnerFirstName: input.learnerFirstName,
      teachingLanguage: teachingLanguageFromConfig(input.config),
      languageMix: input.config.languageMix,
      mode: scripted?.aiMode ?? 'softTeach',
    });

    return generated;
  }

  private toReply(scripted: ScriptTurnResult): TrainingTurnReply {
    const { deferToAi: _defer, ...reply } = scripted;
    return {
      ...reply,
      expectedSpeech: reply.expectedSpeech || undefined,
    };
  }
}
