import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BROTHER_BANANA_PERSONA,
  conversationSystemPrompt,
  freeTalkOpeningUserPrompt,
  freeTalkSystemPrompt,
  FREE_TALK_SUMMARY_PROMPT,
  HINTS_PROMPT,
  normalizeFreeTalkLanguageLevel,
  openingUserPrompt,
  pickFreeTalkGreetingSeed,
  REPORT_PROMPT,
  teacherBThaiVoice,
  THAI_MIX_PROMPT,
  type FreeTalkLanguageLevel,
  type FreeTalkNextAction,
  type FreeTalkPhase,
} from '../topics/topics.data';
import {
  INTRO_REPORT_PROMPT,
  INTRO_TOPIC_CONTEXT,
  introReplyInstruction,
} from '../topics/intro_script';
import { ChatTurn } from '../session-store/session-store.service';
import {
  FreeTalkSessionSummary,
  FreeTalkTurnReply,
  GptIntroReport,
  GptReply,
  GptReport,
  HintOption,
  HintsResponse,
} from '../common/api.types';
import type { SimulationConfig } from '../simulations/simulations.data';
import type { LessonConfig } from '../lessons/lessons.data';
import { GeminiModelPool, parseGeminiChatModels } from './gemini-model-pool';

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    textEn: { type: 'string' },
    textTh: { type: 'string' },
  },
  required: ['textEn', 'textTh'],
};

const FREE_TALK_PHASES = [
  'greeting',
  'ice_breaker',
  'discover_topic',
  'conversation_loop',
  'wrap_up',
] as const;

const FREE_TALK_ACTIONS = [
  'explore',
  'expand',
  'relate',
  'teach',
  'encourage',
  'change_topic',
  'wrap_up',
] as const;

const FREE_TALK_REPLY_SCHEMA = {
  type: 'object',
  properties: {
    textEn: {
      type: 'string',
      description:
        'Spoken bubble (TTS). For easy/balanced MUST contain BOTH Thai script and English in one line (code-switch). JSON key is historical — not English-only.',
    },
    textTh: {
      type: 'string',
      description: 'Thai-only subtitle of the same meaning (ครับ voice).',
    },
    phase: { type: 'string', enum: [...FREE_TALK_PHASES] },
    nextAction: { type: 'string', enum: [...FREE_TALK_ACTIONS] },
    intent: { type: 'string' },
    emotion: { type: 'string' },
    grammarNote: { type: 'string' },
    topic: { type: 'string' },
    conversationDepth: { type: 'string' },
  },
  required: [
    'textEn',
    'textTh',
    'phase',
    'nextAction',
    'intent',
    'emotion',
    'grammarNote',
    'topic',
    'conversationDepth',
  ],
};

const TRAINING_REPLY_SCHEMA = {
  type: 'object',
  properties: {
    textEn: { type: 'string' },
    textTh: { type: 'string' },
    isLessonComplete: { type: 'boolean' },
  },
  required: ['textEn', 'textTh', 'isLessonComplete'],
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

export interface TrainingTurnReply {
  textEn: string;
  textTh: string;
  isLessonComplete: boolean;
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
    turnFeedback: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userTurnIndex: { type: 'integer' },
          status: {
            type: 'string',
            enum: ['great', 'good', 'needs_improvement'],
          },
          headlineTh: { type: 'string' },
          detailTh: { type: 'string' },
          suggestionEn: { type: 'string' },
          suggestionReasonTh: { type: 'string' },
        },
        required: [
          'userTurnIndex',
          'status',
          'headlineTh',
          'detailTh',
          'suggestionEn',
          'suggestionReasonTh',
        ],
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
    'turnFeedback',
  ],
};

