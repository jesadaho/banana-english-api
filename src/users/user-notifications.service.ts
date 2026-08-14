import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  NotificationListResponse,
  UserNotificationItem,
} from '../common/api.types';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

@Injectable()
export class UserNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createInboxItem(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<UserNotificationItem> {
    const row = await this.prisma.userNotification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? Prisma.JsonNull,
      },
    });
    return this.toItem(row);
  }

  async listForUser(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<NotificationListResponse> {
    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );

    const where: Prisma.UserNotificationWhereInput = { userId };
    if (options.cursor) {
      const cursorRow = await this.prisma.userNotification.findFirst({
        where: { id: options.cursor, userId },
      });
      if (cursorRow) {
        where.OR = [
          { sentAt: { lt: cursorRow.sentAt } },
          {
            sentAt: cursorRow.sentAt,
            id: { lt: cursorRow.id },
          },
        ];
      }
    }

    const [rows, unreadCount] = await Promise.all([
      this.prisma.userNotification.findMany({
        where,
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      this.prisma.userNotification.count({
        where: { userId, readAt: null },
      }),
    ]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return {
      items: items.map((row) => this.toItem(row)),
      nextCursor,
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<UserNotificationItem> {
    const existing = await this.prisma.userNotification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }
    if (existing.readAt != null) {
      return this.toItem(existing);
    }

    const row = await this.prisma.userNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return this.toItem(row);
  }

  async markAllRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  private toItem(row: {
    id: string;
    type: string;
    title: string;
    body: string;
    data: Prisma.JsonValue | null;
    sentAt: Date;
    readAt: Date | null;
  }): UserNotificationItem {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: this.parseData(row.data),
      sentAt: row.sentAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    };
  }

  private parseData(
    value: Prisma.JsonValue | null,
  ): Record<string, string> | undefined {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (typeof raw === 'string') out[key] = raw;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
}
