import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, randomUUID } from 'crypto';

export type CloudTtsTokenResponse = {
  accessToken: string;
  expiresAt: string;
  model: string;
  voice: string;
  projectId: string | null;
};

type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

/**
 * Mints short-lived Google OAuth access tokens from a service account so the
 * mobile client can call Cloud Text-to-Speech / Vertex Gemini TTS directly
 * (audio does not proxy through this API).
 */
@Injectable()
export class CloudTtsAuthService {
  private readonly logger = new Logger(CloudTtsAuthService.name);
  private readonly credentials: ServiceAccountCreds | null;
  private readonly model: string;
  private readonly voice: string;
  private readonly projectId: string | null;

  /** Cache one token until near expiry to avoid mint storms. */
  private cached: { token: string; expiresAtMs: number } | null = null;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<string>(
      'GOOGLE_CLOUD_TTS_MODEL',
      'gemini-2.5-flash-tts',
    );
    this.voice =
      this.config.get<string>('GOOGLE_CLOUD_TTS_VOICE') ??
      this.config.get<string>('GEMINI_TTS_VOICE', 'Sadachbia');
    this.projectId =
      this.config.get<string>('GOOGLE_CLOUD_PROJECT')?.trim() || null;
    this.credentials = this.loadCredentials();

    if (this.credentials) {
      this.logger.log(
        `Cloud TTS token minting enabled (model=${this.model}, voice=${this.voice})`,
      );
    } else {
      this.logger.warn(
        'Cloud TTS token minting disabled — set GOOGLE_CLOUD_TTS_CREDENTIALS_JSON ' +
          'or GOOGLE_CLOUD_TTS_CLIENT_EMAIL + GOOGLE_CLOUD_TTS_PRIVATE_KEY',
      );
    }
  }

  isConfigured(): boolean {
    return this.credentials != null;
  }

  async mintAccessToken(): Promise<CloudTtsTokenResponse> {
    if (!this.credentials) {
      throw new ServiceUnavailableException(
        'Cloud TTS service account is not configured on the server',
      );
    }

    const now = Date.now();
    if (this.cached && this.cached.expiresAtMs - now > 60_000) {
      return {
        accessToken: this.cached.token,
        expiresAt: new Date(this.cached.expiresAtMs).toISOString(),
        model: this.model,
        voice: this.voice,
        projectId: this.projectId,
      };
    }

    const assertion = this.signServiceAccountJwt(this.credentials);
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(
        `Google token mint failed (${response.status}): ${errText.slice(0, 200)}`,
      );
      throw new ServiceUnavailableException(
        'Failed to mint Google Cloud access token for TTS',
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new ServiceUnavailableException(
        'Google token response missing access_token',
      );
    }

    const expiresInSec = data.expires_in ?? 3600;
    const expiresAtMs = now + expiresInSec * 1000;
    this.cached = { token: data.access_token, expiresAtMs };

    return {
      accessToken: data.access_token,
      expiresAt: new Date(expiresAtMs).toISOString(),
      model: this.model,
      voice: this.voice,
      projectId: this.projectId,
    };
  }

  private loadCredentials(): ServiceAccountCreds | null {
    const jsonRaw = this.config
      .get<string>('GOOGLE_CLOUD_TTS_CREDENTIALS_JSON')
      ?.trim();
    if (jsonRaw) {
      try {
        const parsed = JSON.parse(jsonRaw) as {
          client_email?: string;
          private_key?: string;
        };
        if (parsed.client_email && parsed.private_key) {
          return {
            client_email: parsed.client_email,
            private_key: parsed.private_key.replace(/\\n/g, '\n'),
          };
        }
      } catch (error) {
        this.logger.error(
          `Invalid GOOGLE_CLOUD_TTS_CREDENTIALS_JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }
    }

    const clientEmail = this.config
      .get<string>('GOOGLE_CLOUD_TTS_CLIENT_EMAIL')
      ?.trim();
    const privateKey = this.config
      .get<string>('GOOGLE_CLOUD_TTS_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n')
      ?.trim();

    if (clientEmail && privateKey) {
      return { client_email: clientEmail, private_key: privateKey };
    }

    return null;
  }

  private signServiceAccountJwt(creds: ServiceAccountCreds): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: creds.client_email,
      sub: creds.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      jti: randomUUID(),
    };

    const encodedHeader = base64Url(JSON.stringify(header));
    const encodedPayload = base64Url(JSON.stringify(payload));
    const unsigned = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(creds.private_key);
    return `${unsigned}.${base64Url(signature)}`;
  }
}

function base64Url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
