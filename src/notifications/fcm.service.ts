import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials missing — push notifications disabled');
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    this.enabled = true;
    this.logger.log('Firebase Admin initialized');
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
  ): Promise<string[]> {
    if (!this.enabled || tokens.length === 0) {
      return [];
    }

    const invalidTokens: string[] = [];

    for (const token of tokens) {
      try {
        await admin.messaging().send({
          token,
          notification: { title, body },
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(token);
        } else {
          this.logger.warn(`FCM send failed for token: ${String(error)}`);
        }
      }
    }

    return invalidTokens;
  }
}
