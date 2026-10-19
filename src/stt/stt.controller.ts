import {
  BadRequestException,
  Body,
  Controller,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ConfigService } from '@nestjs/config';
import { markGroqKeyHot, resolveGroqApiKeys } from '../config-keys/groq-api-keys';
import { GcpSttService } from './gcp-stt.service';

const AUDIO_MAX_BYTES = 3 * 1024 * 1024;

type GroqKeyHealthBody = {
  keyId?: string;
  statusCode?: number;
};

@Controller('api/stt')
export class SttController {
  constructor(
    private readonly gcpStt: GcpSttService,
    private readonly config: ConfigService,
  ) {}

  @Post('groq-key-health')
  reportGroqKeyHealth(@Body() body: GroqKeyHealthBody) {
    const keyId = String(body.keyId ?? '').trim();
    const statusCode = Number(body.statusCode);
    if (!keyId || !/^k\d+$/.test(keyId)) {
      throw new BadRequestException('keyId is required');
    }
    const keys = resolveGroqApiKeys((name) => this.config.get<string>(name));
    const index = Number(keyId.slice(1));
    if (index < 1 || index > keys.length) {
      throw new BadRequestException('unknown keyId');
    }
    const hot =
      statusCode === 429 || (statusCode >= 500 && statusCode < 600);
    if (hot) {
      markGroqKeyHot(keyId);
    }
    return { ok: true, cooled: hot };
  }

  @Post('transcribe')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AUDIO_MAX_BYTES },
    }),
  )
  async transcribe(
    @UploadedFile() file?: { buffer: Buffer; originalname?: string; mimetype?: string },
    @Body() body?: { language?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('audio file is required');
    }
    if (!this.gcpStt.isConfigured()) {
      throw new ServiceUnavailableException('GCP Speech is not configured');
    }
    const result = await this.gcpStt.transcribe({
      audio: file.buffer,
      filename: file.originalname,
      language: body?.language,
    });
    return { text: result.text, provider: 'gcp' };
  }
}
