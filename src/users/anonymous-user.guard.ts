import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { clientIp, hitRateLimit, tooManyRequests } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.service';

export const ANONYMOUS_USER_HEADER = 'x-anonymous-user-id';
export const AUTH_SESSION_HEADER = 'x-auth-session-id';
export const AUTH_SESSION_REPLACED = 'AUTH_SESSION_REPLACED';

/** Loose: many Thai mobile users share one carrier IP. */
const NEW_USERS_PER_IP_PER_HOUR = Number(
  process.env.NEW_USERS_PER_IP_PER_HOUR ?? 60,
);

function isAuthLinkPath(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0];
  return (
    path.endsWith('/users/me/link-auth') ||
    path.endsWith('/users/me/link-provider')
  );
}

@Injectable()
export class AnonymousUserGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: Awaited<ReturnType<AnonymousUserGuard['resolveUser']>>;
    }>();

    const anonymousId = request.headers[ANONYMOUS_USER_HEADER]?.trim();
    if (!anonymousId) {
      throw new UnauthorizedException('Missing X-Anonymous-User-Id header');
    }

    const user = await this.resolveUser(anonymousId, () =>
      clientIp(request as Parameters<typeof clientIp>[0]),
    );
    const requestUrl =
      (request as { originalUrl?: string; url?: string }).originalUrl ??
      (request as { url?: string }).url;
    const expectedSession = (
      user as typeof user & { authSessionId?: string | null }
    ).authSessionId;
    if (
      expectedSession &&
      !isAuthLinkPath(requestUrl)
    ) {
      const presented = request.headers[AUTH_SESSION_HEADER]?.trim();
      if (!presented || presented !== expectedSession) {
        throw new UnauthorizedException(AUTH_SESSION_REPLACED);
      }
    }

    request.user = user;
    return true;
  }

  private async resolveUser(anonymousId: string, ip: () => string) {
    const existing = await this.prisma.user.findUnique({
      where: { anonymousId },
    });
    if (existing) return existing;

    // New IDs cost a DB row and free starter bananas: cap new users per IP.
    const wait = hitRateLimit(
      `new-user:ip:${ip()}`,
      NEW_USERS_PER_IP_PER_HOUR,
      60 * 60_000,
    );
    if (wait > 0) throw tooManyRequests(wait);

    return this.prisma.user.upsert({
      where: { anonymousId },
      create: { anonymousId },
      update: {},
    });
  }
}
