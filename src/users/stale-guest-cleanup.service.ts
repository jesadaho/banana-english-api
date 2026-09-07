import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type StaleGuestCleanupMode = 'off' | 'dry-run' | 'execute';

export type StaleGuestCleanupResult = {
  mode: StaleGuestCleanupMode;
  days: number;
  matched: number;
  deleted: number;
  sampleAnonymousIds: string[];
};

/**
 * Deletes abandoned guest rows so Total users stays honest.
 *
 * Safe reopen: the app keeps `anonymousId` in prefs; next API call
 * `AnonymousUserGuard` upserts a fresh User with the same id.
 */
@Injectable()
export class StaleGuestCleanupService {
  private readonly logger = new Logger(StaleGuestCleanupService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Daily 04:10 UTC — low-traffic window for TH daytime ops review. */
  @Cron('10 4 * * *')
  async runScheduled(): Promise<void> {
    const mode = this.mode();
    if (mode === 'off') return;
    try {
      const result = await this.runCleanup();
      this.logger.log(
        `Stale guest cleanup (${result.mode}): matched=${result.matched} deleted=${result.deleted} days=${result.days}`,
      );
    } catch (error) {
      this.logger.error(`Stale guest cleanup failed: ${String(error)}`);
    }
  }

  mode(): StaleGuestCleanupMode {
    const raw = (this.config.get<string>('STALE_GUEST_CLEANUP_MODE') ?? 'dry-run')
      .trim()
      .toLowerCase();
    if (raw === 'off' || raw === '0' || raw === 'false') return 'off';
    if (raw === 'execute' || raw === 'delete' || raw === 'on') return 'execute';
    return 'dry-run';
  }

  staleDays(): number {
    const n = Number(this.config.get<string>('STALE_GUEST_CLEANUP_DAYS') ?? '30');
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 30;
  }

  batchSize(): number {
    const n = Number(
      this.config.get<string>('STALE_GUEST_CLEANUP_BATCH') ?? '500',
    );
    return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 2000) : 500;
  }

  /** Prisma where for abandoned guests older than [days]. */
  staleGuestWhere(days = this.staleDays()): Prisma.UserWhereInput {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    return {
      onboardingCompleted: false,
      firebaseUid: null,
      createdAt: { lt: cutoff },
      authProviders: { none: {} },
      purchaseRecords: { none: {} },
      sessions: { none: { rewardsApplied: true } },
    };
  }

  async runCleanup(options?: {
    mode?: StaleGuestCleanupMode;
    days?: number;
  }): Promise<StaleGuestCleanupResult> {
    if (this.running) {
      return {
        mode: options?.mode ?? this.mode(),
        days: options?.days ?? this.staleDays(),
        matched: 0,
        deleted: 0,
        sampleAnonymousIds: [],
      };
    }

    this.running = true;
    try {
      const mode = options?.mode ?? this.mode();
      const days = options?.days ?? this.staleDays();
      if (mode === 'off') {
        return {
          mode,
          days,
          matched: 0,
          deleted: 0,
          sampleAnonymousIds: [],
        };
      }

      const where = this.staleGuestWhere(days);
      const matched = await this.prisma.user.count({ where });
      const sample = await this.prisma.user.findMany({
        where,
        select: { anonymousId: true },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      if (mode === 'dry-run' || matched === 0) {
        return {
          mode,
          days,
          matched,
          deleted: 0,
          sampleAnonymousIds: sample.map((u) => u.anonymousId),
        };
      }

      let deleted = 0;
      const batch = this.batchSize();
      // Loop until drained — each delete reduces the matched set.
      for (let i = 0; i < 50; i += 1) {
        const ids = await this.prisma.user.findMany({
          where,
          select: { id: true },
          take: batch,
          orderBy: { createdAt: 'asc' },
        });
        if (ids.length === 0) break;
        const result = await this.prisma.user.deleteMany({
          where: { id: { in: ids.map((u) => u.id) } },
        });
        deleted += result.count;
        if (ids.length < batch) break;
      }

      return {
        mode,
        days,
        matched,
        deleted,
        sampleAnonymousIds: sample.map((u) => u.anonymousId),
      };
    } finally {
      this.running = false;
    }
  }
}
