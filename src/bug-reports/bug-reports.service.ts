import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { FcmService } from '../notifications/fcm.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateRange } from '../admin/admin-metrics.util';
import { isValidBugReportStoragePath } from './bug-report-storage-path';
import {
  BugReportStatus,
  formatTicketCode,
  normalizeBugReportStatus,
  statusForFilter,
} from './bug-report-status';
import { CreateBugReportDto } from './dto/create-bug-report.dto';

const MAX_REPORTS_PER_DAY = 8;
const MAX_USER_REPLIES_PER_DAY = 40;
const MINE_TAKE = 30;
const ADMIN_LIST_TAKE = 200;
const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class BugReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly fcm: FcmService,
  ) {}

  async create(user: User, body: CreateBugReportDto) {
    const message = body.message.trim();
    if (message.length < 3) {
      throw new BadRequestException('Message is too short');
    }

    const screenshotPath = body.screenshotPath?.trim() || null;
    if (screenshotPath && !isValidBugReportStoragePath(screenshotPath)) {
      throw new BadRequestException('Invalid screenshot path');
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await this.prisma.bugReport.count({
      where: { userId: user.id, createdAt: { gte: since } },
    });
    if (recentCount >= MAX_REPORTS_PER_DAY) {
      throw new BadRequestException(
        'Too many bug reports today. Try again tomorrow.',
      );
    }

    const row = await this.prisma.bugReport.create({
      data: {
        userId: user.id,
        message,
        screenshotPath,
        appVersion: trimToNull(body.appVersion, 40),
        buildNumber: trimToNull(body.buildNumber, 20),
        platform: trimToNull(body.platform, 20),
        locale: trimToNull(body.locale, 16),
        route: trimToNull(body.route, 200),
        status: 'open',
      },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        createdAt: true,
      },
    });

    return toTicketView(row);
  }

  async listForAdmin(fromRaw?: string, toRaw?: string, statusFilter?: string) {
    const range = parseDateRange(fromRaw, toRaw);
    const createdAt = { gte: range.from, lte: range.to };
    const status = statusForFilter(statusFilter);

    const [rows, grouped] = await Promise.all([
      this.prisma.bugReport.findMany({
        where: {
          createdAt,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: ADMIN_LIST_TAKE,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              anonymousId: true,
              firebaseUid: true,
            },
          },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.bugReport.groupBy({
        by: ['status'],
        where: { createdAt },
        _count: { _all: true },
      }),
    ]);

    const counts = { open: 0, done: 0, all: 0 };
    for (const row of grouped) {
      const key = normalizeBugReportStatus(row.status);
      if (key) counts[key] += row._count._all;
      counts.all += row._count._all;
    }

    const reports = await Promise.all(
      rows.map(async (row) => {
        const screenshotUrl = row.screenshotPath
          ? await this.firebase.getSignedReadUrl(
              row.screenshotPath,
              SIGNED_URL_TTL_MS,
            )
          : null;
        return {
          ...toTicketView(row),
          message: row.message,
          screenshotPath: row.screenshotPath,
          screenshotUrl,
          appVersion: row.appVersion,
          buildNumber: row.buildNumber,
          platform: row.platform,
          locale: row.locale,
          route: row.route,
          updatedAt: row.updatedAt.toISOString(),
          user: row.user,
          messages: row.messages.map(toMessageView),
        };
      }),
    );

    return { reports, counts };
  }

  async listMine(user: User) {
    const rows = await this.prisma.bugReport.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: MINE_TAKE,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return { tickets: rows.map(toThreadView) };
  }

  async getMine(user: User, id: string) {
    const row = await this.prisma.bugReport.findFirst({
      where: { id, userId: user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    return toThreadView(row);
  }

  /** User follow-up reopens the ticket so it shows under Open in admin. */
  async replyAsUser(user: User, id: string, bodyRaw: string) {
    const body = bodyRaw.trim();
    if (!body) throw new BadRequestException('Message is empty');
    const ticket = await this.prisma.bugReport.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.bugReportMessage.count({
      where: {
        author: 'user',
        createdAt: { gte: since },
        report: { userId: user.id },
      },
    });
    if (recent >= MAX_USER_REPLIES_PER_DAY) {
      throw new BadRequestException('Too many replies today. Try again tomorrow.');
    }

    await this.prisma.$transaction([
      this.prisma.bugReportMessage.create({
        data: { reportId: id, author: 'user', body },
      }),
      this.prisma.bugReport.update({
        where: { id },
        data: { status: 'open' },
      }),
    ]);
    return this.getMine(user, id);
  }

  async replyAsAdmin(id: string, bodyRaw: string) {
    const body = bodyRaw.trim();
    if (!body) throw new BadRequestException('Message is empty');
    const ticket = await this.prisma.bugReport.findUnique({
      where: { id },
      select: {
        id: true,
        ticketNumber: true,
        userId: true,
        locale: true,
        user: { select: { fcmTokens: { select: { token: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const message = await this.prisma.bugReportMessage.create({
      data: { reportId: id, author: 'admin', body },
    });
    await this.prisma.bugReport.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    const code = formatTicketCode(ticket.ticketNumber);
    const english = ticket.locale === 'en';
    try {
      const invalid = await this.fcm.sendAndPersist({
        userId: ticket.userId,
        tokens: ticket.user.fcmTokens.map((t) => t.token),
        payload: {
          type: 'bug_report_reply',
          title: english
            ? `Reply on your report ${code}`
            : `ทีมงานตอบกลับเรื่องที่แจ้ง ${code}`,
          body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
          data: {
            // Older app builds only know /settings/bug-report; newer ones redirect on ?ticket.
            route: `/settings/bug-report?ticket=${id}`,
            ticketId: id,
          },
        },
      });
      if (invalid.length > 0) {
        await this.prisma.userFcmToken.deleteMany({
          where: { token: { in: invalid } },
        });
      }
    } catch {
      // Reply is saved even if the push fails.
    }
    return toMessageView(message);
  }

  async updateStatus(id: string, statusRaw: string) {
    const status = normalizeBugReportStatus(statusRaw);
    if (!status) {
      throw new BadRequestException('Invalid ticket status');
    }

    try {
      const row = await this.prisma.bugReport.update({
        where: { id },
        data: { status },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          createdAt: true,
        },
      });
      return toTicketView(row);
    } catch {
      throw new NotFoundException('Ticket not found');
    }
  }
}

function toTicketView(row: {
  id: string;
  ticketNumber: number;
  status: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    ticketCode: formatTicketCode(row.ticketNumber),
    status: (normalizeBugReportStatus(row.status) ??
      row.status) as BugReportStatus | string,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMessageView(row: {
  id: string;
  author: string;
  body: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    author: row.author === 'admin' ? 'admin' : 'user',
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

function toThreadView(row: {
  id: string;
  ticketNumber: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  message: string;
  messages: { id: string; author: string; body: string; createdAt: Date }[];
}) {
  return {
    ...toTicketView(row),
    message: row.message,
    updatedAt: row.updatedAt.toISOString(),
    messages: row.messages.map(toMessageView),
  };
}

function trimToNull(value: string | undefined, max: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}
