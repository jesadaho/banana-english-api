import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BROTHER_BANANA_PERSONA,
  conversationSystemPrompt,
  HINTS_PROMPT,
  openingUserPrompt,
  REPORT_PROMPT,
  THAI_MIX_PROMPT,
} from '../topics/topics.data';
import {
  INTRO_REPORT_PROMPT,
  INTRO_TOPIC_CONTEXT,
  introReplyInstruction,
} from '../topics/intro_script';
import { ChatTurn } from '../session-store/session-store.service';
import {
  GptIntroReport,
  GptReply,
  GptReport,
  HintOption,
  HintsResponse,
} from '../common/api.types';

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    textEn: { type: 'string' },
    textTh: { type: 'string' },
  },
  required: ['textEn', 'textTh'],
};

const HINTS_SCHEMA = {
  type: 'object',
  properties: {
    hints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          sentenceEn: { type: 'string' },
        },
        required: ['id', 'label', 'sentenceEn'],
      },
    },
  },
  required: ['hints'],
};

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    feedbackEn: { type: 'string' },
    feedbackTh: { type: 'string' },
    grammarTip: { type: 'string' },
    vocab: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          meaningTh: { type: 'string' },
          exampleEn: { type: 'string' },
        },
        required: ['word', 'meaningTh', 'exampleEn'],
      },
    },
  },
  required: ['feedbackEn', 'feedbackTh', 'grammarTip', 'vocab'],
};

const INTRO_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    userName: { type: 'string', description: 'Learner first name in Thai or English' },
    levelTitle: { type: 'string', description: 'Short English level title, e.g. Ready to Fly' },
    levelEmoji: { type: 'string', description: 'Single emoji matching the level' },
    summaryTh: { type: 'string', description: '1-2 warm Thai encouragement sentences' },
    pronunciationScore: { type: 'integer', description: 'Score 0-100' },
    confidenceScore: { type: 'integer', description: 'Score 0-100' },
    listeningScore: { type: 'integer', description: 'Score 0-100' },
  },
  required: [
    'userName',
    'levelTitle',
    'levelEmoji',
    'summaryTh',
    'pronunciationScore',
    'confidenceScore',
    'listeningScore',
  ],
  propertyOrdering: [
    'userName',
    'levelTitle',
    'levelEmoji',
    'summaryTh',
    'pronunciationScore',
    'confidenceScore',
    'listeningScore',
  ],
};

type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

type GenerateJsonOptions = {
  systemInstruction?: string;
  contents: GeminiContent[];
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
};

