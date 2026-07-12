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
  teacherBThaiVoice,
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
import type { SimulationConfig } from '../simulations/simulations.data';

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    textEn: { type: 'string' },
    textTh: { type: 'string' },
  },
  required: ['textEn', 'textTh'],
};

export interface SimulationTurnReply {
  aiResponse: string;
  textTh: string;
  updatedCheckpoints: Record<string, boolean>;
  feedbackHints: {
    grammarTip?: string;
    mispronouncedWords: string[];
  };
}

function buildSimulationReplySchema(criteria: string[]) {
  const checkpointProperties = Object.fromEntries(
    criteria.map((key) => [key, { type: 'boolean' }]),
  );

  return {
    type: 'object',
    properties: {
      aiResponse: { type: 'string' },
      textTh: { type: 'string' },
      updatedCheckpoints: {
        type: 'object',
        properties: checkpointProperties,
        required: criteria,
      },
      feedbackHints: {
        type: 'object',
        properties: {
          grammarTip: { type: 'string' },
          mispronouncedWords: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['mispronouncedWords'],
      },
    },
    required: ['aiResponse', 'textTh', 'updatedCheckpoints', 'feedbackHints'],
  };
}

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
          pronunciation: { type: 'string' },
        },
        required: ['id', 'label', 'sentenceEn', 'pronunciation'],
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
    bestSentenceEn: { type: 'string' },
    bestSentenceNoteTh: { type: 'string' },
    grammarTip: { type: 'string' },
    grammarTipTh: { type: 'string' },
    pronunciationIssues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          scorePercent: { type: 'integer' },
        },
        required: ['word', 'scorePercent'],
      },
    },
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
  required: [
    'feedbackEn',
    'feedbackTh',
    'bestSentenceEn',
    'bestSentenceNoteTh',
    'grammarTip',
    'grammarTipTh',
    'pronunciationIssues',
    'vocab',
  ],
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
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    thoughtsTokenCount?: number;
    candidatesTokenCount?: number;
  };
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

  async generateSimulationOpening(
    config: SimulationConfig,
  ): Promise<SimulationTurnReply> {
    return this.generateJson<SimulationTurnReply>({
      systemInstruction: this.simulationSystemPrompt(config, 0),
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Start the simulation. Greet the customer and begin the scenario naturally. ' +
                'Return JSON matching the schema.',
            },
          ],
        },
      ],
      schema: buildSimulationReplySchema(config.successCriteria),
      maxOutputTokens: 300,
    });
  }

  async generateSimulationTurn(
    config: SimulationConfig,
    history: ChatTurn[],
    userMessage: string,
    checkpointStates: Record<string, boolean>,
    currentTurn: number,
  ): Promise<SimulationTurnReply> {
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

    return this.generateJson<SimulationTurnReply>({
      systemInstruction: this.simulationSystemPrompt(
        config,
        currentTurn,
        checkpointStates,
      ),
      contents,
      schema: buildSimulationReplySchema(config.successCriteria),
      maxOutputTokens: 400,
    });
  }

  private simulationSystemPrompt(
    config: SimulationConfig,
    currentTurn: number,
    checkpointStates?: Record<string, boolean>,
  ): string {
    const criteriaList = config.successCriteria
      .map((key) => `- ${key}`)
      .join('\n');
    const checkpointStatus = checkpointStates
      ? Object.entries(checkpointStates)
          .map(([key, done]) => `- ${key}: ${done ? 'complete' : 'pending'}`)
          .join('\n')
      : config.successCriteria
          .map((key) => `- ${key}: pending`)
          .join('\n');
    const remainingTurns = config.maxTurns - currentTurn;

    return `${config.systemInstruction}

Success criteria (checkpoints):
${criteriaList}

Current checkpoint status:
${checkpointStatus}

Turn ${currentTurn} of ${config.maxTurns} (${remainingTurns} turns remaining).

Rules:
- Stay in character. Keep aiResponse under 15 words (up to 25 words on payment-closure turns).
- For non-payment checkpoints, mark true only when clearly satisfied this turn.
- updatedCheckpoints must include ALL criteria keys with boolean values.
- Provide textTh as natural Thai translation of aiResponse (Teacher B voice: ครับ, not ค่ะ).
- feedbackHints.grammarTip: optional short grammar tip if the user made a mistake.
- feedbackHints.mispronouncedWords: list words the user mispronounced this turn (empty array if none).

Payment closure (critical — no tap UI exists):
- When the customer indicates CARD payment (even if speech-to-text is garbled, e.g. "hard plates" = "card please"), you MUST set payment_completed to true immediately in updatedCheckpoints.
- Do NOT ask them to tap the screen, point anywhere, or wait for another turn. Close payment in this reply.
- Example closing line: "Card, got it! Payment completed. Here is your latte! Enjoy your day!"
- Never use half-open phrases like "Just tap here?" — always finish the transaction and hand over the drink.`;
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
          'and textTh (Thai translation in masculine voice: ครับ, not ค่ะ). Keep textEn to 1-2 short sentences.';

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
    const report = await this.generateJson<GptReport>({
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
      maxOutputTokens: 900,
    });

    const sanitized = this.sanitizeReportForLearnerParticipation(report, history);

    return {
      ...sanitized,
      feedbackTh: teacherBThaiVoice(sanitized.feedbackTh),
      bestSentenceNoteTh: teacherBThaiVoice(sanitized.bestSentenceNoteTh),
      grammarTipTh: teacherBThaiVoice(sanitized.grammarTipTh),
    };
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
      summaryTh: teacherBThaiVoice(report.summaryTh),
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
            error.message.includes('Unterminated') ||
            error.message.includes('missing text'));
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
      thinkingConfig: this.buildThinkingConfig(),
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
      const finishReason = candidate?.finishReason ?? 'unknown';
      const blockReason = data.promptFeedback?.blockReason;
      const thoughtTokens = data.usageMetadata?.thoughtsTokenCount;
      const answerTokens = data.usageMetadata?.candidatesTokenCount;
      throw new Error(
        'Gemini response missing text' +
          ` (finishReason=${finishReason}` +
          (blockReason ? `, block=${blockReason}` : '') +
          (thoughtTokens != null ? `, thoughtTokens=${thoughtTokens}` : '') +
          (answerTokens != null ? `, answerTokens=${answerTokens}` : '') +
          ')',
      );
    }

    if (candidate?.finishReason === 'MAX_TOKENS' && options.schema) {
      throw new Error(
        `Gemini JSON response truncated (MAX_TOKENS). Preview: ${text.slice(0, 120)}`,
      );
    }

    return text;
  }

  private sanitizeReportForLearnerParticipation(
    report: GptReport,
    history: ChatTurn[],
  ): GptReport {
    const userSpoke = history.some(
      (turn) => turn.speaker === 'user' && turn.textEn.trim().length > 0,
    );

    if (!userSpoke) {
      return {
        ...report,
        bestSentenceEn: '',
        bestSentenceNoteTh: '',
        grammarTip: '',
        grammarTipTh: '',
        pronunciationIssues: [],
      };
    }

    return {
      ...report,
      bestSentenceEn: this.normalizeFeedbackField(report.bestSentenceEn),
      bestSentenceNoteTh: this.normalizeFeedbackField(report.bestSentenceNoteTh),
      grammarTip: this.normalizeFeedbackField(report.grammarTip),
      grammarTipTh: this.normalizeFeedbackField(report.grammarTipTh),
      pronunciationIssues: report.pronunciationIssues.filter((issue) =>
        this.isMeaningfulFeedbackText(issue.word),
      ),
    };
  }

  private normalizeFeedbackField(value: string): string {
    return this.isMeaningfulFeedbackText(value) ? value.trim() : '';
  }

  private isMeaningfulFeedbackText(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    const normalized = trimmed.toLowerCase();
    const placeholders = new Set([
      '-',
      '—',
      '–',
      'n/a',
      'na',
      'none',
      'null',
      '.',
      '...',
      'ไม่มี',
      'ไม่มีข้อมูล',
      'no data',
    ]);

    return !placeholders.has(normalized);
  }

  private buildThinkingConfig(): Record<string, unknown> {
    if (this.model.includes('gemini-3')) {
      return { thinkingLevel: 'minimal' };
    }

    if (this.model.includes('gemini-2.5')) {
      return { thinkingBudget: 0 };
    }

    return { thinkingBudget: 0 };
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
