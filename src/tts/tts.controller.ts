import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { GeminiTtsService } from '../gemini/gemini-tts.service';
import { CloudTtsAuthService } from './cloud-tts-auth.service';
import { SynthesizeTtsDto } from './dto/tts.dto';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { LegacyApiInterceptor } from '../common/legacy-api.interceptor';

/** Routes shared by the legacy and v2 controllers below. */
abstract class TtsRoutes {
  constructor(
    private readonly geminiTts: GeminiTtsService,
    private readonly cloudTtsAuth: CloudTtsAuthService,
  ) {}

  /**
   * Short-lived Google OAuth token for client-direct Cloud Text-to-Speech.
   * Audio synthesis happens on-device against Google — not proxied here.
   */
  @Get('cloud-token')
  @RateLimit({ name: 'tts-token', windowMs: 60_000, perUser: 10, perIp: 120 })
  async cloudToken() {
    return this.cloudTtsAuth.mintAccessToken();
  }

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
      const audio = await this.geminiTts.synthesizeSpeech(
        combinedText,
        body.voiceProfile,
      );

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
        body.voiceProfile,
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

/** @deprecated Open legacy route for old app builds. Remove after LEGACY_API_SUNSET. */
@Controller('api/tts')
@UseGuards(RateLimitGuard)
@UseInterceptors(LegacyApiInterceptor)
@RateLimit({ name: 'tts-legacy', windowMs: 60_000, perUser: 60, perIp: 600 })
export class TtsController extends TtsRoutes {
  constructor(geminiTts: GeminiTtsService, cloudTtsAuth: CloudTtsAuthService) {
    super(geminiTts, cloudTtsAuth);
  }
}

/** v2: a known app user is required, and calls are rate limited. */
@Controller('api/v2/tts')
@UseGuards(RateLimitGuard, AnonymousUserGuard)
@RateLimit({ name: 'tts', windowMs: 60_000, perUser: 60, perIp: 600 })
export class TtsV2Controller extends TtsRoutes {
  constructor(geminiTts: GeminiTtsService, cloudTtsAuth: CloudTtsAuthService) {
    super(geminiTts, cloudTtsAuth);
  }
}
