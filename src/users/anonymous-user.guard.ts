import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const ANONYMOUS_USER_HEADER = 'x-anonymous-user-id';

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

    request.user = await this.resolveUser(anonymousId);
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
