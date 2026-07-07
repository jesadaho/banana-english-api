import {
  BadGatewayException,
  Body,
  Controller,
  HttpException,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { GeminiTtsService } from '../gemini/gemini-tts.service';
import { SynthesizeTtsDto } from './dto/tts.dto';

@Controller('api/tts')
export class TtsController {
  constructor(private readonly geminiTts: GeminiTtsService) {}

  @Post('synthesize')
  async synthesize(@Body() body: SynthesizeTtsDto) {
    const segments = body.segments
      .map((segment) => segment.text.trim())
      .filter((text) => text.length > 0);

    if (segments.length === 0) {
      return { clips: [] };
    }

    const combinedText = segments.join(' ');

    try {
      const audio = await this.geminiTts.synthesizeSpeech(combinedText);

      return {
        clips: [
          {
            audioBase64: audio.toString('base64'),
            contentType: 'audio/wav',
          },
        ],
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new BadGatewayException(
        `TTS error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Post('synthesize-stream')
  async synthesizeStream(
    @Body() body: SynthesizeTtsDto,
    @Res() res: Response,
  ) {
    const segments = body.segments
      .map((segment) => segment.text.trim())
      .filter((text) => text.length > 0);

    if (segments.length === 0) {
      res.status(200).end();
      return;
    }

    const combinedText = segments.join(' ');

    try {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of this.geminiTts.synthesizeSpeechStream(
        combinedText,
      )) {
        res.write(
          `${JSON.stringify({
            audioBase64: chunk.toString('base64'),
            contentType: 'audio/wav',
          })}\n`,
        );
      }

      res.end();
    } catch (err) {
      if (!res.headersSent) {
        if (err instanceof HttpException) {
          throw err;
        }
        throw new BadGatewayException(
          `TTS error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      res.write(
        `${JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        })}\n`,
      );
      res.end();
    }
  }
}
