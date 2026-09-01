import {
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ANONYMOUS_USER_HEADER } from './anonymous-user.guard';

export const AUTH_BEARER_HEADER = 'authorization';

@Injectable()
export class FirebaseIdTokenExtractor {
  extractFromRequest(request: {
    headers: Record<string, string | string[] | undefined>;
  }): string | null {
    const raw = request.headers[AUTH_BEARER_HEADER];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header?.trim()) return null;

    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match?.[1]?.trim() ?? null;
  }
}

export const FirebaseIdToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = request.headers[AUTH_BEARER_HEADER];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header?.trim()) return null;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match?.[1]?.trim() ?? null;
  },
);

export function requireAnonymousHeader(request: {
  headers: Record<string, string | undefined>;
}): string {
  const anonymousId = request.headers[ANONYMOUS_USER_HEADER]?.trim();
  if (!anonymousId) {
    throw new UnauthorizedException('Missing X-Anonymous-User-Id header');
  }
  return anonymousId;
}
