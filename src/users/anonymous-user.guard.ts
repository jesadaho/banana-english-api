import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const ANONYMOUS_USER_HEADER = 'x-anonymous-user-id';
export const AUTH_SESSION_HEADER = 'x-auth-session-id';
export const AUTH_SESSION_REPLACED = 'AUTH_SESSION_REPLACED';

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

    const user = await this.resolveUser(anonymousId);
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

  private async resolveUser(anonymousId: string) {
    return this.prisma.user.upsert({
      where: { anonymousId },
      create: { anonymousId },
      update: {},
    });
  }
}
