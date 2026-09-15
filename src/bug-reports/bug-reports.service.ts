import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
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
const ADMIN_LIST_TAKE = 200;
const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class BugReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
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
        };
      }),
    );

    return { reports, counts };
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

function trimToNull(value: string | undefined, max: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}
