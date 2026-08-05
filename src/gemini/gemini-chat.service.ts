import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BROTHER_BANANA_PERSONA,
  applyFreeTalkSuggestionGate,
  conversationSystemPrompt,
  formatFreeTalkIssueLogForReport,
  freeTalkOpeningUserPrompt,
  freeTalkSystemPrompt,
  FREE_TALK_SUMMARY_PROMPT,
  HINTS_PROMPT,
  normalizeFreeTalkDamage,
  normalizeFreeTalkLanguageLevel,
  openingUserPrompt,
  pickFreeTalkGreetingSeed,
  REPORT_PROMPT,
  teacherBThaiVoice,
  THAI_MIX_PROMPT,
  type FreeTalkIssueLogEntry,
  type FreeTalkLanguageLevel,
  type FreeTalkNextAction,
  type FreeTalkPhase,
  type FreeTalkSuggestionGateResult,
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
import {
  EMOJI_SPEAK_COMPLETE_TURN_TEXT,
  TAP_TO_CONTINUE_TURN_TEXT,
} from '../common/api.types';
import type { SimulationConfig } from '../simulations/simulations.data';
import type { LessonConfig } from '../lessons/lessons.data';
import {
  lessonUsesTapToContinue,
  pickFunnyIntroJabSeed,
} from '../lessons/lessons.data';
import {
  buildLessonSystemInstruction,
  renderOpeningPrompt,
  teachingLanguageFromConfig,
} from '../lessons/lesson-prompt';
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

const FREE_TALK_DAMAGE_LEVELS = ['none', 'low', 'medium', 'high'] as const;

const FREE_TALK_REPLY_SCHEMA = {
  type: 'object',
  properties: {
    textEn: {
      type: 'string',
      description:
        'Spoken bubble (TTS). For easy/balanced MUST contain BOTH Thai script and English in one line (code-switch). JSON key is historical — not English-only. Normal chat reply WITHOUT labeling mistakes.',
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
    grammarDamage: {
      type: 'string',
      enum: [...FREE_TALK_DAMAGE_LEVELS],
      description: 'Internal grammar damage: none|low|medium|high',
    },
    naturalnessDamage: {
      type: 'string',
      enum: [...FREE_TALK_DAMAGE_LEVELS],
      description: 'Internal naturalness damage: none|low|medium|high',
    },
    issueNote: {
      type: 'string',
      description:
        'Short internal English note; empty if both damages are none',
    },
    softRecastEn: {
      type: 'string',
      description:
        'Optional soft-recast spoken line when damage is medium/high; empty otherwise',
    },
    softRecastTh: {
      type: 'string',
      description: 'Thai subtitle for softRecastEn; empty if softRecastEn empty',
    },
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
    'grammarDamage',
    'naturalnessDamage',
    'issueNote',
    'softRecastEn',
    'softRecastTh',
  ],
};

function buildTrainingReplySchema(withSpeechFlag: boolean) {
  if (!withSpeechFlag) {
    return {
      type: 'object',
      properties: {
        textEn: { type: 'string' },
        textTh: { type: 'string' },
        isLessonComplete: { type: 'boolean' },
      },
      required: ['textEn', 'textTh', 'isLessonComplete'],
    };
  }

  return {
    type: 'object',
    properties: {
      textEn: { type: 'string' },
      textTh: { type: 'string' },
      isLessonComplete: { type: 'boolean' },
      expectsUserSpeech: { type: 'boolean' },
      expectedSpeech: {
        type: 'string',
        description:
          'Exact English the learner should say this turn (for STT bias). Prefer a single word or short phrase for vocab/พูดตาม (e.g. "latte", "boarding pass", "Go straight"). For a scripted pattern sentence, put that full target here (e.g. "I\'m looking for pants."). Use empty string when not asking for speech, or when the ask is open-ended free recall.',
      },
      scene: {
        type: 'object',
        description:
          'Optional multi-speaker dialogue for Watch & Listen Scene turns',
        properties: {
          title: { type: 'string' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                speaker: { type: 'string' },
                role: { type: 'string', enum: ['npc', 'teacher'] },
                textEn: { type: 'string' },
                textTh: {
                  type: 'string',
                  description:
                    'Thai translation of this dialogue line (for subtitle toggle)',
                },
                voice: { type: 'string' },
              },
              required: ['speaker', 'role', 'textEn', 'textTh'],
            },
          },
        },
        required: ['lines'],
      },
      emojiSpeak: {
        type: 'object',
        description:
          'Optional single in-chat Emoji Speak puzzle card. Prefer emojiSpeakSet for batched puzzles.',
        properties: {
          emoji: {
            type: 'string',
            description: 'Single emoji shown large on the card (e.g. "🍳")',
          },
          answer: {
            type: 'string',
            description:
              'Exact English answer the learner should say (same as expectedSpeech)',
          },
          hint: {
            type: 'string',
            description:
              'Letter-blank puzzle shown under the emoji (e.g. "b _ _ _ k f _ _ t"). Never the full answer.',
          },
          index: {
            type: 'integer',
            description: '1-based position in this lesson emoji set (e.g. 2)',
          },
          total: {
            type: 'integer',
            description: 'Total emoji words in this lesson set (e.g. 6)',
          },
        },
        required: ['emoji', 'answer', 'hint', 'index', 'total'],
      },
      emojiSpeakSet: {
        type: 'array',
        description:
          'Optional full Emoji Speak batch (e.g. all 6 Stories words). Include once on the Intro listen turn; the app runs them locally. Omit on other turns.',
        items: {
          type: 'object',
          properties: {
            emoji: { type: 'string' },
            answer: { type: 'string' },
            hint: { type: 'string' },
            index: { type: 'integer' },
            total: { type: 'integer' },
          },
          required: ['emoji', 'answer', 'hint', 'index', 'total'],
        },
      },
      emojiChoice: {
        type: 'object',
        description:
          'Optional visual emoji (+ label) scaffolds for a speak turn. Shown with the AI bubble; learner still speaks via mic. Omit on listen-only / emojiSpeak turns.',
        properties: {
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                emoji: {
                  type: 'string',
                  description: 'Emoji shown on the chip (e.g. "👕")',
                },
                label: {
                  type: 'string',
                  description:
                    'Optional English label under the emoji (e.g. "Small"). Empty OK for emoji-only cues.',
                },
                speak: {
                  type: 'string',
                  description:
                    'English the learner may say for this option (word or full sentence).',
                },
              },
              required: ['emoji', 'speak'],
            },
          },
        },
        required: ['options'],
      },
      guidedSpeaking: {
        type: 'object',
        description:
          'Optional Guided Speaking card: sentence stem + single emoji cue. Learner completes the stem via mic. Omit on listen-only / emojiChoice / Celebrate turns.',
        properties: {
          stem: {
            type: 'string',
            description:
              'Sentence stem shown on the card (e.g. "I\'m looking for the...").',
          },
          emoji: {
            type: 'string',
            description: 'Emoji cue for the missing word/place (e.g. "🏛️").',
          },
          label: {
            type: 'string',
            description: 'Optional English label under the emoji (e.g. "museum").',
          },
          speak: {
            type: 'string',
            description:
              'Full English the learner should say (e.g. "I\'m looking for the museum.").',
          },
        },
        required: ['stem', 'emoji', 'speak'],
      },
      roleplayIntro: {
        type: 'object',
        description:
          'Optional Roleplay Intro card (listen-only). Learner taps Continue to start NPC dialogue. NPC = emoji; learner = app avatar. Omit on speak / Celebrate turns.',
        properties: {
          subtitle: {
            type: 'string',
            description:
              'Line under ROLEPLAY (e.g. "คุณกำลังคุยกับคนท้องถิ่น").',
          },
          npcEmoji: {
            type: 'string',
            description: 'NPC emoji in the right circle (e.g. "👨").',
          },
          npcLabel: {
            type: 'string',
            description: 'Label under NPC circle (e.g. "คนท้องถิ่น").',
          },
          npcName: {
            type: 'string',
            description:
              'Name on NPC bubbles after intro (e.g. "Local Guide").',
          },
          userLabel: {
            type: 'string',
            description: 'Label under learner circle (default "คุณ").',
          },
        },
        required: ['subtitle', 'npcEmoji', 'npcLabel'],
      },
      roleplayNpc: {
        type: 'object',
        description:
          'Optional active roleplay NPC chrome on staff turns (ROLEPLAY tag + bubble avatar + objective). Omit on Teacher / Celebrate / Intro turns.',
        properties: {
          emoji: { type: 'string' },
          name: { type: 'string' },
          objective: {
            type: 'string',
            description:
              'Short objective under ROLEPLAY (e.g. "🎯 Ask for directions to a place.").',
          },
        },
        required: ['emoji', 'name'],
      },
    },
    required: [
      'textEn',
      'textTh',
      'isLessonComplete',
      'expectsUserSpeech',
      'expectedSpeech',
    ],
  };
}

