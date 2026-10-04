import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import {
  dateKeyDaysAgo,
  getUserLocalTime,
  isSameDateKey,
  parseDateKey,
  previousDateKey,
} from '../common/timezone.util';
import { FcmService } from './fcm.service';
import {
  pushPayloadForType,
  type PushNotificationType,
} from './notification-templates';

const BANANA_PUSH_START_HOUR = 8;
const BANANA_PUSH_END_HOUR = 22;

@Injectable()
export class DailyJobsService {
  private readonly logger = new Logger(DailyJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly fcm: FcmService,
  ) {}

  @Cron('*/15 * * * *')
  async runScheduledJobs() {
    try {
      await this.processBananaFull();
      await this.processStreakReminder();
      await this.processMissYouDay3();
    } catch (error) {
      this.logger.error(`Scheduled jobs failed: ${String(error)}`);
    }
  }

  /**
   * Push once when the free pool reaches the cap. Fires only on the below-cap → full
   * transition, so it can't repeat until the user spends and the pool refills again.
   * Quiet hours defer the credit (and push) to the morning; the refill math catches up.
   */
  private async processBananaFull() {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: {
        freeBananaBalance: { lt: this.economy.maxBananaBalance() },
        lastBananaRefillAt: { not: null },
        fcmTokens: { some: {} },
      },
      include: { fcmTokens: true },
    });

    for (const user of users) {
      const local = getUserLocalTime(user.timezone, now);
      if (local.hour < BANANA_PUSH_START_HOUR || local.hour >= BANANA_PUSH_END_HOUR) continue;

      const updated = await this.economy.maybeRefillFreeBananas(user, now);
      if (updated.freeBananaBalance < this.economy.maxBananaBalance()) continue;

      const invalid = await this.sendPush(
        user.id,
        user.fcmTokens.map((token) => token.token),
        'banana_full',
      );
      await this.removeInvalidTokens(invalid);
    }
  }

  /**
   * Evening streak nudge — only on the first day they go quiet:
   * streak > 0, today not completed, not opened today, but DID open yesterday.
   * Day 2 without open → skip. Day 3 → see processMissYouDay3.
   */
  private async processStreakReminder() {
    const users = await this.prisma.user.findMany({
      where: { streakDays: { gt: 0 } },
      include: { fcmTokens: true },
    });
    const now = new Date();

    for (const user of users) {
      const local = getUserLocalTime(user.timezone, now);
      if (local.hour !== 20) continue;

      // today_not_completed (streak session)
      if (isSameDateKey(user.lastSessionDate, local.dateKey)) continue;
      // user_not_opened_today
      if (isSameDateKey(user.lastAppOpenDate, local.dateKey)) continue;
      // only day-1 of absence (opened yesterday). Day 2+ without open → skip.
      const yesterdayKey = previousDateKey(local.dateKey);
      if (!isSameDateKey(user.lastAppOpenDate, yesterdayKey)) continue;

      const sent = await this.tryLogNotification(
        user.id,
        'streak_reminder',
        local.dateKey,
      );
      if (!sent) continue;

      const invalid = await this.sendPush(
        user.id,
        user.fcmTokens.map((token) => token.token),
        'streak_reminder',
      );
      await this.removeInvalidTokens(invalid);
    }
  }

  /**
   * Day-3 win-back: last opened exactly 3 local days ago (gone for 3 days).
   * Once per user per calendar day via NotificationLog type `miss_you`.
   */
  private async processMissYouDay3() {
    const users = await this.prisma.user.findMany({
      include: { fcmTokens: true },
    });
    const now = new Date();

    for (const user of users) {
      const local = getUserLocalTime(user.timezone, now);
      if (local.hour !== 20) continue;
      if (!user.lastAppOpenDate) continue;
      if (isSameDateKey(user.lastAppOpenDate, local.dateKey)) continue;

      const threeDaysAgo = dateKeyDaysAgo(local.dateKey, 3);
      if (!isSameDateKey(user.lastAppOpenDate, threeDaysAgo)) continue;

      const sent = await this.tryLogNotification(
        user.id,
        'miss_you',
        local.dateKey,
      );
      if (!sent) continue;

      const invalid = await this.sendPush(
        user.id,
        user.fcmTokens.map((token) => token.token),
        'miss_you',
      );
      await this.removeInvalidTokens(invalid);
    }
  }

  private async sendPush(
    userId: string,
    tokens: string[],
    type: Exclude<PushNotificationType, 'bug_report_reply'>,
  ): Promise<string[]> {
    const payload = pushPayloadForType(type);
    return this.fcm.sendAndPersist({ userId, tokens, payload });
  }

  private async tryLogNotification(
    userId: string,
    type: string,
    dateKey: string,
  ): Promise<boolean> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          userId,
          type,
          sentOn: parseDateKey(dateKey),
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  private async removeInvalidTokens(tokens: string[]) {
    if (tokens.length === 0) return;
    await this.prisma.userFcmToken.deleteMany({
      where: { token: { in: tokens } },
    });
  }
}
