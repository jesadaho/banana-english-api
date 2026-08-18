import { Injectable, NotFoundException } from '@nestjs/common';
import type { AiDebug } from '../common/api.types';
import {
  GeminiChatService,
  type TrainingTurnReply,
} from '../gemini/gemini-chat.service';
import { getLesson } from '../lessons/lessons.data';
import { learnerNameFallback, teachingLanguageFromConfig } from '../lessons/lesson-prompt';
import { buildDailyRoutineFallbackTrainingReply } from '../lessons/lessons.data';
import type { ChatTurn } from '../session-store/session-store.service';
import type { TrainingLlmBenchDto } from './dto/training-llm-bench.dto';

export type TrainingLlmBenchStepResult = {
  step: 'opening' | 'turn';
  provider: 'gemini' | 'groq' | 'scripted';
  ok: boolean;
  llmMs: number;
  handlerMs: number;
  model?: string;
  aiDebug?: AiDebug;
  reply?: Pick<
    TrainingTurnReply,
    | 'textEn'
    | 'textTh'
    | 'isLessonComplete'
    | 'expectsUserSpeech'
    | 'expectedSpeech'
  >;
  error?: string;
};

export type TrainingLlmBenchResponse = {
  lessonId: string;
  titleEn: string;
  mode: 'opening' | 'turn' | 'both';
  userSpeech: string;
  productionTrainingProvider: string;
  results: TrainingLlmBenchStepResult[];
  summary: {
    opening?: Record<string, { llmMs: number; handlerMs: number; ok: boolean }>;
    turn?: Record<string, { llmMs: number; handlerMs: number; ok: boolean }>;
  };
};

@Injectable()
export class DebugService {
  constructor(private readonly chat: GeminiChatService) {}

  async benchTrainingLlm(
    dto: TrainingLlmBenchDto,
  ): Promise<TrainingLlmBenchResponse> {
    const lessonId = dto.lessonId?.trim() || 'greetings';
    const config = getLesson(lessonId);
    if (!config) {
      throw new NotFoundException(`Lesson not found: ${lessonId}`);
    }

    const mode = dto.mode ?? 'both';
    const providers = dto.providers?.length
      ? dto.providers
      : (['gemini', 'groq'] as const);
    const lang = teachingLanguageFromConfig(config);
    const learnerFirstName = learnerNameFallback(lang);
    const userSpeech = dto.userSpeech?.trim() || 'Hello';

    const results: TrainingLlmBenchStepResult[] = [];
    let referenceOpening: TrainingTurnReply | null = null;

    if (mode === 'opening' || mode === 'both') {
      const scripted = buildDailyRoutineFallbackTrainingReply(
        lessonId,
        [],
        1,
      );
      if (scripted) {
        results.push({
          step: 'opening',
          provider: 'scripted',
          ok: true,
          llmMs: 0,
          handlerMs: 0,
          aiDebug: {
            source: 'scripted',
            geminiMs: 0,
            geminiAttempts: 0,
          },
          reply: {
            textEn: scripted.textEn,
            textTh: scripted.textTh,
            isLessonComplete: scripted.isLessonComplete,
            expectsUserSpeech: scripted.expectsUserSpeech,
            expectedSpeech: scripted.expectedSpeech ?? undefined,
          },
        });
      }

      const openingResults = await Promise.all(
        providers.map((provider) =>
          this.runOpening(config, learnerFirstName, provider),
        ),
      );
      results.push(...openingResults);

      referenceOpening =
        openingResults.find((r) => r.provider === 'gemini' && r.ok)?.reply ??
        openingResults.find((r) => r.ok)?.reply ??
        null;
    }

    if (mode === 'turn' || mode === 'both') {
      if (!referenceOpening && mode === 'turn') {
        const opening = await this.runOpening(
          config,
          learnerFirstName,
          'gemini',
        );
        results.push(opening);
        referenceOpening = opening.ok ? opening.reply ?? null : null;
      }

      if (!referenceOpening) {
        throw new NotFoundException(
          'Could not build turn history — opening step failed for all providers',
        );
      }

      const history: ChatTurn[] = [
        {
          speaker: 'ai',
          textEn: referenceOpening.textEn,
          textTh: referenceOpening.textTh,
          audioUrl: null,
        },
        {
          speaker: 'user',
          textEn: userSpeech,
          originalTextEn: userSpeech,
          audioUrl: null,
        },
      ];

      const scriptedTurn = buildDailyRoutineFallbackTrainingReply(
        lessonId,
        history,
        1,
      );
      if (scriptedTurn) {
        results.push({
          step: 'turn',
          provider: 'scripted',
          ok: true,
          llmMs: 0,
          handlerMs: 0,
          aiDebug: {
            source: 'scripted',
            geminiMs: 0,
            geminiAttempts: 0,
          },
          reply: this.pickReply(scriptedTurn),
        });
      } else {
        const turnResults = await Promise.all(
          providers.map((provider) =>
            this.runTurn(
              config,
              history,
              userSpeech,
              learnerFirstName,
              provider,
            ),
          ),
        );
        results.push(...turnResults);
      }
    }

    return {
      lessonId,
      titleEn: config.titleEn,
      mode,
      userSpeech,
      productionTrainingProvider:
        process.env.TRAINING_LLM_PROVIDER?.trim() || 'gemini',
      results,
      summary: this.buildSummary(results),
    };
  }

