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
}
