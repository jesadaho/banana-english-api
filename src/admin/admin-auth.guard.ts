import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.firebase.isEnabled()) {
      throw new ServiceUnavailableException('Admin auth unavailable');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      adminEmail?: string;
    }>();

    const raw = request.headers.authorization;
    const header = Array.isArray(raw) ? raw[0] : raw;
    const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
    const token = match?.[1]?.trim();
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    let email: string | undefined;
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      email = decoded.email?.trim().toLowerCase();
    } catch {
      throw new UnauthorizedException('Invalid Firebase token');
    }

    if (!email) {
      throw new ForbiddenException('Admin account requires an email');
    }

    const allowlist = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowlist.length === 0) {
      throw new ServiceUnavailableException(
        'ADMIN_EMAILS is not configured',
      );
    }

    if (!allowlist.includes(email)) {
      throw new ForbiddenException('Not an admin');
    }

    request.adminEmail = email;
    return true;
  }
}
