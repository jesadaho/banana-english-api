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
      await this.processFirstBananaDrop();
      await this.processStreakReminder();
      await this.processMissYouDay3();
    } catch (error) {
      this.logger.error(`Scheduled jobs failed: ${String(error)}`);
    }
  }

  /** Credits the daily banana refill at 09:00 local; push only on the user's first-ever daily drop. */
  private async processFirstBananaDrop() {
    const users = await this.prisma.user.findMany({
      include: { fcmTokens: true },
    });
    const now = new Date();

    for (const user of users) {
      const local = getUserLocalTime(user.timezone, now);
      if (local.hour !== 9) continue;
      if (isSameDateKey(user.lastDailyBananaDate, local.dateKey)) continue;

      const isFirstDailyBanana = user.lastDailyBananaDate == null;

      const updated = await this.economy.maybeCreditDailyBanana(user, now);
      if (updated.lastDailyBananaDate?.getTime() === user.lastDailyBananaDate?.getTime()) {
        continue;
      }

      // Push only the first time they ever receive a daily banana.
      if (!isFirstDailyBanana) continue;

      const alreadyNotified = await this.prisma.notificationLog.findFirst({
        where: { userId: user.id, type: 'first_banana' },
        select: { id: true },
      });
      if (alreadyNotified) continue;

      const sent = await this.tryLogNotification(
        user.id,
        'first_banana',
        local.dateKey,
      );
      if (!sent) continue;

      const invalid = await this.sendPush(
        user.id,
        user.fcmTokens.map((token) => token.token),
        'first_banana',
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
    type: PushNotificationType,
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
