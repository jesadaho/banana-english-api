import {
  HttpException,
  HttpStatus,
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

    const body = {
      model: this.model,
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

      const retryable = response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        throw new Error(
          `Gemini TTS failed (${response.status}): ${lastError}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }

    throw new Error(`Gemini TTS failed: ${lastError}`);
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
