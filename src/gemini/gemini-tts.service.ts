import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly apiKey: string;
  private readonly model: string;
  private readonly voice: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.model = this.config.get<string>(
      'GEMINI_TTS_MODEL',
      'gemini-2.5-flash-preview-tts',
    );
    this.voice = this.config.get<string>('GEMINI_TTS_VOICE', 'Puck');
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    const trimmed = text.trim();
    if (!trimmed) {
      return Buffer.alloc(0);
    }

    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured on the server',
      );
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
          'Api-Revision': '2026-05-20',
        },
        body: JSON.stringify({
          model: this.model,
          input: `Speak warmly and naturally as Teacher B, a friendly English teacher for Thai learners:\n\n${trimmed}`,
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: [{ voice: this.voice }],
          },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini TTS failed (${response.status}): ${err}`);
    }

    const data = (await response.json()) as InteractionResponse;
    const audio = this.extractAudioBlock(data);
    const mimeType = audio.mime_type ?? audio.mimeType;
    const raw = Buffer.from(audio.data ?? '', 'base64');

    if (mimeType?.includes('wav')) {
      return raw;
    }

    const sampleRate = parseSampleRateFromMimeType(mimeType);
    return pcmToWav(raw, sampleRate);
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
}
