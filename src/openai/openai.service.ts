import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  BROTHER_BANANA_PERSONA,
  conversationSystemPrompt,
  HINTS_PROMPT,
  openingUserPrompt,
  REPORT_PROMPT,
  THAI_MIX_PROMPT,
} from '../topics/topics.data';
import {
  INTRO_TOPIC_CONTEXT,
  introReplyInstruction,
} from '../topics/intro_script';
import { ChatTurn } from '../session-store/session-store.service';
import {
  GptReply,
  GptReport,
  HintOption,
  HintsResponse,
} from '../common/api.types';

const REPLY_SCHEMA = {
  type: 'object' as const,
  properties: {
    textEn: { type: 'string' },
    textTh: { type: 'string' },
  },
  required: ['textEn', 'textTh'],
  additionalProperties: false,
};

const HINTS_SCHEMA = {
  type: 'object' as const,
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
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['hints'],
  additionalProperties: false,
};

const REPORT_SCHEMA = {
  type: 'object' as const,
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
        additionalProperties: false,
      },
    },
  },
  required: ['feedbackEn', 'feedbackTh', 'grammarTip', 'vocab'],
  additionalProperties: false,
};

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  async correctThaiMix(transcript: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: THAI_MIX_PROMPT },
        { role: 'user', content: transcript },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });
    return (response.choices[0].message.content ?? transcript).trim();
  }

  async generateOpening(topicId: string): Promise<GptReply> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: conversationSystemPrompt(topicId) },
        { role: 'user', content: openingUserPrompt(topicId) },
        {
          role: 'system',
          content:
            'Respond as Brother Banana. Return JSON with textEn (English greeting) ' +
            'and textTh (Thai translation). Keep textEn to 1-2 short sentences.',
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'opening', schema: REPLY_SCHEMA },
      },
      max_tokens: 200,
      temperature: 0.7,
    });
    return JSON.parse(response.choices[0].message.content ?? '{}') as GptReply;
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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const turn of history.slice(-10)) {
      messages.push({
        role: turn.speaker === 'ai' ? 'assistant' : 'user',
        content: turn.textEn,
      });
    }

    messages.push({ role: 'user', content: userMessage });

    const replyGuide =
      topicId === 'intro'
        ? introReplyInstruction(userTurnCount)
        : 'Respond as Teacher B (ครูพี่บี). Return JSON with textEn (English reply) ' +
          'and textTh (Thai translation). Keep textEn to 1-2 short sentences.';

    messages.push({ role: 'system', content: replyGuide });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'reply', schema: REPLY_SCHEMA },
      },
      max_tokens: topicId === 'intro' ? 350 : 200,
      temperature: 0.7,
    });
    return JSON.parse(response.choices[0].message.content ?? '{}') as GptReply;
  }

  async generateHints(history: ChatTurn[]): Promise<HintOption[]> {
    const context = this.formatHistory(history);
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: HINTS_PROMPT },
        { role: 'user', content: `Conversation so far:\n${context}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'hints', schema: HINTS_SCHEMA },
      },
      max_tokens: 400,
      temperature: 0.7,
    });
    const result = JSON.parse(
      response.choices[0].message.content ?? '{}',
    ) as HintsResponse;
    return result.hints;
  }

  async generateReport(
    history: ChatTurn[],
    durationSeconds: number,
  ): Promise<GptReport> {
    const context = this.formatHistory(history);
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: REPORT_PROMPT },
        {
          role: 'user',
          content: `Session duration: ${durationSeconds} seconds.\nConversation:\n${context}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'report', schema: REPORT_SCHEMA },
      },
      max_tokens: 600,
      temperature: 0.7,
    });
    return JSON.parse(
      response.choices[0].message.content ?? '{}',
    ) as GptReport;
  }

  private formatHistory(history: ChatTurn[]): string {
    if (history.length === 0) return '(no conversation yet)';
    return history
      .map((turn) => {
        const speaker = turn.speaker === 'ai' ? 'Brother Banana' : 'Learner';
        return `${speaker}: ${turn.textEn}`;
      })
      .join('\n');
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    const trimmed = text.trim();
    if (!trimmed) {
      return Buffer.alloc(0);
    }

    const response = await this.client.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: trimmed,
    });

    return Buffer.from(await response.arrayBuffer());
  }
}
