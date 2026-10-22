import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EARLY_BIRD_PRODUCT_ID } from '../subscriptions/subscription-products';
import { AdminAuthGuard } from './admin-auth.guard';
import {
  buildEarlyBirdRows,
  earlyBirdDaily,
  filterEarlyBirdRows,
  summarizeEarlyBird,
} from './admin-early-bird.report';
import { parseDateRange } from './admin-metrics.util';

const PAGE_SIZE = 100;

@Controller('admin/early-bird')
@UseGuards(AdminAuthGuard)
export class AdminEarlyBirdController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Summary is all-time; the daily chart and table follow `from` / `to`.
   * `status`: all | reserved | purchased | walk_in. `all=1` returns every row (CSV).
   */
  @Get('reservations')
  async list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') pageRaw?: string,
    @Query('all') all?: string,
  ) {
    let range: { from: Date; to: Date };
    try {
      range = parseDateRange(from, to, 30);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date range',
      );
    }
    const [reserved, purchases] = await Promise.all([
      this.prisma.user.findMany({
        where: { earlyBirdReservedAt: { not: null } },
        select: {
          id: true,
          displayName: true,
          email: true,
          earlyBirdReservedAt: true,
          earlyBirdReserveSource: true,
        },
      }),
      this.prisma.subscriptionGrant.findMany({
        where: { productId: EARLY_BIRD_PRODUCT_ID },
        select: {
          userId: true,
          createdAt: true,
          priceThb: true,
          platform: true,
          productId: true,
          isSandbox: true,
          user: { select: { displayName: true, email: true } },
        },
      }),
    ]);
    const rows = buildEarlyBirdRows(reserved, purchases);
    const filtered = filterEarlyBirdRows(rows, { status, q, ...range });
    const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);
    const pageRows =
      all === '1' ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return {
      kpis: summarizeEarlyBird(rows),
      daily: earlyBirdDaily(rows, range.from, range.to),
      total: filtered.length,
      page,
      pageSize: PAGE_SIZE,
      rows: pageRows,
    };
  }
}
