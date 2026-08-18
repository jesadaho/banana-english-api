import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiDebug } from '../common/api.types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_LIVE_TIMEOUT_MS = 20_000;

type GroqContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

export type GroqGenerateJsonOptions = {
  systemInstruction?: string;
  contents: GroqContent[];
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
  recoverFromPlainText?: (text: string) => unknown | null;
};

export type GroqGenerationResult<T> = {
  value: T;
  aiDebug: AiDebug;
};

@Injectable()
export class GroqChatService {
  private readonly logger = new Logger(GroqChatService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GROQ_API_KEY') ?? '';
    this.model =
      this.config.get<string>('GROQ_CHAT_MODEL') ?? 'openai/gpt-oss-120b';
    this.logger.log(`Groq chat model: ${this.model}`);
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  activeModel(): string {
    return this.model;
  }

  async generateJson<T>(
    options: GroqGenerateJsonOptions,
  ): Promise<GroqGenerationResult<T>> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'GROQ_API_KEY is not configured on the server',
      );
    }

    const maxAttempts = 2;
    let totalMs = 0;
    let attempts = 0;
    let lastError: unknown;
    let lastPreview = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      attempts++;
      const temperature =
        attempt === 0 ? (options.temperature ?? 0.4) : 0.2;
      try {
        const call = await this.callChatCompletions({
          ...options,
          temperature,
        });
        totalMs += call.ms;
        const text = call.text;
        try {
          const parsed = this.parseJsonResponse<T>(text);
          return {
            value: parsed,
            aiDebug: {
              source: 'groq',
              geminiMs: totalMs,
              geminiAttempts: attempts,
              model: this.model,
            },
          };
        } catch (parseError) {
          if (options.recoverFromPlainText) {
            const recovered = options.recoverFromPlainText(text);
            if (recovered != null) {
              this.logger.warn(
                `Recovered plain-text Groq reply into schema (model=${this.model})`,
              );
              return {
                value: recovered as T,
                aiDebug: {
                  source: 'groq',
                  geminiMs: totalMs,
                  geminiAttempts: attempts,
                  model: this.model,
                },
              };
            }
          }
          throw parseError;
        }
      } catch (error) {
        lastError = error;
        if (error instanceof Error) {
          lastPreview = error.message;
        }
        this.logger.warn(
          `Groq JSON attempt ${attempt + 1}/${maxAttempts} failed: ${lastPreview.slice(0, 180)}`,
        );
        if (attempt + 1 >= maxAttempts) break;
      }
    }

    if (lastPreview) {
      throw new Error(
        `Groq returned invalid JSON after retries. Last error: ${lastPreview}`,
      );
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError));
  }

  private async callChatCompletions(
    options: GroqGenerateJsonOptions & { temperature: number },
  ): Promise<{ text: string; ms: number }> {
    const started = performance.now();
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> =
      [];

    const schemaHint = options.schema
      ? `\n\nRespond with ONLY one valid JSON object matching this schema (no markdown):\n${JSON.stringify(options.schema)}`
      : '';

    if (options.systemInstruction) {
      messages.push({
        role: 'system',
        content: options.systemInstruction + schemaHint,
      });
    } else if (schemaHint) {
      messages.push({ role: 'system', content: schemaHint.trim() });
    }

    for (const turn of options.contents) {
      messages.push({
        role: turn.role === 'model' ? 'assistant' : 'user',
        content: turn.parts.map((p) => p.text).join('\n'),
      });
    }

    const body = {
      model: this.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens ?? 1024,
      response_format: { type: 'json_object' as const },
    };

    let response: Response;
    try {
      response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(GROQ_LIVE_TIMEOUT_MS),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new Error(
          `Groq API failed (504): timeout after ${Math.round(GROQ_LIVE_TIMEOUT_MS / 1000)}s model=${this.model}`,
        );
      }
      throw err;
    }

    const ms = performance.now() - started;

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API failed (${response.status}): ${err}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new Error('Groq response missing text');
    }
    return { text, ms };
  }

  private parseJsonResponse<T>(text: string): T {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    }
    const preview = cleaned.slice(0, 200);
    try {
      return JSON.parse(cleaned) as T;
    } catch (error) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1)) as T;
        } catch {
          // fall through
        }
      }
      const detail = error instanceof Error ? error.message : 'parse failed';
      throw new Error(`Groq invalid JSON: ${detail}. Preview: ${preview}`);
    }
  }
}
