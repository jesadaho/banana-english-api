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
    const defaultTtsMode = ['client', 'server', 'device'].includes(ttsEnv)
      ? ttsEnv
      : 'device';

    const geminiApiKey = this.config.get<string>('GEMINI_API_KEY');
    const geminiTtsModel = this.config.get<string>(
      'GEMINI_TTS_MODEL',
      'gemini-2.5-flash-preview-tts',
    );
    const geminiTtsVoice = this.config.get<string>('GEMINI_TTS_VOICE', 'Sadachbia');

    return {
      groqApiKey: groqApiKey ?? null,
      defaultTtsMode,
      geminiApiKey: geminiApiKey ?? null,
      geminiTtsModel,
      geminiTtsVoice,
    };
  }
}
