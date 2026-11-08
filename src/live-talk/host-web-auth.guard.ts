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
import { PrismaService } from '../prisma/prisma.service';
import type { HostWebViewer } from './live-talk-schedule.service';

/**
 * Host web (/host): Firebase ID token from Google sign-in. Lets in app users
 * who are Official Hosts (matched by firebaseUid, i.e. the account they linked
 * in the app) and ADMIN_EMAILS admins.
 */
@Injectable()
export class HostWebAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.firebase.isEnabled()) {
      throw new ServiceUnavailableException('Auth unavailable');
    }
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      hostViewer?: HostWebViewer;
    }>();
    const raw = request.headers.authorization;
    const header = Array.isArray(raw) ? raw[0] : raw;
    const token = header ? /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() : null;
    if (!token) throw new UnauthorizedException('Missing Bearer token');

    let uid: string;
    let email: string | null;
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email?.trim().toLowerCase() || null;
    } catch {
      throw new UnauthorizedException('Invalid Firebase token');
    }

    const admins = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = email != null && admins.includes(email);

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: uid },
      select: {
        id: true,
        displayName: true,
        avatarId: true,
        hostLevel: true,
        communityAdmin: true,
      },
    });
    const isHost = user != null && user.hostLevel === 'official';
    if (!isAdmin && !isHost) {
      throw new ForbiddenException(user ? 'official_host_only' : 'account_not_linked');
    }
    request.hostViewer = { user, email, isAdmin };
    return true;
  }
}
