import { Injectable } from '@nestjs/common';
import type { AiDebug } from '../../common/api.types';
import type { LessonConfig } from '../../lessons/lessons.data';
import { dailyRoutineBoardForStep } from '../../lessons/lessons.data';
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
import {
  buildDailyRoutineOpening,
  buildDailyRoutineAfterUser,
  pinDailyRoutineAiReply,
  dailyRoutineEffectiveProgress,
} from '../scripts/daily-routine.script';
import { pinGreetingsReplyChrome } from './pin-greetings-chrome';
import type { ScriptTurnResult } from '../scripts/types';

export type TrainingEngineTurnInput = {
  config: LessonConfig;
  turns: ChatTurn[];
  userText: string;
  originalText: string;
  learnerFirstName: string;
  /** Session Core Flow beat — used when AI advanced ahead of replay progress. */
  sessionProgressTurn?: number;
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
      return {
        reply: pinGreetingsReplyChrome(this.toReply(reply), 1),
        aiDebug: scriptedAiDebug(),
      };
    }
    if (config.lessonId === 'ee_about_me_daily_routine') {
      const reply = buildDailyRoutineOpening(learnerFirstName);
      return {
        reply: this.toReply(reply),
        aiDebug: scriptedAiDebug(),
      };
    }
    throw new Error(`Training v2 opening not implemented: ${config.lessonId}`);
  }

  async runTurn(
    input: TrainingEngineTurnInput,
  ): Promise<{ reply: TrainingTurnReply; aiDebug: AiDebug }> {
    if (input.config.lessonId === 'greetings') {
      return this.runGreetingsTurn(input);
    }
    if (input.config.lessonId === 'ee_about_me_daily_routine') {
      return this.runDailyRoutineTurn(input);
    }
    throw new Error(`Training v2 turn not implemented: ${input.config.lessonId}`);
  }

  private async runDailyRoutineTurn(
    input: TrainingEngineTurnInput,
  ): Promise<{ reply: TrainingTurnReply; aiDebug: AiDebug }> {
    const scripted = buildDailyRoutineAfterUser({
      turns: input.turns,
      learnerFirstName: input.learnerFirstName,
      sessionProgressTurn: input.sessionProgressTurn,
    });
    if (!scripted) {
      throw new Error('Daily Routine v2: no scripted reply');
    }

    if (!scripted.deferToAi) {
      return Promise.resolve({
        reply: this.toReply(scripted),
        aiDebug: scriptedAiDebug(),
      });
    }

    const step =
      dailyRoutineEffectiveProgress(
        input.turns.slice(0, -1),
        input.sessionProgressTurn,
      ) + 1;
    const lastAi = [...input.turns].reverse().find((t) => t.speaker === 'ai');
    const board = dailyRoutineBoardForStep(step, input.turns);

    const generated = await this.aiGate.runDailyRoutine({
      lessonTitle: input.config.titleEn,
      coreStep: step,
      coreStepMax: input.config.progressMax ?? 8,
      expectedSpeech:
        (board?.expectedSpeech ??
          lastAi?.expectedSpeech?.trim()) ||
        null,
      poolOptions: board?.options.map((o) => o.speak) ?? [],
      userText: input.userText,
      originalText: input.originalText,
      history: input.turns,
      learnerFirstName: input.learnerFirstName,
      teachingLanguage: teachingLanguageFromConfig(input.config),
      languageMix: input.config.languageMix,
    });

    return {
      reply: pinDailyRoutineAiReply(
        input.turns,
        generated.reply,
        input.sessionProgressTurn,
      ),
      aiDebug: generated.aiDebug,
    };
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
      const replyStep = Math.min(step + 1, 9);
      return {
        reply: pinGreetingsReplyChrome(this.toReply(scripted), replyStep),
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

    return {
      reply: pinGreetingsReplyChrome(generated.reply, step),
      aiDebug: generated.aiDebug,
    };
  }

  private toReply(scripted: ScriptTurnResult): TrainingTurnReply {
    const { deferToAi: _defer, ...reply } = scripted;
    return {
      ...reply,
      expectedSpeech: reply.expectedSpeech || undefined,
    };
  }
}
