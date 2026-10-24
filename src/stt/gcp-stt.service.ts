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

    const kind = sniffAudioKind(params.audio, params.filename);
    const bytes = params.audio.length;
    this.logger.log(
      `GCP STT start kind=${kind} bytes=${bytes} file=${params.filename ?? '-'} lang=${languageCode}`,
    );

    let v2Error: string | null = null;
    if (projectId) {
      try {
        return await this.recognizeV2({
          audio: params.audio,
          accessToken: token.accessToken,
          projectId,
          languageCode,
        });
      } catch (error) {
        v2Error = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Speech v2 failed (${kind}, ${bytes}b): ${v2Error}`);
      }
    }

    if (kind === 'm4a') {
      throw new ServiceUnavailableException(
        [
          'GCP Speech cannot decode AAC/M4A on v1. Record WAV or enable Speech v2.',
          ifSnippet(v2Error, 'v2'),
        ]
          .filter(Boolean)
          .join(' | '),
      );
    }

    try {
      return await this.recognizeV1({
        audio: params.audio,
        accessToken: token.accessToken,
        languageCode,
        kind,
        projectId,
      });
    } catch (error) {
      const v1Error = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(
        [v1Error, ifSnippet(v2Error, 'v2')].filter(Boolean).join(' | '),
      );
    }
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
        'x-goog-user-project': params.projectId,
      },
      body: JSON.stringify({
        config: {
          autoDecodingConfig: {},
          languageCodes: [params.languageCode],
          // latest_short returns no results for AAC/M4A; long decodes it.
          model: 'long',
          features: { enableAutomaticPunctuation: true },
        },
        content: params.audio.toString('base64'),
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(googleSnippet('v2', response.status, body));
    }
    return this.parseTranscript(body, 'v2');
  }

  private async recognizeV1(params: {
    audio: Buffer;
    accessToken: string;
    languageCode: string;
    kind: AudioKind;
    projectId: string | null;
  }): Promise<GcpSttResult> {
    const encoding = v1EncodingForKind(params.kind);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    };
    if (params.projectId) headers['x-goog-user-project'] = params.projectId;
    const config: Record<string, unknown> = {
      languageCode: params.languageCode,
      model: 'latest_short',
      enableAutomaticPunctuation: true,
    };
    // WAV/FLAC: let Google read the header. Wrong sampleRateHertz → empty.
    if (encoding === 'WEBM_OPUS') {
      config.encoding = encoding;
      config.sampleRateHertz = 48000;
    } else if (encoding === 'MP3') {
      config.encoding = encoding;
      config.sampleRateHertz = 44100;
    }
    const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        config,
        audio: { content: params.audio.toString('base64') },
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      const snippet = googleSnippet('v1', response.status, body);
      this.logger.error(snippet);
      throw new Error(snippet);
    }
    return this.parseTranscript(body, 'v1');
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
      throw new ServiceUnavailableException(
        `GCP Speech ${source} heard nothing (empty transcript)`,
      );
    }
    return { text };
  }
}

export type AudioKind = 'wav' | 'webm' | 'mp3' | 'm4a' | 'unknown';

export function sniffAudioKind(
  audio: Buffer,
  filename?: string,
): AudioKind {
  if (audio.length >= 12) {
    if (audio.subarray(0, 4).toString('ascii') === 'RIFF') return 'wav';
    if (audio.subarray(0, 4).toString('ascii') === 'OggS') return 'webm';
    if (audio[0] === 0x1a && audio[1] === 0x45 && audio[2] === 0xdf) return 'webm';
    if (audio.subarray(4, 8).toString('ascii') === 'ftyp') return 'm4a';
    if (audio.subarray(0, 3).toString('ascii') === 'ID3') return 'mp3';
    if (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0) return 'mp3';
  }
  const lower = (filename ?? '').toLowerCase();
  if (lower.endsWith('.wav')) return 'wav';
  if (lower.endsWith('.webm') || lower.endsWith('.opus') || lower.endsWith('.ogg')) {
    return 'webm';
  }
  if (lower.endsWith('.mp3')) return 'mp3';
  if (lower.endsWith('.m4a') || lower.endsWith('.aac') || lower.endsWith('.mp4')) {
    return 'm4a';
  }
  return 'unknown';
}

function googleSnippet(source: string, status: number, body: string): string {
  return `GCP Speech ${source} HTTP ${status}: ${body.replace(/\s+/g, ' ').slice(0, 280)}`;
}

function ifSnippet(message: string | null, label: string): string | null {
  if (!message) return null;
  return `${label}: ${message}`;
}

function v1EncodingForKind(kind: AudioKind): string {
  if (kind === 'webm') return 'WEBM_OPUS';
  if (kind === 'wav') return 'LINEAR16';
  return 'MP3';
}
