import { Injectable } from '@nestjs/common';
import type { AiDebug } from '../../common/api.types';
import type { LessonConfig } from '../../lessons/lessons.data';
import { teachingLanguageFromConfig } from '../../lessons/lesson-prompt';
import type { ChatTurn } from '../../session-store/session-store.service';
import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import { scriptedAiDebug } from '../../common/ai-debug';
import { TrainingAiGate } from './ai-gate';
import type { ScriptTurnResult } from '../scripts/types';
import {
  buildChoiceLessonAfterUser,
  choiceLessonEffectiveProgress,
  pinChoiceLessonAiReply,
  type ChoiceLessonDef,
} from '../scripts/choice-lesson.script';
import {
  getAboutMeChoiceLesson,
  isAboutMeChoiceLesson,
} from '../scripts/about-me.registry';
import {
  getFoundationChoiceLesson,
  isFoundationChoiceLesson,
} from '../scripts/foundation.registry';

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
    const foundation = getFoundationChoiceLesson(config.lessonId);
    if (foundation) {
      const reply = foundation.buildOpening(learnerFirstName);
      return {
        reply: this.toReply(reply),
        aiDebug: scriptedAiDebug(),
      };
    }

    const choice = getAboutMeChoiceLesson(config.lessonId);
    if (choice) {
      const reply = choice.buildOpening(learnerFirstName);
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
    const foundation = getFoundationChoiceLesson(input.config.lessonId);
    if (foundation) {
      return this.runChoiceLessonTurn(input, foundation);
    }

    const choice = getAboutMeChoiceLesson(input.config.lessonId);
    if (choice) {
      return this.runChoiceLessonTurn(input, choice);
    }

    throw new Error(`Training v2 turn not implemented: ${input.config.lessonId}`);
  }

  private async runChoiceLessonTurn(
    input: TrainingEngineTurnInput,
    def: ChoiceLessonDef,
  ): Promise<{ reply: TrainingTurnReply; aiDebug: AiDebug }> {
    const scripted = buildChoiceLessonAfterUser(def, {
      turns: input.turns,
      learnerFirstName: input.learnerFirstName,
      sessionProgressTurn: input.sessionProgressTurn,
    });
    if (!scripted) {
      throw new Error(`PoolGate v2: no scripted reply (${def.lessonId})`);
    }

    if (!scripted.deferToAi) {
      return Promise.resolve({
        reply: this.toReply(scripted),
        aiDebug: scriptedAiDebug(),
      });
    }

    const step =
      choiceLessonEffectiveProgress(
        def,
        input.turns.slice(0, -1),
        input.sessionProgressTurn,
      ) + 1;
    const lastAi = [...input.turns].reverse().find((t) => t.speaker === 'ai');
    const board = def.boardForStep(step, input.turns);
    const tutorQuestion =
      lastAi?.textEn?.trim() || board?.textEn?.trim() || null;
    const exampleAnswer =
      board?.expectedSpeech?.trim() || lastAi?.expectedSpeech?.trim() || null;

    const generated = await this.aiGate.runChoiceLessonAssess({
      lessonTitle: input.config.titleEn,
      coreStep: step,
      coreStepMax: input.config.progressMax ?? def.maxStep + 1,
      expectedSpeech: exampleAnswer,
      tutorQuestion,
      exampleAnswer,
      incorrectHintTh: board?.incorrectHintTh ?? null,
      userText: input.userText,
      originalText: input.originalText,
      history: input.turns,
      learnerFirstName: input.learnerFirstName,
      teachingLanguage: teachingLanguageFromConfig(input.config),
      languageMix: input.config.languageMix,
    });

    return {
      reply: pinChoiceLessonAiReply(
        def,
        input.turns,
        generated.reply,
        input.sessionProgressTurn,
        input.learnerFirstName,
      ),
      aiDebug: generated.aiDebug,
    };
  }

  private toReply(scripted: ScriptTurnResult): TrainingTurnReply {
    const { deferToAi: _defer, aiMode: _mode, ...reply } = scripted;
    return {
      ...reply,
      expectedSpeech: reply.expectedSpeech || undefined,
    };
  }
}

export { isAboutMeChoiceLesson, isFoundationChoiceLesson };