const FREE_TALK_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    conversationSummaryEn: { type: 'string' },
    conversationSummaryTh: { type: 'string' },
    memories: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
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
    turnFeedback: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userTurnIndex: { type: 'integer' },
          status: {
            type: 'string',
            enum: ['great', 'good', 'needs_improvement'],
          },
          headlineTh: { type: 'string' },
          detailTh: { type: 'string' },
          suggestionEn: { type: 'string' },
          suggestionReasonTh: { type: 'string' },
        },
        required: [
          'userTurnIndex',
          'status',
          'headlineTh',
          'detailTh',
          'suggestionEn',
          'suggestionReasonTh',
        ],
      },
    },
  },
  required: [
    'conversationSummaryEn',
    'conversationSummaryTh',
    'memories',
    'feedbackEn',
    'feedbackTh',
    'bestSentenceEn',
    'bestSentenceNoteTh',
    'grammarTip',
    'grammarTipTh',
    'pronunciationIssues',
    'vocab',
    'turnFeedback',
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
  /** When Gemini ignores JSON mode and returns prose, map it into the schema. */
  recoverFromPlainText?: (text: string) => unknown | null;
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
  private readonly logger = new Logger(GeminiChatService.name);
  private readonly apiKey: string;
  private readonly modelPool: GeminiModelPool;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';

    const models = parseGeminiChatModels(
      this.config.get<string>('GEMINI_CHAT_MODEL'),
      this.config.get<string>('GEMINI_CHAT_FALLBACK_MODEL') ??
        'gemini-2.5-flash',
    );
    const cooldownHours = Number(
      this.config.get<string>('GEMINI_CHAT_MODEL_COOLDOWN_HOURS', '2'),
    );
    const cooldownMs = Math.max(0, cooldownHours) * 60 * 60 * 1000;

    this.modelPool = new GeminiModelPool(models, cooldownMs);
    this.logger.log(
      `Gemini chat models: ${models.join(' → ')}` +
        (cooldownMs > 0 ? ` (cooldown ${cooldownHours}h on high demand)` : ''),
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

  async generateFreeTalkOpening(options: {
    languageLevel: FreeTalkLanguageLevel;
    memories?: string[];
    learnerFirstName?: string;
  }): Promise<FreeTalkTurnReply> {
    const languageLevel = normalizeFreeTalkLanguageLevel(options.languageLevel);
    const memories = options.memories ?? [];
    const learnerFirstName =
      (options.learnerFirstName ?? '').trim() || 'เพื่อน';
    const greetingSeed = pickFreeTalkGreetingSeed();
    const openingPrompt = freeTalkOpeningUserPrompt({
      languageLevel,
      memories,
      learnerFirstName,
      greetingSeed,
    });
    const systemInstruction =
      `${freeTalkSystemPrompt({
        languageLevel,
        phase: 'greeting',
        memories,
      })}\n\n` +
      `Learner first name: ${learnerFirstName}. ` +
      `This session's greeting vibe seed: "${greetingSeed}". ` +
      'Open with that vibe + name + one fitting follow-up — never a fixed script.\n\n' +
      'Return JSON matching the schema. Keep the spoken reply short. ' +
      (languageLevel === 'englishOnly'
        ? 'textEn is English-only.'
        : 'HARD RULE: textEn must include Thai script characters AND English — code-switch in one line.');

    let reply = await this.generateJson<FreeTalkTurnReply>({
      systemInstruction,
      contents: [
        {
          role: 'user',
          parts: [{ text: openingPrompt }],
        },
      ],
      schema: FREE_TALK_REPLY_SCHEMA,
      maxOutputTokens: 400,
    });
    reply = this.normalizeFreeTalkReply(reply, 'greeting');
    reply = await this.enforceFreeTalkCodeSwitch(reply, languageLevel, {
      systemInstruction,
      priorContents: [
        {
          role: 'user',
          parts: [{ text: openingPrompt }],
        },
      ],
      learnerFirstName,
    });
    return reply;
  }

  async generateFreeTalkReply(options: {
    history: ChatTurn[];
    userMessage: string;
    languageLevel: FreeTalkLanguageLevel;
    phase?: FreeTalkPhase | string;
    topic?: string | null;
    nextAction?: FreeTalkNextAction | string | null;
    memories?: string[];
    remainingSeconds?: number | null;
    durationLimitSeconds?: number | null;
  }): Promise<FreeTalkTurnReply> {
    const languageLevel = normalizeFreeTalkLanguageLevel(options.languageLevel);
    const systemInstruction =
      `${freeTalkSystemPrompt({
        languageLevel,
        phase: options.phase,
        topic: options.topic,
        nextAction: options.nextAction,
        memories: options.memories,
        remainingSeconds: options.remainingSeconds,
        durationLimitSeconds: options.durationLimitSeconds,
      })}\n\n` +
      'Respond as Teacher B in Free Talk. Return JSON matching the schema. ' +
      'Update phase/nextAction/topic based on the learner message. Keep textEn/textTh short. ' +
      'If their English needs a fix: RECAST naturally then continue (nextAction teach) — never say they were wrong. ' +
      (languageLevel === 'englishOnly'
        ? 'textEn must be English-only.'
        : 'HARD RULE: textEn must include Thai script AND English in one spoken line — never English-only textEn.');

    const contents: GeminiContent[] = [];
    for (const turn of options.history.slice(-10)) {
      contents.push({
        role: turn.speaker === 'ai' ? 'model' : 'user',
        parts: [{ text: turn.textEn }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: options.userMessage }],
    });

    let reply = await this.generateJson<FreeTalkTurnReply>({
      systemInstruction,
      contents,
      schema: FREE_TALK_REPLY_SCHEMA,
      maxOutputTokens: 450,
    });
    reply = this.normalizeFreeTalkReply(
      reply,
      options.phase ?? 'conversation_loop',
    );
    reply = await this.enforceFreeTalkCodeSwitch(reply, languageLevel, {
      systemInstruction,
      priorContents: contents,
      learnerFirstName: undefined,
    });
    return reply;
  }

  async generateFreeTalkReport(
    history: ChatTurn[],
    durationSeconds: number,
  ): Promise<FreeTalkSessionSummary> {
    const context = this.formatHistoryForReport(history);
    const report = await this.generateJson<FreeTalkSessionSummary>({
      systemInstruction: FREE_TALK_SUMMARY_PROMPT,
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
      schema: FREE_TALK_REPORT_SCHEMA,
      maxOutputTokens: 1800,
    });

    const sanitized = this.sanitizeReportForLearnerParticipation(
      report,
      history,
    ) as FreeTalkSessionSummary;

    const memories = (report.memories ?? [])
      .map((m) => (typeof m === 'string' ? m.trim() : ''))
      .filter(Boolean)
      .slice(0, 5);

    return {
      ...sanitized,
      conversationSummaryEn: (report.conversationSummaryEn ?? '').trim(),
      conversationSummaryTh: teacherBThaiVoice(
        (report.conversationSummaryTh ?? '').trim(),
      ),
      memories,
      feedbackTh: teacherBThaiVoice(sanitized.feedbackTh),
      bestSentenceNoteTh: teacherBThaiVoice(sanitized.bestSentenceNoteTh),
      grammarTipTh: teacherBThaiVoice(sanitized.grammarTipTh),
      turnFeedback: (sanitized.turnFeedback ?? []).map((item) => ({
        ...item,
        headlineTh: teacherBThaiVoice(item.headlineTh),
        detailTh: teacherBThaiVoice(item.detailTh ?? ''),
        suggestionEn: this.normalizeFeedbackField(item.suggestionEn ?? ''),
        suggestionReasonTh: teacherBThaiVoice(
          this.normalizeFeedbackField(item.suggestionReasonTh ?? ''),
        ),
      })),
    };
  }

  private normalizeFreeTalkReply(
    reply: FreeTalkTurnReply,
    fallbackPhase: string,
  ): FreeTalkTurnReply {
    const phase = FREE_TALK_PHASES.includes(
      reply.phase as (typeof FREE_TALK_PHASES)[number],
    )
      ? reply.phase
      : fallbackPhase;
    const nextAction = FREE_TALK_ACTIONS.includes(
      reply.nextAction as (typeof FREE_TALK_ACTIONS)[number],
    )
      ? reply.nextAction
      : 'explore';

    return {
      textEn: this.stripEmojis(reply.textEn?.trim() || 'Nice! Tell me more.'),
      textTh: teacherBThaiVoice(
        this.stripEmojis(
          reply.textTh?.trim() || 'ดีเลยครับ เล่าเพิ่มเติมได้นะครับ',
        ),
      ),
      phase,
      nextAction,
      intent: reply.intent?.trim() || '',
      emotion: reply.emotion?.trim() || '',
      grammarNote: reply.grammarNote?.trim() || '',
      topic: reply.topic?.trim() || '',
      conversationDepth: reply.conversationDepth?.trim() || '',
    };
  }

  private stripEmojis(text: string): string {
    return text
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\uFE0F/g, '')
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  private containsThaiScript(text: string): boolean {
    return /[\u0E00-\u0E7F]/.test(text);
  }

  private englishContentWords(text: string, learnerFirstName?: string): string[] {
    const name = (learnerFirstName ?? '').trim().toLowerCase();
    const nameTokens = name
      ? name.split(/\s+/).filter(Boolean)
      : [];
    return (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [])
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 1 && !nameTokens.includes(w));
  }

  private meetsFreeTalkMix(
    textEn: string,
    languageLevel: FreeTalkLanguageLevel,
    learnerFirstName?: string,
  ): boolean {
    if (languageLevel === 'englishOnly') {
      return !this.containsThaiScript(textEn);
    }
    const hasThai = this.containsThaiScript(textEn);
    const enWords = this.englishContentWords(textEn, learnerFirstName);
    if (!hasThai) return false;
    // Easy: at least one real English phrase beyond the name.
    // Balanced: enough English that it isn't Thai-only with a Latin name.
    if (languageLevel === 'easy') return enWords.length >= 1;
    return enWords.length >= 3;
  }

  /** Easy/Balanced must code-switch in textEn; retry once, then weave mix in. */
  private async enforceFreeTalkCodeSwitch(
    reply: FreeTalkTurnReply,
    languageLevel: FreeTalkLanguageLevel,
    context: {
      systemInstruction: string;
      priorContents: GeminiContent[];
      learnerFirstName?: string;
    },
  ): Promise<FreeTalkTurnReply> {
    if (languageLevel === 'englishOnly') {
      return reply;
    }

    if (
      this.meetsFreeTalkMix(
        reply.textEn,
        languageLevel,
        context.learnerFirstName,
      )
    ) {
      return reply;
    }

    this.logger.warn(
      `Free Talk ${languageLevel}: textEn missing proper code-switch — retrying once`,
    );

    const mixHint =
      languageLevel === 'easy'
        ? 'Mostly Thai with English ~30–40% (e.g. "โอ้ Jim มาแล้ว! How are you? พร้อมคุยไหมครับ?").'
        : 'Mostly English ~60–70% with light Thai (e.g. "Hey Jim! มาแล้วครับ How are you feeling today?").';

    try {
      const retry = await this.generateJson<FreeTalkTurnReply>({
        systemInstruction: context.systemInstruction,
        contents: [
          ...context.priorContents,
          {
            role: 'user',
            parts: [
              {
                text:
                  'REWRITE REQUIRED: spoken textEn does not match the language-level mix. ' +
                  `Level=${languageLevel}. ${mixHint} ` +
                  'Do NOT paste the Thai greeting seed as-is. ' +
                  'The learner name alone is not enough English. No emojis. ' +
                  'Do not explain Free Talk. textTh stays Thai-only subtitle. Return full JSON schema.',
              },
            ],
          },
        ],
        schema: FREE_TALK_REPLY_SCHEMA,
        maxOutputTokens: 450,
        temperature: 0.4,
      });
      const normalized = this.normalizeFreeTalkReply(retry, reply.phase);
      if (
        this.meetsFreeTalkMix(
          normalized.textEn,
          languageLevel,
          context.learnerFirstName,
        )
      ) {
        return normalized;
      }
      return this.weaveLanguageMix(
        normalized,
        languageLevel,
        context.learnerFirstName,
      );
    } catch (err) {
      this.logger.warn(
        `Free Talk code-switch retry failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.weaveLanguageMix(
        reply,
        languageLevel,
        context.learnerFirstName,
      );
    }
  }

  private weaveLanguageMix(
    reply: FreeTalkTurnReply,
    languageLevel: FreeTalkLanguageLevel,
    learnerFirstName?: string,
  ): FreeTalkTurnReply {
    if (
      this.meetsFreeTalkMix(reply.textEn, languageLevel, learnerFirstName)
    ) {
      return reply;
    }

    const en = reply.textEn.trim();
    if (languageLevel === 'balanced' || languageLevel === 'easy') {
      // Thai-heavy (or name-only Latin): append a short English follow-up.
      if (
        this.containsThaiScript(en) &&
        this.englishContentWords(en, learnerFirstName).length <
          (languageLevel === 'balanced' ? 3 : 1)
      ) {
        const bit =
          languageLevel === 'balanced'
            ? 'How are you doing today?'
            : 'How are you?';
        return { ...reply, textEn: `${en} ${bit}`.trim() };
      }
    }

    // English-only: weave Thai from subtitle.
    if (!this.containsThaiScript(en)) {
      const th = reply.textTh.trim();
      const thBit =
        th.split(/[.!?。]/).map((s) => s.trim()).find((s) => s.length > 0) ||
        'นะครับ';
      const breakAt = en.search(/[.!?]/);
      const mixed =
        breakAt >= 0 && breakAt < en.length - 1
          ? `${en.slice(0, breakAt + 1)} ${thBit} ${en.slice(breakAt + 1).trim()}`.trim()
          : `${en} ${thBit}`.trim();
      return { ...reply, textEn: mixed };
    }

    return reply;
  }

  private weaveThaiIntoSpoken(reply: FreeTalkTurnReply): FreeTalkTurnReply {
    return this.weaveLanguageMix(reply, 'balanced');
  }

  async generateSimulationOpening(
    config: SimulationConfig,
  ): Promise<SimulationTurnReply> {
    const openingUserText =
      config.openingPrompt ??
      'Start the simulation. Greet the customer and begin the scenario naturally. ' +
        'Return JSON matching the schema.';

    return this.generateJson<SimulationTurnReply>({
      systemInstruction: this.simulationSystemPrompt(config, 0),
      contents: [
        {
          role: 'user',
          parts: [{ text: openingUserText }],
        },
      ],
      schema: buildSimulationReplySchema(config.successCriteria),
      maxOutputTokens: 300,
    });
  }

  async generateTrainingOpening(
    config: LessonConfig,
    learnerFirstName: string,
  ): Promise<TrainingTurnReply> {
    return this.generateJson<TrainingTurnReply>({
      systemInstruction: this.trainingSystemPrompt(
        config,
        0,
        learnerFirstName,
      ),
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `${config.openingPrompt}\n\n` +
                'Respond with ONLY one JSON object: ' +
                '{"textEn":"...","textTh":"...","isLessonComplete":false}. ' +
                'No markdown. No prose outside JSON.',
            },
          ],
        },
      ],
      schema: TRAINING_REPLY_SCHEMA,
      maxOutputTokens: 512,
      temperature: 0.4,
      recoverFromPlainText: (text) => this.recoverTrainingReplyFromPlainText(text),
    });
  }

  async generateTrainingTurn(
    config: LessonConfig,
    history: ChatTurn[],
    userMessage: string,
    currentTurn: number,
    learnerFirstName: string,
  ): Promise<TrainingTurnReply> {
    const contents: GeminiContent[] = [];

    // Session store already appended this user turn before generate — do not
    // send it twice (model invents "said it twice" / retry loops).
    for (const turn of this.priorTurnsForModel(history, userMessage, 12)) {
      contents.push({
        role: turn.speaker === 'ai' ? 'model' : 'user',
        // Keep model turns as JSON so responseSchema stays sticky across turns.
        parts: [
          {
            text:
              turn.speaker === 'ai'
                ? JSON.stringify({
                    textEn: turn.textEn,
                    textTh: turn.textTh ?? '',
                    isLessonComplete: false,
                  })
                : turn.textEn,
          },
        ],
      });
    }

    contents.push({
      role: 'user',
      parts: [
        {
          text:
            `${this.trainingUserTurnPayload(userMessage, config, history)}\n\n` +
            'Respond with ONLY one JSON object: ' +
            '{"textEn":"...","textTh":"...","isLessonComplete":false}. ' +
            'No markdown. No prose outside JSON.',
        },
      ],
    });

    return this.generateJson<TrainingTurnReply>({
      systemInstruction: this.trainingSystemPrompt(
        config,
        currentTurn,
        learnerFirstName,
      ),
      contents,
      schema: TRAINING_REPLY_SCHEMA,
      maxOutputTokens: 600,
      temperature: 0.4,
      recoverFromPlainText: (text) => this.recoverTrainingReplyFromPlainText(text),
    });
  }

  /** Drop trailing duplicate of the current user message from stored history. */
  private priorTurnsForModel(
    history: ChatTurn[],
    userMessage: string,
    limit: number,
  ): ChatTurn[] {
    const prior = history.slice(-limit);
    const last = prior[prior.length - 1];
    if (last?.speaker === 'user' && last.textEn === userMessage) {
      return prior.slice(0, -1);
    }
    return prior;
  }

  /** Common STT / beginner pronunciation confusions → canonical phrase. */
  private static readonly PHRASE_NEAR_MISS_ALIASES: Record<string, string> = {
    tree: 'three',
    free: 'three',
    for: 'four',
    fore: 'four',
    ate: 'eight',
    ait: 'eight',
    tin: 'ten',
    tan: 'ten',
    won: 'one',
    wan: 'one',
    too: 'two',
    to: 'two',
  };

  private static readonly NUMBER_ONES = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
  ] as const;

  private static readonly NUMBER_TEENS = [
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ] as const;

  private static readonly NUMBER_TENS = [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
  ] as const;

  /** Convert 0–100 to English words (STT often returns digits instead of words). */
  private numberToWords(n: number): string | null {
    if (!Number.isInteger(n) || n < 0 || n > 100) return null;
    if (n < 10) return GeminiChatService.NUMBER_ONES[n];
    if (n < 20) return GeminiChatService.NUMBER_TEENS[n - 10];
    if (n === 100) return 'one hundred';
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    const tensWord = GeminiChatService.NUMBER_TENS[tens];
    if (ones === 0) return tensWord;
    return `${tensWord} ${GeminiChatService.NUMBER_ONES[ones]}`;
  }

  /** Replace standalone digits in normalized speech with English number words. */
  private expandDigitsToWords(normalized: string): string {
    return normalized
      .replace(/\b\d{1,3}\b/g, (raw) => {
        const words = this.numberToWords(Number(raw));
        return words ?? raw;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  private matchTargetPhrase(
    userMessage: string,
    phrases: string[],
  ): string | null {
    const normalized = this.normalizeSpeechText(userMessage);
    if (!normalized) return null;

    const expanded = this.expandDigitsToWords(normalized);
    const candidates = expanded === normalized
      ? [normalized]
      : [normalized, expanded];

    for (const candidate of candidates) {
      const matched = this.matchNormalizedAgainstPhrases(candidate, phrases);
      if (matched) return matched;
    }

    return null;
  }

  private matchNormalizedAgainstPhrases(
    normalized: string,
    phrases: string[],
  ): string | null {
    const sorted = [...phrases].sort((a, b) => b.length - a.length);
    for (const phrase of sorted) {
      const target = this.normalizeSpeechText(phrase);
      if (!target) continue;
      if (normalized === target) return phrase;
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
      if (re.test(normalized)) return phrase;
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      const alias = GeminiChatService.PHRASE_NEAR_MISS_ALIASES[normalized];
      if (alias) {
        const canonical = sorted.find(
          (p) => this.normalizeSpeechText(p) === alias,
        );
        if (canonical) return canonical;
      }

      for (const phrase of sorted) {
        const target = this.normalizeSpeechText(phrase);
        if (!target || target.includes(' ')) continue;
        if (this.isWithinEditDistanceOne(normalized, target)) return phrase;
      }
    }

    return null;
  }

  private isWithinEditDistanceOne(a: string, b: string): boolean {
    if (a === b) return true;
    const diff = Math.abs(a.length - b.length);
    if (diff > 1) return false;

    if (a.length > b.length) [a, b] = [b, a];

    let mismatches = 0;
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }
      mismatches++;
      if (mismatches > 1) return false;
      if (a.length === b.length) {
        i++;
        j++;
      } else {
        j++;
      }
    }
    return mismatches + (b.length - j) <= 1;
  }

  private normalizeSpeechText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private recentUserMessages(history: ChatTurn[], limit: number): string[] {
    return history
      .filter((turn) => turn.speaker === 'user')
      .slice(-limit)
      .map((turn) => turn.textEn);
  }

  private trainingUserTurnPayload(
    userMessage: string,
    config: LessonConfig,
    history: ChatTurn[],
  ): string {
    const matched = this.matchTargetPhrase(userMessage, config.targetPhrases);
    if (matched) {
      const nearMiss =
        this.normalizeSpeechText(userMessage) !==
        this.normalizeSpeechText(matched);
      return `Learner transcript (exact STT text shown in the app): "${userMessage}"

MATCH RESULT: SUCCESS — this transcript matches the taught phrase "${matched}"${nearMiss ? ' (close pronunciation / STT variant — treat as correct)' : ''}.
Required response:
- Speak MOSTLY in Thai (beginner tutor). English only for the next target phrase if modeling it.
- Brief Thai praise only (e.g. เยี่ยมเลยครับ / ดีมากครับ) — do NOT praise in English ("Perfect!", "Great!")
- ADVANCE immediately to the NEXT teaching step with a NEW Thai-led learner action
- FORBIDDEN: full-English lines, โอ๊ะ, เกือบใช่, almost, ลองอีกที, asking to repeat "${matched}" again, inventing pronunciation or "said it twice" issues`;
    }

    const recentUsers = this.recentUserMessages(history, 2);
    const consecutiveMisses =
      recentUsers.length >= 2 &&
      recentUsers.every(
        (msg) => !this.matchTargetPhrase(msg, config.targetPhrases),
      );

    if (consecutiveMisses) {
      return `Learner transcript (exact STT text shown in the app): "${userMessage}"

MATCH RESULT: NO MATCH — but this is the learner's SECOND consecutive attempt without a match on the current item.
Required response:
- Do NOT ask for the same number/phrase again — maximum one retry already used.
- Accept generously (e.g. "ไม่เป็นไรครับ ไปต่อกัน") and ADVANCE immediately to the NEXT Core Flow step with a NEW teaching/speaking task.
- FORBIDDEN: ลองอีกที, repeat the same ask, looping on the same word.`;
    }

    return `Learner transcript (exact STT text shown in the app): "${userMessage}"

MATCH RESULT: NO MATCH yet on the current speaking task.
Required response:
- You may give at most ONE gentle retry with brief Thai feedback — then you MUST advance regardless.
- FORBIDDEN: asking for the same item more than twice total.`;
  }

  private trainingSystemPrompt(
    config: LessonConfig,
    currentTurn: number,
    learnerFirstName: string,
  ): string {
    const remaining = Math.max(0, config.maxTurns - currentTurn);
    const phrases = config.targetPhrases.map((p) => `- ${p}`).join('\n');
    return `${config.systemInstruction}

Learner first name: ${learnerFirstName}
(Use this name sparingly — once in opening, occasionally when encouraging, once near the ending. Never every turn. Never address a group.)

Target phrases:
${phrases}

Language mix target: ~${config.languageMix.thai}% Thai / ~${config.languageMix.english}% English.

Spoken language rule (critical — Thai beginners):
- textEn is what Teacher B says aloud. It must be MOSTLY THAI (~${config.languageMix.thai}%), not full English.
- English in textEn is ONLY for the target phrase being taught/modeled (e.g. "Good evening") and short words the learner must say.
- Praise, instructions, explanations, and "พูดตาม" cues MUST be Thai (e.g. "เยี่ยมเลยครับ งั้นลองทักตอนเย็น ตามผมว่า Good evening").
- FORBIDDEN: full-English tutor lines like "Perfect! Now let's try... Repeat after me: ...".
- textTh: short Thai support line (can mirror textEn).

Teaching mix 70/20/10 (applies to EVERY lesson — do NOT only use "พูดตาม"):
- ~70% Repeat: model a phrase, then ask the learner to say it after you (pronunciation + confidence).
- ~20% Recognition: short choice or guided use — e.g. pick which phrase fits a situation, or greet you in a given style (learner thinks; answer stays short).
- ~10% Recall: near the end, ask the learner to use a taught phrase freely (no fixed script; accept any clear taught variant).
- Never run a whole lesson as repeat-only. After a few repeats, insert recognition. End with free recall before celebrate.
- If this lesson defines a Core Flow, treat those as progression milestones — not a fixed turn count. Retries/feedback may insert extra turns between milestones.

Acceptance rules (critical — prevent retry loops):
- You only see the learner's transcript TEXT, not audio. Never invent pronunciation, length, speed, or "said it twice" issues from text alone.
- If the transcript clearly contains the expected phrase (ignore case/punctuation; "Hi", "hi", "Hi!" all count), treat as SUCCESS and ADVANCE to the next step. Do not ask to repeat the same phrase again.
- Never say "เกือบใช่" / "almost" / "ลองอีกที" when the transcript already matches the target.
- Maximum ONE retry per phrase. After that retry (or if still unclear), accept generously and move on — do not loop the same phrase a third time.
- Prefer progress and confidence over perfection.

Turn ${currentTurn} of ${config.maxTurns} (${remaining} turns remaining).

Critical turn-loop rule:
- If isLessonComplete is false, textEn MUST end with a clear next action for the learner (repeat, recognition choice/guided use, or free recall). Never return explanation/praise only.
- Always follow the 70/20/10 mix above for this lesson.
- After a successful learner reply, the next action must be a NEW step — not the same phrase again.

Return JSON ONLY (critical — never reply with bare prose):
- Output a single JSON object and nothing else. No markdown fences.
- textEn: spoken Teacher B line — MOSTLY THAI; include the English target phrase only where the learner should hear/say it; must end with the learner's next action unless completing
- textTh: short Thai support line / paraphrase
- isLessonComplete: true ONLY on the Summary + Celebrate core step (required to finish). Otherwise false`;
  }

  async generateSimulationTurn(
    config: SimulationConfig,
    history: ChatTurn[],
    userMessage: string,
    checkpointStates: Record<string, boolean>,
    currentTurn: number,
  ): Promise<SimulationTurnReply> {
    const contents: GeminiContent[] = [];

    for (const turn of this.priorTurnsForModel(history, userMessage, 10)) {
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
    const context = this.formatHistoryForReport(history);
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
      maxOutputTokens: 1600,
    });

    const sanitized = this.sanitizeReportForLearnerParticipation(report, history);

    return {
      ...sanitized,
      feedbackTh: teacherBThaiVoice(sanitized.feedbackTh),
      bestSentenceNoteTh: teacherBThaiVoice(sanitized.bestSentenceNoteTh),
      grammarTipTh: teacherBThaiVoice(sanitized.grammarTipTh),
      turnFeedback: (sanitized.turnFeedback ?? []).map((item) => ({
        ...item,
        headlineTh: teacherBThaiVoice(item.headlineTh),
        detailTh: teacherBThaiVoice(item.detailTh ?? ''),
        suggestionEn: this.normalizeFeedbackField(item.suggestionEn ?? ''),
        suggestionReasonTh: teacherBThaiVoice(
          this.normalizeFeedbackField(item.suggestionReasonTh ?? ''),
        ),
      })),
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
    const tokenLimits = [
      baseTokens,
      Math.max(baseTokens * 2, 1024),
      Math.max(baseTokens * 3, 2048),
      4096,
    ];
    const models = this.modelPool.activeModels();

    let lastError: unknown;
    let lastPreview = '';

    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const model = models[modelIndex];
      let switchModelNow = false;

      for (let attempt = 0; attempt < tokenLimits.length; attempt++) {
        const temperature =
          attempt === 0
            ? (options.temperature ?? 0.7)
            : Math.min(options.temperature ?? 0.7, 0.35);

        try {
          const text = await this.callGeminiWithModel(model, {
            ...options,
            schema: options.schema,
            maxOutputTokens: tokenLimits[attempt],
            temperature,
          });
          try {
            return this.parseJsonResponse<T>(text);
          } catch (parseError) {
            if (options.recoverFromPlainText) {
              const recovered = options.recoverFromPlainText(text);
              if (recovered != null) {
                this.logger.warn(
                  `Recovered plain-text Gemini reply into schema (model=${model})`,
                );
                return recovered as T;
              }
            }
            throw parseError;
          }
        } catch (error) {
          lastError = error;
          if (error instanceof Error) {
            lastPreview = error.message;
          }

          const retryable = this.isRetryableJsonError(error);
          this.logger.warn(
            `Gemini JSON attempt failed model=${model} tokens=${tokenLimits[attempt]}: ${lastPreview.slice(0, 180)}`,
          );

          if (!retryable) {
            throw error instanceof Error
              ? error
              : new Error(String(error));
          }

          // 503/429/high-demand: do not burn the token-limit retry loop on the
          // same overloaded model — jump to the next model immediately.
          if (error instanceof Error && this.isRetryableModelError(error)) {
            this.modelPool.markUnavailable(model);
            switchModelNow = true;
            break;
          }
        }
      }

      const hasAnotherModel = modelIndex < models.length - 1;
      if (!hasAnotherModel) break;

      this.logger.warn(
        switchModelNow
          ? `Gemini model ${model} unavailable; trying ${models[modelIndex + 1]}`
          : `Gemini model ${model} kept returning bad JSON; trying ${models[modelIndex + 1]}`,
      );
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

  private isRetryableJsonError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message;
    return (
      message.includes('MAX_TOKENS') ||
      message.includes('truncated') ||
      message.includes('invalid JSON') ||
      message.includes('Unterminated') ||
      message.includes('missing text') ||
      message.includes('Unexpected token') ||
      message.includes('Unexpected end') ||
      this.isRetryableModelError(error)
    );
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

    const models = this.modelPool.activeModels();
    let lastError: Error | null = null;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      try {
        return await this.callGeminiWithModel(model, options);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        const hasAnotherModel = i < models.length - 1;
        if (!hasAnotherModel || !this.isRetryableModelError(err)) {
          throw err;
        }

        const until = this.modelPool.markUnavailable(model);
        const nextModel = models[i + 1];
        const cooldownNote =
          until != null
            ? ` for ${this.modelPool.cooldownHours()}h`
            : '';
        this.logger.warn(
          `Gemini model ${model} unavailable (${err.message.slice(0, 120)})` +
            `${cooldownNote}; trying ${nextModel}`,
        );
      }
    }

    throw lastError ?? new Error('Gemini call failed');
  }

  private async callGeminiWithModel(
    model: string,
    options: GenerateJsonOptions,
  ): Promise<string> {
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      thinkingConfig: this.buildThinkingConfigForModel(model),
    };

    if (options.schema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = options.schema;
      // Newer Gemini models accept responseJsonSchema; send both for compatibility.
      generationConfig.responseJsonSchema = options.schema;
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

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
          // 3.5 can hang under load without a quick 503 — cut over to fallback.
          signal: AbortSignal.timeout(20_000),
        },
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new Error(
          `Gemini API failed (504): timeout after 20s model=${model}`,
        );
      }
      throw err;
    }

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

  private isRetryableModelError(error: Error): boolean {
    const message = error.message;
    const name = error.name;
    return (
      /\bGemini API failed \((503|429|500|502|504)\):/.test(message) ||
      message.includes('"status": "UNAVAILABLE"') ||
      message.includes('high demand') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      // Undici/Node: network blip or peer reset — switch model, don't hard-fail.
      message.includes('fetch failed') ||
      message.includes('ECONNRESET') ||
      message.includes('ETIMEDOUT') ||
      message.includes('other side closed') ||
      name === 'TimeoutError' ||
      name === 'AbortError' ||
      message.includes('TimeoutError') ||
      message.includes('aborted due to timeout') ||
      message.includes('The operation was aborted')
    );
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
        turnFeedback: [],
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
      turnFeedback: (report.turnFeedback ?? [])
        .filter((item) => Number.isFinite(item.userTurnIndex))
        .map((item) => ({
          ...item,
          headlineTh: this.normalizeFeedbackField(item.headlineTh),
          detailTh: this.normalizeFeedbackField(item.detailTh ?? ''),
          suggestionEn: this.normalizeFeedbackField(item.suggestionEn ?? ''),
          suggestionReasonTh: this.normalizeFeedbackField(
            item.suggestionReasonTh ?? '',
          ),
        }))
        .filter((item) => item.headlineTh.length > 0),
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

  private buildThinkingConfigForModel(model: string): Record<string, unknown> {
    if (model.includes('gemini-3')) {
      return { thinkingLevel: 'minimal' };
    }

    if (model.includes('gemini-2.5')) {
      return { thinkingBudget: 0 };
    }

    return { thinkingBudget: 0 };
  }

  private recoverTrainingReplyFromPlainText(
    text: string,
  ): TrainingTurnReply | null {
    let plain = text.trim();
    if (!plain) return null;

    if (plain.startsWith('```')) {
      plain = plain
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    }

    // Already looks like JSON — let the normal parser / repair path handle it.
    if (plain.startsWith('{')) return null;

    // Model ignored JSON mode and returned Teacher B prose (common with Thai).
    this.logger.warn(
      `Training reply plain-text fallback: ${plain.slice(0, 120)}`,
    );
    return {
      textEn: plain,
      textTh: '',
      isLessonComplete: false,
    };
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
    const candidates = [
      cleaned,
      this.extractJsonObject(cleaned),
      this.repairTruncatedJson(cleaned),
      this.repairTruncatedJson(this.extractJsonObject(cleaned) ?? ''),
    ].filter((value): value is string => Boolean(value && value.trim()));

    let firstError: unknown;
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as T;
      } catch (error) {
        firstError ??= error;
      }
    }

    const start = cleaned.indexOf('{');
    const looksTruncated =
      start >= 0 && !cleaned.trimEnd().endsWith('}');
    if (looksTruncated) {
      throw new Error(
        `Gemini JSON response truncated (malformed). Preview: ${preview}`,
      );
    }

    const detail =
      firstError instanceof Error ? firstError.message : 'parse failed';
    throw new Error(`Gemini invalid JSON: ${detail}. Preview: ${preview}`);
  }

  private extractJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return text.slice(start, end + 1);
  }

  /** Best-effort close for truncated Gemini JSON (common with Thai/long textEn). */
  private repairTruncatedJson(text: string): string | null {
    const start = text.indexOf('{');
    if (start < 0) return null;

    let body = text.slice(start);
    let inString = false;
    let escape = false;
    let depth = 0;

    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === '\\') {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
    }

    if (!inString && depth <= 0 && body.trimEnd().endsWith('}')) {
      return null; // already well-formed enough for extract path
    }

    if (inString) {
      // Drop a trailing incomplete escape, then close the string.
      if (body.endsWith('\\')) {
        body = body.slice(0, -1);
      }
      body += '"';
    }

    // Remove trailing comma before we close braces.
    body = body.replace(/,\s*$/, '');

    while (depth > 0) {
      body += '}';
      depth -= 1;
    }

    try {
      JSON.parse(body);
      return body;
    } catch {
      return null;
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

  /** Number learner turns so turnFeedback.userTurnIndex aligns.
   * Prefer original spoken text so coaching reflects what the learner said. */
  private formatHistoryForReport(history: ChatTurn[]): string {
    if (history.length === 0) return '(no conversation yet)';
    let learnerIndex = 0;
    return history
      .map((turn) => {
        if (turn.speaker === 'ai') {
          return `Teacher B: ${turn.textEn}`;
        }
        const index = learnerIndex++;
        const spoken = turn.originalTextEn?.trim() || turn.textEn;
        return `[Learner #${index}]: ${spoken}`;
      })
      .join('\n');
  }
}
