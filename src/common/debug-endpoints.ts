import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function assertDebugEndpointsEnabled(config: ConfigService): void {
  const enabled =
    config.get<string>('NODE_ENV') !== 'production' ||
    config.get<string>('ENABLE_DEBUG_ENDPOINTS') === 'true';
  if (!enabled) {
    throw new ForbiddenException('Debug endpoints are disabled');
  }
}