function trainingReplyJsonExample(withSpeechFlag: boolean): string {
  return withSpeechFlag
    ? '{"textEn":"...","textTh":"...","isLessonComplete":false,"expectsUserSpeech":true,"expectedSpeech":"latte"}'
    : '{"textEn":"...","textTh":"...","isLessonComplete":false}';
}

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
  /** Only present for lessons that expose a tap-to-continue button. */
  expectsUserSpeech?: boolean;
  /**
   * Exact English the learner should say this turn (STT bias).
   * Prefer a word or short phrase; may be a full pattern sentence when scripted.
   */
  expectedSpeech?: string;
  /** Multi-speaker Scene for Watch & Listen (Everyday Life, etc.). */
  scene?: {
    title?: string;
    lines: Array<{
      speaker: string;
      role: 'npc' | 'teacher';
      textEn: string;
      textTh?: string;
      voice?: string;
    }>;
  };
  /** In-chat Emoji Speak card (Stories vocab turns). */
  emojiSpeak?: {
    emoji: string;
    answer: string;
    hint?: string;
    index?: number;
    total?: number;
  };
  /** Full Emoji Speak batch — app runs locally without per-word AI turns. */
  emojiSpeakSet?: Array<{
    emoji: string;
    answer: string;
    hint?: string;
    index?: number;
    total?: number;
  }>;
  /** Visual emoji scaffolds while the learner speaks via mic. */
  emojiChoice?: {
    options: Array<{
      emoji: string;
      label?: string;
      speak: string;
    }>;
  };
  /** Guided Speaking — stem + single emoji for the learner to complete aloud. */
  guidedSpeaking?: {
    stem: string;
    emoji: string;
    label?: string;
    speak: string;
  };
  /** Roleplay Intro card (listen-only → tap Continue). */
  roleplayIntro?: {
    subtitle: string;
    npcEmoji: string;
    npcLabel: string;
    npcName?: string;
    userLabel?: string;
  };
  /** Active roleplay NPC chrome on staff turns. */
  roleplayNpc?: {
    emoji: string;
    name: string;
    objective?: string;
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
    /** Raw STT / spoken line before Thai Mix — damage is scored on this. */
    originalUserMessage?: string;
    languageLevel: FreeTalkLanguageLevel;
    phase?: FreeTalkPhase | string;
    topic?: string | null;
    nextAction?: FreeTalkNextAction | string | null;
    memories?: string[];
    remainingSeconds?: number | null;
    durationLimitSeconds?: number | null;
    userTurnIndex: number;
    grammarSuggestionsUsed: number;
    naturalnessSuggestionsUsed: number;
    grammarSuggestionMax: number;
    naturalnessSuggestionMax: number;
  }): Promise<{
    reply: FreeTalkTurnReply;
    suggestion: FreeTalkSuggestionGateResult;
  }> {
    const languageLevel = normalizeFreeTalkLanguageLevel(options.languageLevel);
    const rawSpoken = (options.originalUserMessage ?? options.userMessage).trim();
    const normalizedMeaning = options.userMessage.trim();
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
      'Always evaluate grammarDamage and naturalnessDamage on the RAW spoken line only. ' +
      'Put softRecastEn/softRecastTh only when damage is medium or high; textEn stays a normal chat reply. ' +
      'softRecast: MEDIUM = recast + speak-after-me + follow-up; ' +
      'HIGH = Almost! + one short tip why + model sentence to repeat + follow-up. No emojis, no lectures. ' +
      'Do not label mistakes in textEn. ' +
      (languageLevel === 'englishOnly'
        ? 'textEn must be English-only.'
        : 'HARD RULE: textEn must include Thai script AND English in one spoken line — never English-only textEn.');

    const contents: GeminiContent[] = [];
    const recent = options.history.slice(-10);
    const historyWithoutCurrentUser =
      recent.length > 0 && recent[recent.length - 1]?.speaker === 'user'
        ? recent.slice(0, -1)
        : recent;
    for (const turn of historyWithoutCurrentUser) {
      // Prefer original spoken line for prior user turns when available.
      const userLine =
        turn.speaker === 'user'
          ? (turn.originalTextEn?.trim() || turn.textEn)
          : turn.textEn;
      contents.push({
        role: turn.speaker === 'ai' ? 'model' : 'user',
        parts: [{ text: userLine }],
      });
    }

    const latestUserPrompt =
      rawSpoken === normalizedMeaning
        ? rawSpoken
        : 'Learner RAW spoken (score grammarDamage/naturalnessDamage on THIS only):\n' +
          `"${rawSpoken}"\n\n` +
          'Normalized meaning for intent only (Thai Mix — do NOT score damage on this):\n' +
          `"${normalizedMeaning}"`;

    contents.push({
      role: 'user',
      parts: [{ text: latestUserPrompt }],
    });

    let reply = await this.generateJson<FreeTalkTurnReply>({
      systemInstruction,
      contents,
      schema: FREE_TALK_REPLY_SCHEMA,
      maxOutputTokens: 550,
    });
    reply = this.normalizeFreeTalkReply(
      reply,
      options.phase ?? 'conversation_loop',
    );
    const evaluation = {
      grammarDamage: reply.grammarDamage,
      naturalnessDamage: reply.naturalnessDamage,
      issueNote: reply.issueNote,
      softRecastEn: reply.softRecastEn,
      softRecastTh: reply.softRecastTh,
    };
    reply = await this.enforceFreeTalkCodeSwitch(reply, languageLevel, {
      systemInstruction,
      priorContents: contents,
      learnerFirstName: undefined,
    });
    reply = { ...reply, ...evaluation };

    const suggestion = applyFreeTalkSuggestionGate({
      languageLevel,
      grammarDamage: normalizeFreeTalkDamage(reply.grammarDamage),
      naturalnessDamage: normalizeFreeTalkDamage(reply.naturalnessDamage),
      grammarSuggestionsUsed: options.grammarSuggestionsUsed,
      naturalnessSuggestionsUsed: options.naturalnessSuggestionsUsed,
      grammarMax: options.grammarSuggestionMax,
      naturalnessMax: options.naturalnessSuggestionMax,
      softRecastEn: reply.softRecastEn,
      softRecastTh: reply.softRecastTh,
      issueNote: reply.issueNote,
      learnerText: rawSpoken,
      userTurnIndex: options.userTurnIndex,
    });

    if (suggestion.applySoftRecast) {
      const softEn = this.stripEmojis(reply.softRecastEn?.trim() || '');
      const softTh = teacherBThaiVoice(
        this.stripEmojis(reply.softRecastTh?.trim() || softEn),
      );
      reply = {
        ...reply,
        textEn: softEn || reply.textEn,
        textTh: softTh || reply.textTh,
        nextAction: 'teach',
      };
      // Keep soft-recast meaning; only weave mix if needed (no full LLM rewrite).
      if (languageLevel !== 'englishOnly') {
        reply = this.weaveLanguageMix(reply, languageLevel);
      }
    }

    return {
      reply: this.toClientFreeTalkReply(reply),
      suggestion,
    };
  }

  async generateFreeTalkReport(
    history: ChatTurn[],
    durationSeconds: number,
    issueLog: FreeTalkIssueLogEntry[] = [],
  ): Promise<FreeTalkSessionSummary> {
    const context = this.formatHistoryForReport(history);
    const issueBlock = formatFreeTalkIssueLogForReport(issueLog);
    const report = await this.generateJson<FreeTalkSessionSummary>({
      systemInstruction: FREE_TALK_SUMMARY_PROMPT,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `Session duration: ${durationSeconds} seconds.\n` +
                `${issueBlock}\n\nConversation:\n${context}`,
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

    const grammarDamage = normalizeFreeTalkDamage(reply.grammarDamage);
    const naturalnessDamage = normalizeFreeTalkDamage(reply.naturalnessDamage);
    const needsSoftRecast =
      grammarDamage === 'medium' ||
      grammarDamage === 'high' ||
      naturalnessDamage === 'medium' ||
      naturalnessDamage === 'high';

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
      grammarDamage,
      naturalnessDamage,
      issueNote: reply.issueNote?.trim() || '',
      softRecastEn: needsSoftRecast
        ? this.stripEmojis(reply.softRecastEn?.trim() || '')
        : '',
      softRecastTh: needsSoftRecast
        ? teacherBThaiVoice(this.stripEmojis(reply.softRecastTh?.trim() || ''))
        : '',
    };
  }

  /** Strip internal evaluation fields before returning to the client path. */
  private toClientFreeTalkReply(reply: FreeTalkTurnReply): FreeTalkTurnReply {
    return {
      textEn: reply.textEn,
      textTh: reply.textTh,
      phase: reply.phase,
      nextAction: reply.nextAction,
      intent: reply.intent,
      emotion: reply.emotion,
      grammarNote: reply.grammarNote,
      topic: reply.topic,
      conversationDepth: reply.conversationDepth,
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
    const lang = teachingLanguageFromConfig(config);
    // Funny jab seeds are Thai-only (parked About Me lessons). Skip in English mode.
    const jabSeed =
      lang === 'thai' ? pickFunnyIntroJabSeed(config.lessonId) : null;
    const jabSeedLine = jabSeed
      ? `This session's funny jab seed: "${jabSeed}". ` +
        'Build Turn 1 jab FROM this seed — paraphrase freely in your own words. ' +
        'FORBIDDEN: copy any Tone example verbatim. One short Thai jab only, then teach vocab.\n\n'
      : '';
    const openingPrompt = renderOpeningPrompt(config, lang);
    const speechFlag = lessonUsesTapToContinue(config.lessonId);

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
                `${openingPrompt}\n\n` +
                jabSeedLine +
                'Respond with ONLY one JSON object: ' +
                `${trainingReplyJsonExample(speechFlag)}. ` +
                'No markdown. No prose outside JSON.',
            },
          ],
        },
      ],
      schema: buildTrainingReplySchema(speechFlag),
      maxOutputTokens: 512,
      temperature: jabSeed ? 0.85 : 0.4,
      recoverFromPlainText: (text) => this.recoverTrainingReplyFromPlainText(text),
    });
  }

  async generateTrainingTurn(
    config: LessonConfig,
    history: ChatTurn[],
    userMessage: string,
    currentTurn: number,
    learnerFirstName: string,
    /** Raw STT text shown in the app (before Thai-mix repair). */
    originalUserMessage?: string,
  ): Promise<TrainingTurnReply> {
    const contents: GeminiContent[] = [];
    const speechFlag = lessonUsesTapToContinue(config.lessonId);
    const displayTranscript = (originalUserMessage ?? userMessage).trim();

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
                    // Replay what the app really showed: claiming every past
                    // turn wanted speech taught the model to keep asking.
                    ...(speechFlag
                      ? { expectsUserSpeech: turn.expectsUserSpeech ?? true }
                      : {}),
                    ...(turn.scene ? { scene: turn.scene } : {}),
                    ...(turn.emojiSpeak
                      ? { emojiSpeak: turn.emojiSpeak }
                      : {}),
                    ...(turn.emojiChoice
                      ? { emojiChoice: turn.emojiChoice }
                      : {}),
                    ...(turn.guidedSpeaking
                      ? { guidedSpeaking: turn.guidedSpeaking }
                      : {}),
                    ...(turn.roleplayIntro
                      ? { roleplayIntro: turn.roleplayIntro }
                      : {}),
                    ...(turn.roleplayNpc
                      ? { roleplayNpc: turn.roleplayNpc }
                      : {}),
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
            `${this.trainingUserTurnPayload(
              userMessage,
              config,
              history,
              displayTranscript,
            )}\n\n` +
            'Respond with ONLY one JSON object: ' +
            `${trainingReplyJsonExample(speechFlag)}. ` +
            'No markdown. No prose outside JSON.',
        },
      ],
    });

    const reply = await this.generateJson<TrainingTurnReply>({
      systemInstruction: this.trainingSystemPrompt(
        config,
        currentTurn,
        learnerFirstName,
      ),
      contents,
      schema: buildTrainingReplySchema(speechFlag),
      maxOutputTokens: 600,
      temperature: 0.4,
      recoverFromPlainText: (text) =>
        this.recoverTrainingReplyFromPlainText(text),
    });

    if (
      userMessage === TAP_TO_CONTINUE_TURN_TEXT ||
      userMessage === EMOJI_SPEAK_COMPLETE_TURN_TEXT
    ) {
      return {
        ...reply,
        textEn: this.stripPraiseOpener(reply.textEn),
        textTh: this.stripPraiseOpener(reply.textTh),
      };
    }

    return reply;
  }

  /** Praise openers, longest first so "เยี่ยมเลย" wins over "เยี่ยม". */
  private static readonly PRAISE_OPENERS: string[] = [
    'ทำได้ดีมาก',
    'ยอดเยี่ยม',
    'เยี่ยมเลย',
    'เยี่ยมมาก',
    'เกือบเป๊ะแล้ว',
    'เกือบครบแล้ว',
    'ใกล้เคียงแล้ว',
    'เข้าใจได้เลย',
    'ใช้ได้เลย',
    'ผ่านไปได้เลย',
    'เครื่องติดแล้ว',
    'ไปได้สวยเลย',
    'ตอบต่อเนื่องเลย',
    'จังหวะกำลังดีเลย',
    'คล่องขึ้นเรื่อย',
    'รอบนี้เป๊ะติดกันเลย',
    'ไปต่อแบบนี้เลย',
    'จบบทนี้เรียบร้อย',
    'ผ่านอีกหนึ่งบทแล้ว',
    'เกือบเป๊ะ',
    'ใกล้เคียง',
    'ทำได้ดี',
    'เก่งมาก',
    'เก่งจริง',
    'สุดยอด',
    'เป๊ะเลย',
    'ใช่เลย',
    'ถูกต้อง',
    'แจ๋วเลย',
    'ลื่นมาก',
    'ลื่นเลย',
    'ก็ใช้ได้',
    'ใกล้แล้ว',
    'อีกนิดเดียว',
    'ดีมาก',
    'ดีเลย',
    'ดีจัง',
    'เยี่ยม',
    'เป๊ะ',
    'แจ๋ว',
    'excellent',
    'fantastic',
    'wonderful',
    'great job',
    'great work',
    'nice work',
    'good job',
    'nice job',
    'well done',
    'beautiful',
    'brilliant',
    'awesome',
    'perfect',
    'lovely',
    'great',
    'nice',
    'good',
  ];

  /** Exact match / clear success — rotate; never spam the same line twice in a row. */
  private static readonly THAI_SUCCESS_PRAISE = [
    'ใช่เลยครับ!',
    'ถูกต้องครับ!',
    'เป๊ะเลยครับ!',
    'เยี่ยมเลยครับ!',
    'เยี่ยมมากครับ!',
    'ดีมากครับ!',
    'ดีเลยครับ!',
    'เก่งมากครับ!',
    'ทำได้ดีมากครับ!',
    'ยอดเยี่ยมครับ!',
    'แจ๋วเลยครับ!',
    'สุดยอดครับ!',
  ];

  /**
   * Optional after Success (~30–50% of advances, or when changing section).
   * Never alone — always after a Success line. Never after Soft Accept.
   */
  private static readonly THAI_TRANSITION_PRAISE = [
    'ไปต่อกันเลยครับ!',
    'อีกข้อหนึ่งนะครับ 😊',
    'มาลองอีกข้อกันครับ!',
    'คราวนี้ลองอีกแบบดูครับ!',
    'ต่อกันเลยครับ!',
    'ลองต่ออีกนิดครับ!',
    'มาอีกข้อครับ!',
    'พร้อมลุยข้อต่อไปไหมครับ?',
  ];

  /**
   * Soft-accept near-miss — tone is "usable / close", not full celebration.
   * Detail (e.g. eat → ate) belongs in UI / เฉลย, not in the spoken praise.
   */
  private static readonly THAI_SOFT_ACCEPT_PRAISE = [
    'เกือบเป๊ะแล้วครับ!',
    'ใกล้เคียงแล้วครับ!',
    'ใช้ได้เลยครับ!',
    'ก็ใช้ได้ครับ!',
    'ผ่านไปได้เลยครับ!',
    'อีกนิดเดียวครับ!',
    'เกือบครบแล้วครับ!',
    'เข้าใจได้เลยครับ!',
    'ใกล้แล้วครับ!',
    'ลองอีกนิดนะครับ!',
  ];

  /** 3+ clear successes in a row — use sparingly (not every streak turn). */
  private static readonly THAI_STREAK_PRAISE = [
    'เครื่องติดแล้วครับ! 🔥',
    'ลื่นเลยครับ!',
    'ไปได้สวยเลยครับ!',
    'ตอบต่อเนื่องเลยนะครับ!',
    'จังหวะกำลังดีเลยครับ!',
    'คล่องขึ้นเรื่อย ๆ แล้วครับ!',
    'รอบนี้เป๊ะติดกันเลย!',
    'ไปต่อแบบนี้เลยครับ!',
  ];

  /** Lesson / chapter wrap — one short line; name at most once. */
  private static readonly THAI_LESSON_COMPLETE_PRAISE = [
    'เยี่ยมมากครับ! วันนี้คุณทำได้แล้ว 🎉',
    'จบบทนี้เรียบร้อยครับ!',
    'เก่งมากครับ! ไปอีกหนึ่งก้าวแล้ว',
    'เยี่ยมเลยครับ! พร้อมบทต่อไปไหม?',
    'สุดยอดครับ! วันนี้ฝึกได้ดีมาก',
    'ผ่านอีกหนึ่งบทแล้วครับ 🍌',
  ];

  private thaiPraiseVarietyRule(): string {
    const success = GeminiChatService.THAI_SUCCESS_PRAISE.join(' / ');
    const transition = GeminiChatService.THAI_TRANSITION_PRAISE.join(' / ');
    const soft = GeminiChatService.THAI_SOFT_ACCEPT_PRAISE.join(' / ');
    const streak = GeminiChatService.THAI_STREAK_PRAISE.join(' / ');
    const complete = GeminiChatService.THAI_LESSON_COMPLETE_PRAISE.join(' / ');
    return `Praise pools (Thai teaching mode) — pick the RIGHT pool; rotate within it; do NOT reuse the same line as the previous AI turn:

1) SUCCESS (clear / exact match) — open with ONE line from:
   ${success}
   Then optionally (~30–50% of advances, especially when moving to the next item/section) append ONE Transition line from:
   ${transition}
   Example OK: "เป๊ะเลยครับ! ไปต่อกันเลยครับ 😊"
   FORBIDDEN: Transition alone with no Success first. FORBIDDEN: English praise (Perfect! / Great! / Nice!).

2) SOFT ACCEPT (near-miss accepted → advance) — ONE line from:
   ${soft}
   Spoken line stays short. Canonical English / eat→ate style tips go in UI or a separate เฉลย beat — do NOT lecture in the praise opener.
   FORBIDDEN: appending a Transition line on the same Soft Accept turn.
   FORBIDDEN: using Success-pool celebration (เป๊ะเลย / ยอดเยี่ยม) for soft-accept.

3) STREAK (3+ clear successes in a row) — occasionally replace Success with ONE line from:
   ${streak}
   Use sparingly so it stays special. Reset streak after soft-accept or miss.

4) LESSON COMPLETE (isLessonComplete / Celebrate) — ONE line from:
   ${complete}
   Keep it one short beat; learner first name at most once.

Keep praise to one short clause (or Success + optional Transition) — then continue teaching.`;
  }

  private static readonly PRAISE_OPENER_RE = (() => {
    const openers = GeminiChatService.PRAISE_OPENERS.map((p) =>
      p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    ).join('|');
    const stem = `(?:${openers})(?:เลย|มาก)?`;
    const punct = '[!！?？.,…\\-—]';
    // The praise must be its own clause: a Thai particle, or punctuation.
    // Whitespace alone is not enough or "Good morning" loses its "Good".
    return new RegExp(
      `^(?:\\s*(?:${stem}(?:ครับ|ค่ะ)\\s*${punct}*\\s*|${stem}\\s*${punct}+\\s*))+`,
      'i',
    );
  })();

  /**
   * A Continue tap is not a spoken attempt, so praising it is nonsense.
   * The prompt forbids it; this is the deterministic backstop.
   */
  private stripPraiseOpener(text: string | undefined): string {
    if (!text) return text ?? '';
    const stripped = text
      .replace(GeminiChatService.PRAISE_OPENER_RE, '')
      .trimStart();
    if (!stripped) return text;
    return stripped.charAt(0).toUpperCase() === stripped.charAt(0)
      ? stripped
      : stripped.charAt(0).toUpperCase() + stripped.slice(1);
  }

  /** Drop trailing duplicate of the current user message from stored history. */
  private priorTurnsForModel(
    history: ChatTurn[],
    userMessage: string,
    limit: number,
  ): ChatTurn[] {
    const prior = history.slice(-limit);
    const last = prior[prior.length - 1];
    if (
      last?.speaker === 'user' &&
      this.normalizeSpeechText(last.textEn) ===
        this.normalizeSpeechText(userMessage)
    ) {
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
    // house (Home quiz) — STT often mangles this short word
    hals: 'house',
    hows: 'house',
    haus: 'house',
    houes: 'house',
    hous: 'house',
    // school / office (Work & School quiz)
    schol: 'school',
    scool: 'school',
    skol: 'school',
    ofice: 'office',
    offis: 'office',
    ofis: 'office',
    // pets quiz
    kat: 'cat',
    catt: 'cat',
    kit: 'cat',
    dag: 'dog',
    doug: 'dog',
    dug: 'dog',
    ped: 'pet',
    pate: 'pet',
    // people quiz / jobs
    fonny: 'funny',
    funy: 'funny',
    fanny: 'funny',
    bussy: 'busy',
    bizi: 'busy',
    enginer: 'engineer',
    enginner: 'engineer',
    injineer: 'engineer',
    desiner: 'designer',
    disigner: 'designer',
    // friends / social
    hangout: 'hang out',
    hungout: 'hang out',
    eatout: 'eat out',
    // weather
    sany: 'sunny',
    suny: 'sunny',
    sonny: 'sunny',
    rany: 'rainy',
    rainny: 'rainy',
    wether: 'weather',
    wheather: 'weather',
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

  /**
   * True when the latest tutor turn is already in AI Conversation / roleplay,
   * so a taught-phrase match must NOT restart Vocabulary / Pattern Drill.
   */
  private looksLikeMissionOrRoleplayTurn(history: ChatTurn[]): boolean {
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      if (turn.speaker !== 'ai') continue;
      const text = `${turn.textEn} ${turn.textTh ?? ''}`;
      return /สถานการณ์|สมมติว่า|roleplay|mission|จริงกัน|Can I help you|What can I get for you|Hello!\s*Can I|ยินดีต้อนรับ|พนักงานทัก|จะตอบว่า|NPC|barista|cashier|server|receptionist|Small or large|What size\?/i.test(
        text,
      );
    }
    return false;
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
        const maxDist = this.maxEditDistanceForWord(target);
        if (this.editDistanceAtMost(normalized, target, maxDist)) {
          return phrase;
        }
      }
    }

    return null;
  }

  /**
   * Length-scaled near-miss budget for single-token answers:
   * ≤3 → 1 · 4–5 → 2 · ≥6 → 3
   */
  private maxEditDistanceForWord(target: string): number {
    const len = target.length;
    if (len <= 3) return 1;
    if (len <= 5) return 2;
    return 3;
  }

  /** True if Levenshtein distance(a, b) ≤ maxDist (early-exit when exceeding). */
  private editDistanceAtMost(a: string, b: string, maxDist: number): boolean {
    if (a === b) return true;
    if (maxDist <= 0) return false;
    if (Math.abs(a.length - b.length) > maxDist) return false;

    const prev = new Array<number>(b.length + 1);
    const curr = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + cost,
        );
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > maxDist) return false;
      for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }

    return prev[b.length] <= maxDist;
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
      .filter(
        (turn) =>
          turn.speaker === 'user' &&
          turn.textEn !== TAP_TO_CONTINUE_TURN_TEXT &&
          turn.textEn !== EMOJI_SPEAK_COMPLETE_TURN_TEXT,
      )
      .slice(-limit)
      .map((turn) => turn.textEn);
  }

  private trainingUserTurnPayload(
    userMessage: string,
    config: LessonConfig,
    history: ChatTurn[],
    displayTranscript: string = userMessage,
  ): string {
    const lang = teachingLanguageFromConfig(config);

    if (userMessage === TAP_TO_CONTINUE_TURN_TEXT) {
      return `Learner action: they tapped the Continue button. There is no transcript because they were not asked to speak.

MATCH RESULT: NOT APPLICABLE — a button press is not a spoken attempt. They have said NOTHING yet.
Required response:
- START your line with the content of the NEXT Core Flow step ONLY. No opener before it.
- Do ONE Core Flow step — never combine Tip with Repeat/Practice in the same turn.
- If the next step is Tip / Rhythm Tip / Speaking Tip: give ONLY the tip sentence, then stop. FORBIDDEN: "Your turn" / "ตาคุณแล้ว" / "Please say" / any speaking task. expectsUserSpeech = false.
- FORBIDDEN first words: เยี่ยม / เยี่ยมเลยครับ / ดีมาก / เก่งมาก / สุดยอด / Great / Nice / Good job / Perfect / Well done — there is nothing to praise.
- FORBIDDEN wording that implies they already spoke: คราวนี้ / อีกครั้ง / ลองใหม่ / this time / now try again.
- Do NOT evaluate, correct, or repeat the button press.`;
    }

    if (userMessage === EMOJI_SPEAK_COMPLETE_TURN_TEXT) {
      return `Learner action: they finished the local Emoji Speak vocab warm-up (all words done in the app). There is no transcript.

MATCH RESULT: NOT APPLICABLE — not a spoken attempt.
Required response for Stories 3.1 (Yesterday):
- START Pattern Challenge 1 — Tell ข้อที่ 1 IMMEDIATELY.
- Cue them to say: "I ate breakfast this morning." (expectedSpeech exactly that).
- expectsUserSpeech = true. Omit emojiSpeak and emojiSpeakSet.
- FORBIDDEN: repeating the Intro "ทายคำศัพท์" listen turn; returning emojiSpeakSet; another listen-only warm-up; praising a button.
- START with the speaking cue only — no praise opener.`;
    }

    // Match the repaired text and the raw STT shown in the app — either counts.
    const matched =
      this.matchTargetPhrase(userMessage, config.targetPhrases) ??
      (displayTranscript !== userMessage
        ? this.matchTargetPhrase(displayTranscript, config.targetPhrases)
        : null);

    if (config.coachOnly) {
      const matchNote = matched
        ? `transcript confirms they said something close to "${matched}" — but Whisper cannot measure stress or rhythm`
        : `transcript does not clearly match a target phrase — still do NOT fail them on stress/rhythm`;
      return lang === 'english'
        ? `Learner transcript (exact STT text shown in the app): "${displayTranscript}"

COACH MODE: ${matchNote}.
Required response:
- Speak in clear simple English (English teaching mode). Thai only as a short optional meaning cue.
- Give ONE short coach tip about stress/rhythm (e.g. "Try making the first syllable a bit louder." / "Nice — now soften the last syllable.").
- ADVANCE immediately to the NEXT item — never ask them to repeat the same one.
- FORBIDDEN: saying they passed/failed stress, inventing pronunciation problems from text, retry loops`
        : `Learner transcript (exact STT text shown in the app): "${displayTranscript}"

COACH MODE: ${matchNote}.
Required response:
- Speak MOSTLY in Thai (beginner tutor). English only for the next target phrase if modeling it.
- Give ONE short coach tip about stress/rhythm (e.g. "ลองเน้นพยางค์แรกให้ชัดขึ้นอีกนิดครับ" / "ดีขึ้นแล้ว ลองลดเสียงคำหลังลง").
- ADVANCE immediately to the NEXT item — never ask them to repeat the same one.
- FORBIDDEN: saying they passed/failed stress, inventing pronunciation problems from text, ลองอีกที, retry loops`;
    }

    if (matched) {
      const normalized = this.normalizeSpeechText(displayTranscript);
      const nearMiss =
        normalized !== this.normalizeSpeechText(matched);
      const inMission = this.looksLikeMissionOrRoleplayTurn(history);
      if (inMission) {
        return lang === 'english'
          ? `Learner transcript (exact STT text shown in the app): "${displayTranscript}"
Normalized (case + punctuation stripped): "${normalized}"

MATCH RESULT: SUCCESS for the mission/roleplay reply — they used taught language close to "${matched}".
Required response:
- Continue the AI Conversation / roleplay as the NPC or scene partner (short reply + optional follow-up question in-character).
- textEn MUST be ENGLISH ONLY (NPC voice). textTh = full Thai translation for subtitle toggle.
- Brief praise OK.
- FORBIDDEN: restarting Vocabulary, Pattern Drill, "try saying…", or "ถ้าจะ… จะพูดว่าอะไร?" style teaching questions.
- FORBIDDEN: going backward in the Core Flow. Mission stays in mission until Wrap-up.
- Reusing a sentence from earlier practice is GOOD here — treat it as a valid mission answer, not a drill retry.`
          : `Learner transcript (exact STT text shown in the app): "${displayTranscript}"
Normalized (case + punctuation stripped): "${normalized}"

MATCH RESULT: SUCCESS สำหรับคำตอบในสถานการณ์จริง — ผู้เรียนใช้ภาษาที่เรียนมาใกล้เคียง "${matched}"
Required response:
- คุยต่อใน AI Conversation / roleplay เป็น NPC หรือคู่สนทนา
- textEn MUST be ENGLISH ONLY (NPC voice). textTh = คำแปลไทยเต็มของบรรทัดนั้น (เปิดปุ่ม Thai Subtitle ได้)
- ชมสั้นๆ ได้ในภาษาอังกฤษ
- FORBIDDEN: ย้อนกลับไป Vocabulary / Pattern Drill / "ลองพูดว่า…" / คำถามแบบ "ถ้าจะ… จะพูดว่าอะไร?"
- FORBIDDEN: ใส่ภาษาไทยใน textEn ระหว่าง AI Conversation
- FORBIDDEN: เดิน Core Flow ย้อนกลับ — อยู่ mission จน Wrap-up
- การนำประโยคที่เพิ่งฝึกมาใช้ในสถานการณ์ = สำเร็จ ไม่ใช่สัญญาณให้สอนซ้ำ`;
      }

      return lang === 'english'
        ? `Learner transcript (exact STT text shown in the app): "${displayTranscript}"
Normalized (case + punctuation stripped): "${normalized}"

MATCH RESULT: SUCCESS — "${normalized}" matches the taught phrase "${matched}"${nearMiss ? ' (close pronunciation / STT variant — treat as correct)' : ' (exact after normalize)'}.
Case and punctuation NEVER count as wrong ("Seat.", "SEAT", "seat" are all SUCCESS for "seat").
Required response:
- Speak in clear simple English (English teaching mode). Thai only as a short optional meaning cue.
- Brief English praise (e.g. Great! / Nice work!)
- ADVANCE immediately to the NEXT Core Flow milestone ONLY (forward one-way — never revisit Vocabulary or Pattern Drill already completed)
- FORBIDDEN: asking to repeat "${matched}" again, inventing pronunciation or "said it twice" issues, treating capital letters or a trailing period as a mistake, looping on the same teaching ask`
        : `Learner transcript (exact STT text shown in the app): "${displayTranscript}"
Normalized (case + punctuation stripped): "${normalized}"

MATCH RESULT: SUCCESS — "${normalized}" matches the taught phrase "${matched}"${nearMiss ? ' (close pronunciation / STT variant — treat as correct)' : ' (exact after normalize)'}.
ตัวพิมพ์เล็ก/ใหญ่ และเครื่องหมายวรรคตอนไม่นับว่าผิด ("Seat.", "SEAT", "seat" = สำเร็จทั้งหมดสำหรับ "seat")
Required response:
- Speak MOSTLY in Thai (beginner tutor). English only for the next target phrase if modeling it.
- Brief Thai praise only — SUCCESS pool (rotate; optional Transition after ~30–50%). Do NOT reuse the same praise as the previous successful turn; do NOT praise in English ("Perfect!", "Great!")
- ADVANCE immediately to the NEXT Core Flow milestone ONLY (เดินหน้าอย่างเดียว — ห้ามย้อนกลับไป Vocabulary / Pattern Drill ที่จบแล้ว)
- FORBIDDEN: full-English lines, โอ๊ะ, เกือบใช่, almost, ลองอีกที, asking to repeat "${matched}" again, inventing pronunciation or "said it twice" issues, treating capital letters or a trailing period as a mistake, looping on the same teaching ask`;
    }

    const recentUsers = this.recentUserMessages(history, 2);
    const consecutiveMisses =
      recentUsers.length >= 2 &&
      recentUsers.every(
        (msg) => !this.matchTargetPhrase(msg, config.targetPhrases),
      );

    const inMission = this.looksLikeMissionOrRoleplayTurn(history);
    if (inMission) {
      return lang === 'english'
        ? `Learner transcript (exact STT text shown in the app): "${displayTranscript}"

MATCH RESULT: NO CLEAR MATCH during AI Conversation / mission.
Required response:
- Soft-teach ONE better line briefly in ENGLISH in textEn (e.g. "You can say: Can I get an iced latte?").
- textTh = full Thai translation of that English tip/line.
- Then CONTINUE the mission as NPC in ENGLISH (next follow-up or short confirm → Wrap-up) — do NOT ask them to retry the same mission question.
- FORBIDDEN: Thai in textEn, "try again", repeating the same NPC ask, returning to Vocabulary / Pattern Drill.`
        : `Learner transcript (exact STT text shown in the app): "${displayTranscript}"

MATCH RESULT: NO CLEAR MATCH ระหว่าง AI Conversation / mission
Required response:
- Soft-teach ประโยคที่ดีกว่าสั้นๆ ครั้งเดียว — textEn เป็น ENGLISH ONLY (เช่น "You can say: Can I get an iced latte?")
- textTh = คำแปลไทยเต็มของบรรทัดนั้น (เปิดปุ่ม Thai Subtitle ได้)
- แล้วไปต่อใน mission ทันทีเป็น NPC ภาษาอังกฤษ (ถามต่อหรือยืนยันสั้นๆ → Wrap-up) — ห้ามให้ลองตอบคำถาม mission เดิมซ้ำ
- FORBIDDEN: ใส่ภาษาไทยใน textEn, ลองอีกที, วนถาม NPC เดิม, ย้อนกลับไป Vocabulary / Pattern Drill`;
    }

    if (consecutiveMisses) {
      return lang === 'english'
        ? `Learner transcript (exact STT text shown in the app): "${displayTranscript}"

MATCH RESULT: NO MATCH — but this is the learner's SECOND consecutive attempt without a match on the current item.
Required response:
- Do NOT ask for the same number/phrase again — maximum one retry already used.
- Accept generously (e.g. "No worries — let's keep going.") and ADVANCE immediately to the NEXT Core Flow step with a NEW teaching/speaking task.
- FORBIDDEN: "try again" loops, repeating the same ask, looping on the same word.`
        : `Learner transcript (exact STT text shown in the app): "${displayTranscript}"

MATCH RESULT: NO MATCH — but this is the learner's SECOND consecutive attempt without a match on the current item.
Required response:
- Do NOT ask for the same number/phrase again — maximum one retry already used.
- Accept generously (e.g. "ไม่เป็นไรครับ ไปต่อกัน") and ADVANCE immediately to the NEXT Core Flow step with a NEW teaching/speaking task.
- FORBIDDEN: ลองอีกที, repeat the same ask, looping on the same word.`;
    }

    return lang === 'english'
      ? `Learner transcript (exact STT text shown in the app): "${displayTranscript}"

MATCH RESULT: NO MATCH yet on the current speaking task.
Required response:
- You may give at most ONE gentle retry with brief English feedback — then you MUST advance regardless.
- FORBIDDEN: asking for the same item more than twice total.`
      : `Learner transcript (exact STT text shown in the app): "${displayTranscript}"

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
    const lang = teachingLanguageFromConfig(config);
    const englishHeavy = lang === 'english';
    const lessonInstruction = buildLessonSystemInstruction(config, lang);

    const speechFlagBlock = lessonUsesTapToContinue(config.lessonId)
      ? `
Tap-to-continue (this lesson only):
- The app shows a Continue button whenever expectsUserSpeech is false, and the mic when it is true. The learner can always see it.
- expectsUserSpeech: true when your turn asks the learner to SAY a word or phrase out loud.
- expectsUserSpeech: false when your turn is listen-only — Situation, Scene / Watch & Listen, or Wrap-up.
- expectedSpeech: if you ask them to say a specific word, short phrase, or scripted pattern sentence, set expectedSpeech to that exact English target (e.g. "latte", "boarding pass", "Go straight.", "I'm looking for pants."). If you ask for open free recall, or listen-only, set expectedSpeech to "".
- NEVER mention the button in textEn or textTh. Do not write "Tap Continue", "แตะเพื่อไปต่อ", "press the button", or any variation. Do not ask them to say "Ready" or "OK" either. A listen-only turn simply ends after its content — that is allowed, and the button is the learner's next action.
- A learner message of "${TAP_TO_CONTINUE_TURN_TEXT}" is a button press, not speech. Never praise, evaluate, or repeat it — just move straight to the next step.
- A learner message of "${EMOJI_SPEAK_COMPLETE_TURN_TEXT}" means the app finished the local Emoji Speak batch. Go straight to Pattern Challenge 1 (speak). FORBIDDEN: re-opening Intro / emojiSpeakSet.
- On the final turn (isLessonComplete true), set expectsUserSpeech false.

Scene / Watch & Listen (when the Core Flow calls for a short model dialogue):
- Return a "scene" object with "lines": each line has speaker (display name), role ("npc" | "teacher"), textEn (that speaker's English line), textTh (Thai translation of that same line), and optional voice.
- EVERY scene line MUST include textTh so the learner can open Thai subtitles.
- Voice map: teacher lines omit voice or use "Sadachbia"; female NPC use "Aoede"; male NPC use "Puck".
- textEn should be a SHORT one-line summary for history (e.g. "Watch this short coffee-shop dialogue.") — do NOT paste the full script into textEn.
- expectsUserSpeech must be false on Scene turns.
- Omit "scene" on non-Scene turns.

Emoji Speak (when the Core Flow delivers a vocab warm-up batch):
- Prefer "emojiSpeakSet": [ { emoji, answer, hint, index, total }, ... ] on ONE Intro listen turn (expectsUserSpeech false). The app runs every item locally.
- Example Stories 3.1 set (4 words): yesterday / breakfast / last night / work.
- Do NOT return per-word emojiSpeak turns after delivering emojiSpeakSet.
- FORBIDDEN: emojiSpeak / emojiSpeakSet on Pattern Challenge / Hook / Celebrate turns.
`
      : '';

    const textEnJsonHint = englishHeavy
      ? 'textEn: spoken Teacher B line — MOSTLY ENGLISH; keep Thai light/optional; must end with the learner\'s next action unless completing'
      : 'textEn: spoken Teacher B line — MOSTLY THAI; include the English target phrase only where the learner should hear/say it; must end with the learner\'s next action unless completing';

    return `${lessonInstruction}

Learner first name: ${learnerFirstName}
(Use this name sparingly — once in opening, occasionally when encouraging, once near the ending. Never every turn. Never address a group.)

Target phrases:
${phrases}

Language mix target: ~${config.languageMix.thai}% Thai / ~${config.languageMix.english}% English.
(This mix comes from the learner's Lesson Language setting.)

Teaching mix 70/20/10 (applies to EVERY lesson — do NOT only use "พูดตาม" / "Repeat after me"):
- ~70% Repeat: model a phrase, then ask the learner to say it after you (pronunciation + confidence).
- ~20% Recognition: short choice or guided use — e.g. pick which phrase fits a situation, or greet you in a given style (learner thinks; answer stays short).
- ~10% Recall: near the end, ask the learner to use a taught phrase freely (no fixed script; accept any clear taught variant).
- Never run a whole lesson as repeat-only. After a few repeats, insert recognition. End with free recall before celebrate.
- If this lesson defines a Core Flow, treat those as progression milestones — not a fixed turn count. Retries/feedback may insert extra turns between milestones.

Acceptance rules (critical — prevent retry loops):
- You only see the learner's transcript TEXT, not audio. Never invent pronunciation, length, speed, or "said it twice" issues from text alone.
- If the transcript clearly contains the expected phrase (ignore case/punctuation; "Hi", "hi", "Hi!", "Seat.", "seat" all count), treat as SUCCESS and ADVANCE to the next step. Do not ask to repeat the same phrase again.
- Never say "เกือบใช่" / "almost" / "ลองอีกที" when the transcript already matches the target — capital letters and trailing periods are NOT mistakes.
- Maximum ONE retry per phrase. After that retry (or if still unclear), accept generously and move on — do not loop the same phrase a third time.
- Prefer progress and confidence over perfection.

${this.thaiPraiseVarietyRule()}

Turn ${currentTurn} of ${config.maxTurns} (${remaining} turns remaining).
${speechFlagBlock}
Critical turn-loop rule:
- If isLessonComplete is false, textEn MUST end with a clear next action for the learner (repeat, recognition choice/guided use, or free recall). Never return explanation/praise only.${
      speechFlagBlock
        ? '\n- EXCEPTION: on a listen-only turn (expectsUserSpeech false) the Continue button is the next action, so end after the content and ask for nothing.'
        : ''
    }
- Always follow the 70/20/10 mix above for this lesson.
- After a successful learner reply, the next action must be a NEW step — not the same phrase again.
- Core Flow is ONE-WAY only: never revisit an earlier milestone (e.g. do not return to Vocabulary / Pattern Drill after AI Conversation has started).
- If the learner reuses a practiced sentence during AI Conversation / roleplay, that is SUCCESS — continue the scene as NPC; do not re-drill.

Return JSON ONLY (critical — never reply with bare prose):
- Output a single JSON object and nothing else. No markdown fences.
- ${textEnJsonHint}
- textTh: short Thai support line / paraphrase
- isLessonComplete: true ONLY on the Summary + Celebrate core step (required to finish). Otherwise false${
      speechFlagBlock
        ? '\n- expectsUserSpeech: false when this turn is listen-only or a ready check, true when you ask the learner to speak\n- expectedSpeech: when expectsUserSpeech is true AND they should say a specific word / short phrase / scripted sentence, set it to that exact English (e.g. "latte", "boarding pass", "I\'m going to Chiang Mai."). When the ask is open free recall or listen-only, set expectedSpeech to ""\n- scene: optional; include only on Watch & Listen Scene turns (see rules above)\n- emojiSpeakSet: optional full puzzle batch on Intro listen turns; emojiSpeak: optional single card (prefer set for Stories)\n- emojiChoice: optional { options:[{ emoji, label?, speak }] } on speak turns that need visual emoji scaffolds (Shopping Mini Challenge / size). Omit on listen-only, emojiSpeak, and Celebrate. Never use emojiChoice instead of emojiSpeak puzzles.\n- guidedSpeaking: optional { stem, emoji, label?, speak } on Guided Speaking turns (sentence stem + single emoji). Omit on listen-only / emojiChoice / Celebrate. Never combine guidedSpeaking with emojiChoice on the same turn.\n- roleplayIntro: optional { subtitle, npcEmoji, npcLabel, npcName?, userLabel? } on Roleplay Intro listen-only turns (tap Continue). Omit on speak / Celebrate.\n- roleplayNpc: optional { emoji, name } on Roleplay staff/NPC turns (chat chrome). Omit on Teacher / Celebrate / Intro.'
        : ''
    }`;
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
