import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiModelPool, parseGeminiModels } from './gemini-model-pool';
import { pcmToWav, parseSampleRateFromMimeType } from './pcm-to-wav.util';

type AudioBlock = {
  type?: string;
  data?: string;
  mime_type?: string;
  mimeType?: string;
};

type InteractionResponse = {
  output_audio?: AudioBlock;
  outputAudio?: AudioBlock;
  steps?: Array<{
    type?: string;
    content?: AudioBlock[];
  }>;
};

@Injectable()
export class GeminiTtsService {
  private readonly logger = new Logger(GeminiTtsService.name);
  private readonly apiKey: string;
  private readonly modelPool: GeminiModelPool;
  private readonly voice: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    const primary = this.config.get<string>(
      'GEMINI_TTS_MODEL',
      'gemini-3.1-flash-tts-preview',
    );
    const fallbacks = this.config.get<string>(
      'GEMINI_TTS_FALLBACK_MODELS',
      'gemini-2.5-flash-lite-preview-tts,gemini-2.5-pro-preview-tts',
    );
    const models = parseGeminiModels(
      [primary, fallbacks].filter(Boolean).join(','),
      'gemini-3.1-flash-tts-preview',
    );
    const cooldownHours = Number(
      this.config.get<string>('GEMINI_TTS_MODEL_COOLDOWN_HOURS', '2'),
    );
    const cooldownMs = Math.max(0, cooldownHours) * 60 * 60 * 1000;
    this.modelPool = new GeminiModelPool(models, cooldownMs);
    this.voice = this.config.get<string>('GEMINI_TTS_VOICE', 'Sadachbia');
    this.logger.log(
      `Gemini TTS models: ${models.join(' → ')}` +
        (cooldownMs > 0 ? ` (cooldown ${cooldownHours}h on high demand)` : ''),
    );
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    return this.synthesizeSpeechUnary(text);
  }

  async *synthesizeSpeechStream(text: string): AsyncGenerator<Buffer> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured on the server',
      );
    }

    const models = this.modelPool.activeModels();
    let lastError: Error | null = null;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      try {
        yield* this.streamWithModel(model, trimmed);
        return;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        if (err instanceof HttpException) {
          throw err;
        }

        const hasAnother = i < models.length - 1;
        if (!hasAnother || !this.isRetryableModelError(err)) {
          throw err;
        }

        const until = this.modelPool.markUnavailable(model);
        const nextModel = models[i + 1];
        const cooldownNote =
          until != null ? ` for ${this.modelPool.cooldownHours()}h` : '';
        this.logger.warn(
          `Gemini TTS model ${model} unavailable (${err.message.slice(0, 120)})` +
            `${cooldownNote}; trying ${nextModel}`,
        );
      }
    }

    throw lastError ?? new Error('Gemini TTS stream failed');
  }

  private async *streamWithModel(
    model: string,
    trimmed: string,
  ): AsyncGenerator<Buffer> {
    // Only 3.1 TTS supports Interactions streaming; everything else uses
    // generateContent (or Interactions unary via unaryWithModel routing).
    if (!this.supportsInteractionsStreaming(model)) {
      yield await this.unaryWithModel(model, trimmed);
      return;
    }

    const body = {
      model,
      input: `Speak warmly and naturally as Teacher B, a friendly English teacher for Thai learners:\n\n${trimmed}`,
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: this.voice }],
      },
      stream: true,
    };

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
          'Api-Revision': '2026-05-20',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 429) {
        throw new HttpException(
          'Gemini TTS quota exhausted. Use the same GEMINI_API_KEY as AI Studio or enable billing.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      // Fall through to generateContent for this model.
      this.logger.warn(
        `Interactions stream failed for ${model} (${response.status}); trying generateContent`,
      );
      yield await this.generateContentTts(model, trimmed);
      return;
    }

    if (!response.body) {
      throw new Error('Gemini TTS stream missing response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let leftover = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      leftover += decoder.decode(value, { stream: true });
      const lines = leftover.split('\n');
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        const chunk = this.parseStreamLine(line);
        if (chunk.length > 0) {
          yield pcmToWav(chunk);
        }
      }
    }

    if (leftover.trim()) {
      const chunk = this.parseStreamLine(leftover);
      if (chunk.length > 0) {
        yield pcmToWav(chunk);
      }
    }
  }

  private parseStreamLine(line: string): Buffer {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[DONE]') {
      return Buffer.alloc(0);
    }

    const jsonText = trimmed.startsWith('data:')
      ? trimmed.slice(5).trim()
      : trimmed;
    if (!jsonText || jsonText === '[DONE]') {
      return Buffer.alloc(0);
    }

    try {
      const event = JSON.parse(jsonText) as Record<string, unknown>;
      return this.extractStreamAudioDelta(event);
    } catch {
      return Buffer.alloc(0);
    }
  }

  private extractStreamAudioDelta(event: Record<string, unknown>): Buffer {
    if (event.event_type !== 'step.delta') {
      return Buffer.alloc(0);
    }

    const delta = event.delta as Record<string, unknown> | undefined;
    if (delta?.type !== 'audio' || typeof delta.data !== 'string') {
      return Buffer.alloc(0);
    }

    return Buffer.from(delta.data, 'base64');
  }

  private async synthesizeSpeechUnary(text: string): Promise<Buffer> {
    const trimmed = text.trim();
    if (!trimmed) {
      return Buffer.alloc(0);
    }

    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured on the server',
      );
    }

    const models = this.modelPool.activeModels();
    let lastError: Error | null = null;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      try {
        return await this.unaryWithModel(model, trimmed);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        if (err instanceof HttpException) {
          throw err;
        }

        const hasAnother = i < models.length - 1;
        if (!hasAnother || !this.isRetryableModelError(err)) {
          throw err;
        }

        const until = this.modelPool.markUnavailable(model);
        const nextModel = models[i + 1];
        const cooldownNote =
          until != null ? ` for ${this.modelPool.cooldownHours()}h` : '';
        this.logger.warn(
          `Gemini TTS model ${model} unavailable (${err.message.slice(0, 120)})` +
            `${cooldownNote}; trying ${nextModel}`,
        );
      }
    }

    throw lastError ?? new Error('Gemini TTS failed');
  }

  private async unaryWithModel(
    model: string,
    trimmed: string,
  ): Promise<Buffer> {
    if (this.supportsInteractionsStreaming(model)) {
      try {
        return await this.interactionsUnary(model, trimmed);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err instanceof HttpException) throw err;
        if (!this.isRetryableModelError(err)) throw err;
        this.logger.warn(
          `Interactions unary failed for ${model}; trying generateContent: ${err.message.slice(0, 120)}`,
        );
      }
    }

    return this.generateContentTts(model, trimmed);
  }

  private async interactionsUnary(
    model: string,
    trimmed: string,
  ): Promise<Buffer> {
    const body = {
      model,
      input: `Speak warmly and naturally as Teacher B, a friendly English teacher for Thai learners:\n\n${trimmed}`,
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: this.voice }],
      },
    };

    const maxAttempts = 3;
    let lastError = 'Unknown Gemini TTS error';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/interactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
            'Api-Revision': '2026-05-20',
          },
          body: JSON.stringify(body),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as InteractionResponse;
        return this.toPlayableAudio(this.extractAudioBlock(data));
      }

      lastError = await response.text();

      if (response.status === 429) {
        throw new HttpException(
          'Gemini TTS quota exhausted. Use the same GEMINI_API_KEY as AI Studio or enable billing.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const retryable = response.status === 404 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        throw new Error(
          `Gemini TTS failed (${response.status}): ${lastError}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }

    throw new Error(`Gemini TTS failed: ${lastError}`);
  }

  /** generateContent AUDIO path — works for 2.5 / lite without Interactions. */
  private async generateContentTts(
    model: string,
    trimmed: string,
  ): Promise<Buffer> {
    const body = {
      contents: [
        {
          parts: [
            {
              text: `Speak warmly and naturally as Teacher B, a friendly English teacher for Thai learners:\n\n${trimmed}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.voice,
            },
          },
        },
      },
    };

    const maxAttempts = 3;
    let lastError = 'Unknown Gemini generateContent TTS error';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                inlineData?: { data?: string; mimeType?: string };
                inline_data?: { data?: string; mime_type?: string };
              }>;
            };
          }>;
        };

        const part = data.candidates?.[0]?.content?.parts?.find(
          (p) => p.inlineData?.data || p.inline_data?.data,
        );
        const inline = part?.inlineData ?? part?.inline_data;
        if (!inline?.data) {
          throw new Error('Gemini generateContent TTS response missing audio');
        }

        return this.toPlayableAudio({
          data: inline.data,
          mimeType: inline.mimeType ?? (inline as { mime_type?: string }).mime_type,
        });
      }

      lastError = await response.text();

      if (response.status === 429) {
        throw new HttpException(
          'Gemini TTS quota exhausted. Use the same GEMINI_API_KEY as AI Studio or enable billing.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const retryable = response.status === 404 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        throw new Error(
          `Gemini TTS failed (${response.status}): ${lastError}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }

    throw new Error(`Gemini TTS failed: ${lastError}`);
  }

  private supportsInteractionsStreaming(model: string): boolean {
    const lower = model.toLowerCase();
    return lower.includes('3.1') && lower.includes('tts');
  }

  private isRetryableModelError(error: Error): boolean {
    const message = error.message;
    return (
      /\bGemini TTS failed \((404|503|429|500|502|504)\):/.test(message) ||
      message.includes('"status": "UNAVAILABLE"') ||
      message.includes('"status": "NOT_FOUND"') ||
      message.includes('high demand') ||
      message.includes('RESOURCE_EXHAUSTED')
    );
  }

  private extractAudioBlock(data: InteractionResponse): AudioBlock {
    const convenience = data.output_audio ?? data.outputAudio;
    if (convenience?.data) {
      return convenience;
    }

    for (const step of data.steps ?? []) {
      if (step.type !== 'model_output') continue;
      for (const block of step.content ?? []) {
        if (block.type === 'audio' && block.data) {
          return block;
        }
      }
    }

    throw new Error('Gemini TTS response missing audio data');
  }

  private toPlayableAudio(block: AudioBlock): Buffer {
    const mimeType = block.mime_type ?? block.mimeType;
    const raw = Buffer.from(block.data ?? '', 'base64');

    if (mimeType?.includes('wav') || mimeType?.includes('mpeg')) {
      return raw;
    }

    const sampleRate = parseSampleRateFromMimeType(mimeType);
    return pcmToWav(raw, sampleRate);
  }
}
