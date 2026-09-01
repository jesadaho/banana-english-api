import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

export type AuthProviderName = 'google' | 'apple';

export interface UserAuthStatusResponse {
  isGuest: boolean;
  email: string | null;
  providers: AuthProviderName[];
}

const PROVIDER_FROM_FIREBASE: Record<string, AuthProviderName> = {
  'google.com': 'google',
  'apple.com': 'apple',
};

@Injectable()
export class UserAuthService {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async getAuthStatus(user: User): Promise<UserAuthStatusResponse> {
    const providers = await this.prisma.userAuthProvider.findMany({
      where: { userId: user.id },
      select: { provider: true },
    });

    const linked = providers
      .map((row) => row.provider)
      .filter((p): p is AuthProviderName => p === 'google' || p === 'apple');

    const isGuest = linked.length === 0 && !user.firebaseUid;

    return {
      isGuest,
      email: user.email,
      providers: [...new Set(linked)],
    };
  }

  async linkAuthFromToken(user: User, idToken: string) {
    if (!this.firebaseAdmin.isEnabled()) {
      throw new ServiceUnavailableException('Auth service unavailable');
    }

    const trimmed = idToken.trim();
    if (!trimmed) {
      throw new BadRequestException('Missing ID token');
    }

    const decoded = await this.firebaseAdmin.verifyIdToken(trimmed);
    const signInProvider = decoded.firebase?.sign_in_provider ?? '';
    const provider = PROVIDER_FROM_FIREBASE[signInProvider];
    if (!provider) {
      throw new BadRequestException('Unsupported sign-in provider');
    }

    const firebaseUid = decoded.uid;
    const email = decoded.email?.trim() || null;
    const providerUid = this.resolveProviderUid(decoded, signInProvider);

    const existingByFirebase = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });
    if (existingByFirebase && existingByFirebase.id !== user.id) {
      throw new ConflictException(
        'This account is already linked to another profile',
      );
    }

    const existingProvider = await this.prisma.userAuthProvider.findUnique({
      where: {
        provider_providerUid: { provider, providerUid },
      },
    });
    if (existingProvider && existingProvider.userId !== user.id) {
      throw new ConflictException(
        'This sign-in method is already linked to another profile',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userAuthProvider.upsert({
        where: {
          provider_providerUid: { provider, providerUid },
        },
        create: {
          userId: user.id,
          provider,
          providerUid,
          email,
        },
        update: {
          userId: user.id,
          email,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          firebaseUid,
          email: email ?? undefined,
        },
      });
    });

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    return this.users.getProfile(updated);
  }

  private resolveProviderUid(
    decoded: { uid: string; firebase?: { identities?: Record<string, string[]> } },
    signInProvider: string,
  ): string {
    const identities = decoded.firebase?.identities;
    const fromIdentity = identities?.[signInProvider]?.[0];
    return fromIdentity ?? decoded.uid;
  }
}
