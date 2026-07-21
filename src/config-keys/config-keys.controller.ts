import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('api/config')
export class ConfigKeysController {
  constructor(private readonly config: ConfigService) {}

  @Get('keys')
  getKeys() {
    const groqApiKey = this.config.get<string>('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new ServiceUnavailableException(
        'GROQ_API_KEY is not configured on the server',
      );
    }
    return { groqApiKey };
  }

  @Get('app')
  getAppConfig() {
    const groqApiKey = this.config.get<string>('GROQ_API_KEY');
    const ttsEnv = this.config.get<string>('DEFAULT_TTS_MODE', 'device');
    const defaultTtsMode = [
      'client',
      'server',
      'cloud',
      'device',
      'deviceAuto',
    ].includes(ttsEnv)
      ? ttsEnv
      : 'device';

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

    return {
      groqApiKey: groqApiKey ?? null,
      defaultTtsMode,
      geminiApiKey: geminiApiKey ?? null,
      geminiTtsModel,
      geminiTtsFallbackModels,
      geminiTtsVoice,
      cloudTtsApiKey: cloudTtsApiKey ?? null,
      cloudTtsModel,
      cloudTtsVoice,
      cloudTtsProjectId: cloudTtsProjectId ?? null,
    };
  }
}