@Injectable()
export class GeminiChatService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.model = this.config.get<string>(
      'GEMINI_CHAT_MODEL',
      'gemini-3.5-flash',
    );
  }

  async correctThaiMix(transcript: string): Promise<string> {
    const text = await this.generateText({
      systemInstruction: THAI_MIX_PROMPT,
      contents: [
        {
          role: 'user',
          parts: [{ text: transcript }],
        },
      ],
      maxOutputTokens: 150,
      temperature: 0.3,
    });
    return text.trim() || transcript;
  }

  async generateOpening(topicId: string): Promise<GptReply> {
    return this.generateJson<GptReply>({
      systemInstruction:
        `${conversationSystemPrompt(topicId)}\n\n` +
        'Respond as Teacher B (ครูพี่บี). Return JSON with textEn (English greeting) ' +
        'and textTh (Thai translation). Keep textEn to 1-2 short sentences.',
      contents: [
        {
          role: 'user',
          parts: [{ text: openingUserPrompt(topicId) }],
        },
      ],
      schema: REPLY_SCHEMA,
      maxOutputTokens: 200,
    });
  }

  async generateReply(
    topicId: string,
    history: ChatTurn[],
    userMessage: string,
  ): Promise<GptReply> {
    const userTurnCount = history.filter((t) => t.speaker === 'user').length;

    const systemPrompt =
      topicId === 'intro'
        ? `${BROTHER_BANANA_PERSONA}\n\nTopic context: ${INTRO_TOPIC_CONTEXT}`
        : conversationSystemPrompt(topicId);

    const replyGuide =
      topicId === 'intro'
        ? introReplyInstruction(userTurnCount)
        : 'Respond as Teacher B (ครูพี่บี). Return JSON with textEn (English reply) ' +
          'and textTh (Thai translation). Keep textEn to 1-2 short sentences.';

    const contents: GeminiContent[] = [];

    for (const turn of history.slice(-10)) {
      contents.push({
        role: turn.speaker === 'ai' ? 'model' : 'user',
        parts: [{ text: turn.textEn }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    return this.generateJson<GptReply>({
      systemInstruction: `${systemPrompt}\n\n${replyGuide}`,
      contents,
      schema: REPLY_SCHEMA,
      maxOutputTokens: topicId === 'intro' ? 350 : 200,
    });
  }

  async generateHints(history: ChatTurn[]): Promise<HintOption[]> {
    const context = this.formatHistory(history);
    const result = await this.generateJson<HintsResponse>({
      systemInstruction: HINTS_PROMPT,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Conversation so far:\n${context}` }],
        },
      ],
      schema: HINTS_SCHEMA,
      maxOutputTokens: 400,
    });
    return result.hints;
  }

  async generateReport(
    history: ChatTurn[],
    durationSeconds: number,
  ): Promise<GptReport> {
    const context = this.formatHistory(history);
    return this.generateJson<GptReport>({
      systemInstruction: REPORT_PROMPT,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Session duration: ${durationSeconds} seconds.\nConversation:\n${context}`,
            },
          ],
        },
      ],
      schema: REPORT_SCHEMA,
      maxOutputTokens: 600,
    });
  }

  async generateIntroReport(history: ChatTurn[]): Promise<GptIntroReport> {
    const context = this.formatHistory(history);
    const report = await this.generateJson<GptIntroReport>({
      systemInstruction: INTRO_REPORT_PROMPT,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Conversation:\n${context}` }],
        },
      ],
      schema: INTRO_REPORT_SCHEMA,
      maxOutputTokens: 2048,
      temperature: 0.4,
    });

    return {
      ...report,
      pronunciationScore: this.clampScore(report.pronunciationScore),
      confidenceScore: this.clampScore(report.confidenceScore),
      listeningScore: this.clampScore(report.listeningScore),
    };
  }

  private async generateJson<T>(options: GenerateJsonOptions): Promise<T> {
    const baseTokens = options.maxOutputTokens ?? 1024;
    const tokenLimits = [baseTokens, baseTokens * 2, 4096];

    let lastError: unknown;
    let lastPreview = '';

    for (let attempt = 0; attempt < tokenLimits.length; attempt++) {
      try {
        const text = await this.callGemini({
          ...options,
          schema: options.schema,
          maxOutputTokens: tokenLimits[attempt],
        });
        return this.parseJsonResponse<T>(text);
      } catch (error) {
        lastError = error;
        if (error instanceof Error) {
          lastPreview = error.message;
        }
        const retryable =
          error instanceof Error &&
          (error.message.includes('MAX_TOKENS') ||
            error.message.includes('invalid JSON') ||
            error.message.includes('Unterminated'));
        if (!retryable || attempt === tokenLimits.length - 1) {
          break;
        }
      }
    }

    if (lastPreview) {
      throw new Error(
        `Gemini returned invalid JSON after retries. Last error: ${lastPreview}`,
      );
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError));
  }

  private async generateText(options: GenerateJsonOptions): Promise<string> {
    return this.callGemini(options);
  }

  private async callGemini(options: GenerateJsonOptions): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured on the server',
      );
    }

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    };

    if (options.schema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = options.schema;
    }

    const body: Record<string, unknown> = {
      contents: options.contents,
      generationConfig,
    };

    if (options.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API failed (${response.status}): ${err}`);
    }

    const data = (await response.json()) as GeminiResponse;

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const text = parts
      .filter((part) => part.text && !part.thought)
      .map((part) => part.text!)
      .join('')
      .trim();

    if (!text) {
      throw new Error('Gemini response missing text');
    }

    if (candidate?.finishReason === 'MAX_TOKENS' && options.schema) {
      throw new Error(
        `Gemini JSON response truncated (MAX_TOKENS). Preview: ${text.slice(0, 120)}`,
      );
    }

    return text;
  }

  private parseJsonResponse<T>(text: string): T {
    let cleaned = text.trim();

    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      }
      throw new Error('Unterminated string in JSON');
    }
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private formatHistory(history: ChatTurn[]): string {
    if (history.length === 0) return '(no conversation yet)';
    return history
      .map((turn) => {
        const speaker = turn.speaker === 'ai' ? 'Teacher B' : 'Learner';
        return `${speaker}: ${turn.textEn}`;
      })
      .join('\n');
  }
}
