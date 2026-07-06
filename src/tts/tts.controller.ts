import {
  BadGatewayException,
  Body,
  Controller,
  HttpException,
  Post,
} from '@nestjs/common';
import { GeminiTtsService } from '../gemini/gemini-tts.service';
import { SynthesizeTtsDto } from './dto/tts.dto';

@Controller('api/tts')
export class TtsController {
  constructor(private readonly geminiTts: GeminiTtsService) {}

  @Post('synthesize')
  async synthesize(@Body() body: SynthesizeTtsDto) {
    const segments = body.segments
      .map((s) => s.text.trim())
      .filter((text) => text.length > 0);

    if (segments.length === 0) {
      return { clips: [] };
    }

    try {
      const clips = await Promise.all(
        segments.map(async (text) => {
          const audio = await this.geminiTts.synthesizeSpeech(text);
          return {
            audioBase64: audio.toString('base64'),
            contentType: 'audio/wav',
          };
        }),
      );

      return { clips };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new BadGatewayException(
        `TTS error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