  private async runOpening(
    config: NonNullable<ReturnType<typeof getLesson>>,
    learnerFirstName: string,
    provider: 'gemini' | 'groq',
  ): Promise<TrainingLlmBenchStepResult> {
    const handlerStartedAt = performance.now();
    try {
      const { reply, aiDebug } = await this.chat.generateTrainingOpening(
        config,
        learnerFirstName,
        provider,
      );
      return {
        step: 'opening',
        provider,
        ok: true,
        llmMs: aiDebug.geminiMs,
        handlerMs: Math.round(performance.now() - handlerStartedAt),
        model: aiDebug.model,
        aiDebug,
        reply: this.pickReply(reply),
      };
    } catch (err) {
      return {
        step: 'opening',
        provider,
        ok: false,
        llmMs: 0,
        handlerMs: Math.round(performance.now() - handlerStartedAt),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async runTurn(
    config: NonNullable<ReturnType<typeof getLesson>>,
    history: ChatTurn[],
    userSpeech: string,
    learnerFirstName: string,
    provider: 'gemini' | 'groq',
  ): Promise<TrainingLlmBenchStepResult> {
    const handlerStartedAt = performance.now();
    const nextTurn = 1;
    try {
      const { reply, aiDebug } = await this.chat.generateTrainingTurn(
        config,
        history,
        userSpeech,
        nextTurn,
        learnerFirstName,
        userSpeech,
        provider,
      );
      return {
        step: 'turn',
        provider,
        ok: true,
        llmMs: aiDebug.geminiMs,
        handlerMs: Math.round(performance.now() - handlerStartedAt),
        model: aiDebug.model,
        aiDebug,
        reply: this.pickReply(reply),
      };
    } catch (err) {
      return {
        step: 'turn',
        provider,
        ok: false,
        llmMs: 0,
        handlerMs: Math.round(performance.now() - handlerStartedAt),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private pickReply(reply: TrainingTurnReply) {
    return {
      textEn: reply.textEn,
      textTh: reply.textTh,
      isLessonComplete: reply.isLessonComplete,
      expectsUserSpeech: reply.expectsUserSpeech,
      expectedSpeech: reply.expectedSpeech,
    };
  }

  private buildSummary(
    results: TrainingLlmBenchStepResult[],
  ): TrainingLlmBenchResponse['summary'] {
    const summary: TrainingLlmBenchResponse['summary'] = {};
    for (const step of ['opening', 'turn'] as const) {
      const stepRows = results.filter((r) => r.step === step);
      if (stepRows.length === 0) continue;
      summary[step] = {};
      for (const row of stepRows) {
        summary[step]![row.provider] = {
          llmMs: row.llmMs,
          handlerMs: row.handlerMs,
          ok: row.ok,
        };
      }
    }
    return summary;
  }
}
