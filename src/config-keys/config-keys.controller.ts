import {
  Controller,
  Get,
  ServiceUnavailableException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  pickGroqApiKeyForClient,
  resolveGroqApiKeys,
  type GroqClientKey,
} from './groq-api-keys';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { LegacyApiInterceptor } from '../common/legacy-api.interceptor';

/** Routes shared by the legacy and v2 controllers below. */
abstract class ConfigKeysRoutes {
  constructor(private readonly config: ConfigService) {}

  @Get('keys')
  getKeys() {
    const picked = this.pickClientKey();
    if (!picked) {
      throw new ServiceUnavailableException(
        'GROQ_API_KEY / GROQ_API_KEYS is not configured on the server',
      );
    }
    return { groqApiKey: picked.key, groqKeyId: picked.keyId };
  }

  @Get('app')
  getAppConfig() {
    const picked = this.pickClientKey();
    const groqApiKey = picked?.key ?? null;
    const ttsEnv = this.config.get<string>('DEFAULT_TTS_MODE', 'cloudGrpc');
    const defaultTtsMode = [
      'client',
      'server',
      'cloud',
      'cloudGrpc',
      'device',
      'deviceAuto',
    ].includes(ttsEnv)
      ? ttsEnv
      : 'cloudGrpc';

    const geminiApiKey = this.config.get<string>('GEMINI_API_KEY');
    const rawPrimary = this.config.get<string>(
      'GEMINI_TTS_MODEL',
      'gemini-3.1-flash-tts-preview',
    );
    // Older Gemini Direct clients treat this as a single model id — never send a list.
    const geminiTtsModel =
      rawPrimary.split(/[,;]/).map((m) => m.trim()).find(Boolean) ??
      'gemini-3.1-flash-tts-preview';
    const geminiTtsFallbackModels = this.config.get<string>(
      'GEMINI_TTS_FALLBACK_MODELS',
      // lite id is often 404 on Developer API; pro-preview is the reliable unary TTS.
      'gemini-2.5-pro-preview-tts,gemini-2.5-flash-preview-tts',
    );
    const geminiTtsVoice = this.config.get<string>('GEMINI_TTS_VOICE', 'Sadachbia');

    const cloudTtsApiKey = this.config.get<string>('GOOGLE_CLOUD_TTS_API_KEY');
    const cloudTtsModel = this.config.get<string>(
      'GOOGLE_CLOUD_TTS_MODEL',
      'gemini-2.5-flash-tts',
    );
    const cloudTtsVoice = this.config.get<string>(
      'GOOGLE_CLOUD_TTS_VOICE',
      geminiTtsVoice,
    );
    const cloudTtsProjectId = this.config.get<string>('GOOGLE_CLOUD_PROJECT');
    const cloudTtsTokenEnabled = this.isCloudTtsTokenConfigured();

    return {
      groqApiKey,
      groqKeyId: picked?.keyId ?? null,
      sttFallback: groqApiKey ? null : 'gcp',
      defaultTtsMode,
      geminiApiKey: geminiApiKey ?? null,
      geminiTtsModel,
      geminiTtsFallbackModels,
      geminiTtsVoice,
      // Prefer token minting; keep API key only as optional legacy fallback.
      cloudTtsApiKey: cloudTtsTokenEnabled ? null : (cloudTtsApiKey ?? null),
      cloudTtsModel,
      cloudTtsVoice,
      cloudTtsProjectId: cloudTtsProjectId ?? null,
      cloudTtsTokenEnabled,
    };
  }

  /** One key per client config fetch — spreads Whisper RPM across the pool. */
  private pickClientKey(): GroqClientKey | undefined {
    return pickGroqApiKeyForClient(
      resolveGroqApiKeys((key) => this.config.get<string>(key)),
    );
  }

  private isCloudTtsTokenConfigured(): boolean {
    const json = this.config
      .get<string>('GOOGLE_CLOUD_TTS_CREDENTIALS_JSON')
      ?.trim();
    if (json) return true;
    const email = this.config
      .get<string>('GOOGLE_CLOUD_TTS_CLIENT_EMAIL')
      ?.trim();
    const key = this.config.get<string>('GOOGLE_CLOUD_TTS_PRIVATE_KEY')?.trim();
    return Boolean(email && key);
  }
}

/** @deprecated Open legacy route for old app builds. Remove after LEGACY_API_SUNSET. */
@Controller('api/config')
@UseGuards(RateLimitGuard)
@UseInterceptors(LegacyApiInterceptor)
@RateLimit({ name: 'config-legacy', windowMs: 60_000, perUser: 20, perIp: 120 })
export class ConfigKeysController extends ConfigKeysRoutes {
  constructor(config: ConfigService) {
    super(config);
  }
}

/** v2: a known app user is required, and fetches are rate limited. */
@Controller('api/v2/config')
@UseGuards(RateLimitGuard, AnonymousUserGuard)
@RateLimit({ name: 'config', windowMs: 60_000, perUser: 20, perIp: 120 })
export class ConfigKeysV2Controller extends ConfigKeysRoutes {
  constructor(config: ConfigService) {
    super(config);
  }
}
