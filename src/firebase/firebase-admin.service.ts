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

  /** Hard-delete a Firebase Auth user. No-ops if Auth is disabled or uid missing. */
  async deleteAuthUser(uid: string): Promise<void> {
    const trimmed = uid.trim();
    if (!this.enabled || !trimmed) return;
    try {
      await admin.auth().deleteUser(trimmed);
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'auth/user-not-found') return;
      this.logger.warn(
        `Firebase Auth deleteUser(${trimmed}) failed: ${String(error).slice(0, 200)}`,
      );
      throw error;
    }
  }

  async uploadPublicFile(
    objectPath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ bucket: string; path: string } | null> {
    if (!this.enabled || !this.storageBucket || !objectPath.trim()) {
      return null;
    }
    const path = objectPath.trim();
    try {
      const file = admin.storage().bucket(this.storageBucket).file(path);
      await file.save(buffer, {
        resumable: false,
        metadata: {
          contentType,
          cacheControl: 'public, max-age=3600',
        },
      });
      try {
        await file.makePublic();
      } catch (error) {
        this.logger.warn(
          `makePublic skipped for ${path}: ${String(error).slice(0, 160)}`,
        );
      }
      return { bucket: this.storageBucket, path };
    } catch (error) {
      this.logger.warn(
        `Upload failed for ${path}: ${String(error).slice(0, 160)}`,
      );
      return null;
    }
  }
}
