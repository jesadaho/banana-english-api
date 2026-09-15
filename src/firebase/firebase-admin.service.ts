import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private enabled = false;
  private storageBucket: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');
    const storageBucket =
      this.config.get<string>('FIREBASE_STORAGE_BUCKET')?.trim() ||
      (projectId ? `${projectId}.firebasestorage.app` : '');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials missing — auth token verification disabled',
      );
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        ...(storageBucket ? { storageBucket } : {}),
      });
    }

    this.enabled = true;
    this.storageBucket = storageBucket || null;
    this.logger.log('Firebase Admin ready');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.enabled) {
      throw new Error('Firebase Admin is not configured');
    }
    return admin.auth().verifyIdToken(idToken);
  }

  async getSignedReadUrl(
    objectPath: string,
    expiresMs = 60 * 60 * 1000,
  ): Promise<string | null> {
    if (!this.enabled || !this.storageBucket || !objectPath.trim()) {
      return null;
    }
    try {
      const [url] = await admin
        .storage()
        .bucket(this.storageBucket)
        .file(objectPath.trim())
        .getSignedUrl({
          action: 'read',
          expires: Date.now() + expiresMs,
        });
      return url;
    } catch (error) {
      this.logger.warn(
        `Signed URL failed for ${objectPath}: ${String(error).slice(0, 160)}`,
      );
      return null;
    }
  }
}
