import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CloudTtsAuthService } from '../tts/cloud-tts-auth.service';

export type GcpSttResult = {
  text: string;
};

@Injectable()
export class GcpSttService {
  private readonly logger = new Logger(GcpSttService.name);

  constructor(private readonly cloudAuth: CloudTtsAuthService) {}

  isConfigured(): boolean {
    return this.cloudAuth.isConfigured();
  }

  async transcribe(params: {
    audio: Buffer;
    filename?: string;
    language?: string | null;
  }): Promise<GcpSttResult> {
    if (!this.cloudAuth.isConfigured()) {
      throw new ServiceUnavailableException('GCP Speech is not configured');
    }

    const token = await this.cloudAuth.mintAccessToken();
    const languageCode = this.languageCode(params.language);
    const projectId = token.projectId;

    if (projectId) {
      try {
        return await this.recognizeV2({
          audio: params.audio,
          accessToken: token.accessToken,
          projectId,
          languageCode,
        });
      } catch (error) {
        this.logger.warn(
          `Speech v2 failed, trying v1: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.recognizeV1({
      audio: params.audio,
      accessToken: token.accessToken,
      languageCode,
      filename: params.filename ?? '',
    });
  }

  private languageCode(language?: string | null): string {
    const code = language?.trim().toLowerCase();
    if (code === 'th') return 'th-TH';
    return 'en-US';
  }

  private async recognizeV2(params: {
    audio: Buffer;
    accessToken: string;
    projectId: string;
    languageCode: string;
  }): Promise<GcpSttResult> {
    const url =
      `https://speech.googleapis.com/v2/projects/${params.projectId}` +
      '/locations/global/recognizers/_:recognize';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          autoDecodingConfig: {},
          languageCodes: [params.languageCode],
          model: 'latest_short',
          features: { enableAutomaticPunctuation: true },
        },
        content: params.audio.toString('base64'),
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Speech v2 failed (${response.status}): ${body.slice(0, 180)}`);
    }
    return this.parseTranscript(body, 'v2');
  }

  private async recognizeV1(params: {
    audio: Buffer;
    accessToken: string;
    languageCode: string;
    filename: string;
  }): Promise<GcpSttResult> {
    const encoding = this.v1Encoding(params.filename);
    const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          encoding,
          sampleRateHertz: encoding === 'WEBM_OPUS' ? 48000 : 44100,
          languageCode: params.languageCode,
          model: 'latest_short',
          enableAutomaticPunctuation: true,
        },
        audio: { content: params.audio.toString('base64') },
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      this.logger.error(`Speech v1 failed (${response.status}): ${body.slice(0, 200)}`);
      throw new ServiceUnavailableException('GCP Speech transcription failed');
    }
    return this.parseTranscript(body, 'v1');
  }

  private v1Encoding(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.webm') || lower.endsWith('.opus')) return 'WEBM_OPUS';
    if (lower.endsWith('.wav')) return 'LINEAR16';
    if (lower.endsWith('.mp3')) return 'MP3';
    return 'MP3';
  }

  private parseTranscript(body: string, source: string): GcpSttResult {
    let json: {
      results?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    };
    try {
      json = JSON.parse(body) as typeof json;
    } catch {
      throw new ServiceUnavailableException('GCP Speech returned invalid JSON');
    }
    const text = json.results
      ?.map((result) => result.alternatives?.[0]?.transcript?.trim() ?? '')
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!text) {
      this.logger.warn(`GCP Speech ${source} returned empty transcript`);
      throw new ServiceUnavailableException('GCP Speech heard nothing');
    }
    return { text };
  }
}
