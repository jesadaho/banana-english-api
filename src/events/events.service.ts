import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventStatus, Prisma, User } from '@prisma/client';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { FcmService } from '../notifications/fcm.service';
import type { PushNotificationPayload } from '../notifications/notification-templates';
import { PrismaService } from '../prisma/prisma.service';
import {
  EVENT_IMAGE_MAX_BYTES,
  eventBannerObjectPath,
  eventTierAvatarObjectPath,
  extensionForHeroMime,
  publicEventImageUrl,
} from './event-upload';
import {
  clockStatus,
  defaultCtaRoute,
  defaultEventAvatarId,
  eventsApiEnabled,
  eventTimezoneOrDefault,
  isAnomalousAttemptRate,
  isAnomalousScore,
  isEventGameKey,
  parseBangkokDateTime,
  shouldDistribute,
  shouldNotifyEndingSoon,
  shouldSnapshot,
  tierForRank,
  validateRewardTiers,
  bangkokMinuteKey,
} from './event.rules';
import {
  ANOMALY_ATTEMPT_WINDOW_MS,
  EVENT_GAME_LABELS,
  EVENT_LEADERBOARD_TOP,
  type EventAvatarGrant,
  type EventGameKey,
  type EventLeaderboardEntryDto,
} from './event.types';
import {
  AdminCreateEventDto,
  AdminEventTierDto,
  AdminUpdateEventDto,
} from './dto/admin-events.dto';

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const EVENT_INCLUDE = {
  rewardTiers: { orderBy: [{ rankFrom: 'asc' as const }, { sortOrder: 'asc' as const }] },
} satisfies Prisma.EventInclude;

type EventWithTiers = Prisma.EventGetPayload<{ include: typeof EVENT_INCLUDE }>;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly fcm: FcmService,
  ) {}

  async listForAdmin() {
    const events = await this.prisma.event.findMany({
      include: {
        ...EVENT_INCLUDE,
        _count: {
          select: { leaderboard: true, results: true, grants: true, attempts: true },
        },
      },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });
    return { events: events.map((event) => this.serializeAdmin(event)) };
  }

  async getForAdmin(id: string) {
    const event = await this.requireEvent(id);
    const live = await this.leaderboardPayload(event, null, { live: true, take: 20 });
    const snapshot = await this.leaderboardPayload(event, null, { live: false, take: 20 });
    return {
      event: this.serializeAdmin(event),
      live,
      snapshot,
    };
  }

  async create(body: AdminCreateEventDto) {
    const input = this.parseWrite(body);
    await this.assertSingleActive(input.event.gameKey, clockStatus(
      { ...input.event, status: 'DRAFT', snapshotAt: null, rewardHold: input.event.rewardHold },
      new Date(),
    ));
    const created = await this.prisma.event.create({
      data: {
        ...input.event,
        status: clockStatus(
          { ...input.event, status: 'DRAFT', snapshotAt: null, rewardHold: input.event.rewardHold },
          new Date(),
        ),
        rewardTiers: input.tiers.length
          ? {
              create: input.tiers.map((tier, index) => ({
                ...tier,
                avatarId: tier.avatarId.startsWith('event_new_')
                  ? defaultEventAvatarId('pending', tier.rankFrom)
                  : tier.avatarId,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: EVENT_INCLUDE,
    });
    if (created.rewardTiers.some((tier) => tier.avatarId.startsWith('event_pending_'))) {
      await this.prisma.$transaction(
        created.rewardTiers.map((tier) =>
          this.prisma.eventRewardTier.update({
            where: { id: tier.id },
            data: { avatarId: defaultEventAvatarId(created.id, tier.rankFrom) },
          }),
        ),
      );
    }
    return { event: this.serializeAdmin(await this.requireEvent(created.id)) };
  }

  async update(id: string, body: AdminUpdateEventDto) {
    const existing = await this.requireEvent(id);
    if (
      (existing.status === 'REWARDED' || existing.status === 'ARCHIVED') &&
      (body.startsAt || body.endsAt || body.gameKey || body.rewardTiers)
    ) {
      throw new BadRequestException('Rewarded events cannot change scoring fields');
    }
    const input = this.parseWrite({ ...this.toWriteShape(existing), ...body }, existing.id);
    await this.assertSingleActive(
      input.event.gameKey,
      clockStatus(
        { ...input.event, status: existing.status, snapshotAt: existing.snapshotAt, rewardHold: input.event.rewardHold },
        new Date(),
      ),
      existing.id,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      if (body.rewardTiers) {
        await tx.eventRewardTier.deleteMany({ where: { eventId: id } });
      }
      return tx.event.update({
        where: { id },
        data: {
          ...input.event,
          ...(body.rewardTiers
            ? {
                rewardTiers: {
                  create: input.tiers.map((tier, index) => ({
                    ...tier,
                    sortOrder: index,
                  })),
                },
              }
            : {}),
        },
        include: EVENT_INCLUDE,
      });
    });
    return { event: this.serializeAdmin(updated) };
  }

  async remove(id: string) {
    const event = await this.requireEvent(id);
    if (event.status !== 'DRAFT' && event.status !== 'SCHEDULED') {
      throw new BadRequestException('Only draft or scheduled events can be deleted');
    }
    await this.prisma.event.delete({ where: { id } });
    return { ok: true };
  }

  async uploadBanner(id: string, file?: UploadFile) {
    const event = await this.requireEvent(id);
    const uploaded = await this.savePublicImage(
      file,
      eventBannerObjectPath(event.id, this.requireImageExt(file)),
    );
    const updated = await this.prisma.event.update({
      where: { id },
      data: { bannerImageUrl: uploaded },
      include: EVENT_INCLUDE,
    });
    return { event: this.serializeAdmin(updated) };
  }

  async uploadTierAvatar(eventId: string, tierId: string, file?: UploadFile) {
    await this.requireEvent(eventId);
    const tier = await this.prisma.eventRewardTier.findFirst({
      where: { id: tierId, eventId },
    });
    if (!tier) {
      throw new NotFoundException('Reward tier not found');
    }
    const url = await this.savePublicImage(
      file,
      eventTierAvatarObjectPath(eventId, tierId, this.requireImageExt(file)),
    );
    await this.prisma.eventRewardTier.update({
      where: { id: tierId },
      data: { avatarImageUrl: url },
    });
    const event = await this.requireEvent(eventId);
    return { event: this.serializeAdmin(event) };
  }

  async setRewardHold(id: string, hold: boolean) {
    const event = await this.requireEvent(id);
    if (event.status !== 'FINALIZING' && event.status !== 'ENDED') {
      throw new BadRequestException('Hold is only available while finalizing');
    }
    const updated = await this.prisma.event.update({
      where: { id },
      data: { rewardHold: hold },
      include: EVENT_INCLUDE,
    });
    return { event: this.serializeAdmin(updated) };
  }

  async approveRewards(id: string) {
    const event = await this.requireEvent(id);
    if (event.status !== 'FINALIZING' && event.status !== 'ENDED') {
      throw new BadRequestException('Approve is only available after the event ends');
    }
    if (!event.snapshotAt) {
      await this.snapshotEvent(event.id);
    }
    await this.prisma.event.update({
      where: { id },
      data: { rewardHold: false, autoDistributeRewards: true },
    });
    await this.distributeRewards(id);
    return { event: this.serializeAdmin(await this.requireEvent(id)) };
  }

  async forceSnapshot(id: string) {
    await this.snapshotEvent(id, { force: true });
    return { event: this.serializeAdmin(await this.requireEvent(id)) };
  }

  async listAttempts(id: string, limit = 100) {
    await this.requireEvent(id);
    const attempts = await this.prisma.eventScoreAttempt.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: { user: { select: { displayName: true, anonymousId: true } } },
    });
    return {
      attempts: attempts.map((row) => ({
        id: row.id,
        userId: row.userId,
        displayName: row.user.displayName,
        score: row.score,
        topicId: row.topicId,
        createdAt: row.createdAt.toISOString(),
        anomalous: isAnomalousScore(row.score),
      })),
    };
  }

  async listAnomalies(id: string) {
    const event = await this.requireEvent(id);
    const since = new Date(Date.now() - ANOMALY_ATTEMPT_WINDOW_MS);
    const highScores = await this.prisma.eventLeaderboard.findMany({
      where: { eventId: id, bestScore: { gte: 90_000 } },
      include: { user: { select: { displayName: true } } },
      orderBy: { bestScore: 'desc' },
      take: 50,
    });
    const burst = await this.prisma.eventScoreAttempt.groupBy({
      by: ['userId'],
      where: { eventId: id, createdAt: { gte: since } },
      _count: { userId: true },
      _max: { score: true },
    });
    const burstUserIds = burst
      .filter((row) => isAnomalousAttemptRate(row._count.userId))
      .map((row) => row.userId);
    const burstUsers = burstUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: burstUserIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const names = new Map(burstUsers.map((user) => [user.id, user.displayName]));
    return {
      eventId: event.id,
      highScores: highScores.map((row) => ({
        userId: row.userId,
        displayName: row.user.displayName,
        bestScore: row.bestScore,
        playCount: row.playCount,
      })),
      attemptBursts: burst
        .filter((row) => isAnomalousAttemptRate(row._count.userId))
        .map((row) => ({
          userId: row.userId,
          displayName: names.get(row.userId) ?? null,
          attempts: row._count.userId,
          maxScore: row._max.score,
        })),
    };
  }

  async listActive() {
    const events = await this.prisma.event.findMany({
      where: { status: 'ACTIVE' },
      include: EVENT_INCLUDE,
      orderBy: { endsAt: 'asc' },
    });
    return { events: events.map((event) => this.serializePublic(event)) };
  }

  async getPublic(id: string) {
    const event = await this.requireEvent(id);
    if (event.status === 'DRAFT') {
      throw new NotFoundException('Event not found');
    }
    return { event: this.serializePublic(event) };
  }

  async leaderboard(id: string, user: User) {
    const event = await this.requireEvent(id);
    if (event.status === 'DRAFT') {
      throw new NotFoundException('Event not found');
    }
    const useSnapshot =
      event.status === 'FINALIZING' ||
      event.status === 'REWARDED' ||
      event.status === 'ARCHIVED' ||
      !!event.snapshotAt;
    return this.leaderboardPayload(event, user, { live: !useSnapshot, take: EVENT_LEADERBOARD_TOP });
  }

  async unseenRewards(userId: string) {
    const grants = await this.prisma.eventRewardGrant.findMany({
      where: { userId, seenAt: null },
      include: { event: { select: { id: true, name: true, gameKey: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      grants: grants.map((grant) => ({
        id: grant.id,
        eventId: grant.eventId,
        eventName: grant.event.name,
        gameKey: grant.event.gameKey,
        avatarId: grant.avatarId,
        avatarImageUrl: grant.avatarImageUrl,
        nameTh: grant.nameTh,
        nameEn: grant.nameEn,
        rank: grant.rank,
      })),
    };
  }

  async markGrantSeen(userId: string, grantId: string) {
    const grant = await this.prisma.eventRewardGrant.findFirst({
      where: { id: grantId, userId },
    });
    if (!grant) {
      throw new NotFoundException('Reward not found');
    }
    if (!grant.seenAt) {
      await this.prisma.eventRewardGrant.update({
        where: { id: grantId },
        data: { seenAt: new Date() },
      });
    }
    return { ok: true };
  }

  async listGrantedAvatars(userId: string): Promise<EventAvatarGrant[]> {
    const grants = await this.prisma.eventRewardGrant.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const seen = new Set<string>();
    const avatars: EventAvatarGrant[] = [];
    for (const grant of grants) {
      if (seen.has(grant.avatarId)) continue;
      seen.add(grant.avatarId);
      avatars.push({
        id: grant.avatarId,
        imageUrl: grant.avatarImageUrl ?? '',
        nameTh: grant.nameTh,
        nameEn: grant.nameEn,
      });
    }
    return avatars.filter((avatar) => avatar.imageUrl);
  }

  async recordScore(params: {
    user: User;
    gameKey: EventGameKey;
    score: number;
    avatarId?: string | null;
    topicId?: string | null;
  }): Promise<void> {
    if (!eventsApiEnabled()) return;
    const event = await this.findActiveEvent(params.gameKey, params.topicId);
    if (!event) return;
    const rounded = Math.floor(params.score);
    const displayName = params.user.displayName?.trim() || null;
    const avatar = params.avatarId?.trim() || null;
    await this.prisma.eventScoreAttempt.create({
      data: {
        eventId: event.id,
        userId: params.user.id,
        score: rounded,
        topicId: params.topicId ?? event.topicId,
      },
    });
    const existing = await this.prisma.eventLeaderboard.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: params.user.id } },
    });
    if (!existing) {
      await this.prisma.eventLeaderboard.create({
        data: {
          eventId: event.id,
          userId: params.user.id,
          bestScore: rounded,
          playCount: 1,
          displayName,
          avatarId: avatar,
        },
      });
      return;
    }
    if (rounded <= existing.bestScore) return;
    await this.prisma.eventLeaderboard.update({
      where: { id: existing.id },
      data: {
        bestScore: rounded,
        playCount: { increment: 1 },
        displayName: displayName ?? existing.displayName,
        avatarId: avatar ?? existing.avatarId,
      },
    });
  }

  async runScheduler(now = new Date()): Promise<void> {
    if (!eventsApiEnabled()) return;
    const locked = await this.tryLock('event_scheduler', bangkokMinuteKey(now));
    if (!locked) return;
    const events = await this.prisma.event.findMany({
      where: { status: { not: 'ARCHIVED' } },
      include: EVENT_INCLUDE,
    });
    for (const event of events) {
      try {
        await this.advanceEvent(event, now);
      } catch (error) {
        this.logger.error(`Event ${event.id} tick failed: ${String(error).slice(0, 240)}`);
      }
    }
  }

  async findActiveEvent(
    gameKey: string,
    topicId?: string | null,
    now = new Date(),
  ): Promise<EventWithTiers | null> {
    const events = await this.prisma.event.findMany({
      where: {
        gameKey,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: EVENT_INCLUDE,
    });
    if (topicId) {
      return (
        events.find((event) => !event.topicId || event.topicId === topicId) ?? null
      );
    }
    return events[0] ?? null;
  }

  private async advanceEvent(event: EventWithTiers, now: Date): Promise<void> {
    const next = clockStatus(event, now);
    if (next === 'ACTIVE' && event.status !== 'ACTIVE') {
      const otherActive = await this.prisma.event.findFirst({
        where: { gameKey: event.gameKey, status: 'ACTIVE', id: { not: event.id } },
        select: { id: true },
      });
      if (otherActive) {
        this.logger.warn(
          `Skip activating ${event.id}; ${otherActive.id} is already Active for ${event.gameKey}`,
        );
        return;
      }
      await this.prisma.event.updateMany({
        where: { gameKey: event.gameKey, status: 'REWARDED', id: { not: event.id } },
        data: { status: 'ARCHIVED', archivedAt: now },
      });
      await this.prisma.event.update({
        where: { id: event.id },
        data: { status: 'ACTIVE' },
      });
      if (!event.startNotifiedAt) {
        await this.notifyStart(event);
      }
      return;
    }

    if (next !== event.status && next !== 'FINALIZING') {
      await this.prisma.event.update({
        where: { id: event.id },
        data: { status: next as EventStatus },
      });
      event = { ...event, status: next as EventStatus };
    }

    if (shouldNotifyEndingSoon(event, now, !!event.endingSoonNotifiedAt)) {
      await this.notifyEndingSoon(event);
    }

    if (shouldSnapshot(event, now)) {
      await this.snapshotEvent(event.id);
      event = await this.requireEvent(event.id);
    }

    if (shouldDistribute(event, now)) {
      await this.distributeRewards(event.id);
    }
  }

  async snapshotEvent(eventId: string, options: { force?: boolean } = {}): Promise<void> {
    const event = await this.requireEvent(eventId);
    if (event.snapshotAt && !options.force) return;
    const rows = await this.prisma.eventLeaderboard.findMany({
      where: { eventId },
      orderBy: [{ bestScore: 'desc' }, { updatedAt: 'asc' }],
    });
    await this.prisma.$transaction(async (tx) => {
      if (options.force) {
        await tx.eventResult.deleteMany({ where: { eventId } });
      }
      if (rows.length > 0) {
        await tx.eventResult.createMany({
          data: rows.map((row, index) => ({
            eventId,
            userId: row.userId,
            rank: index + 1,
            score: row.bestScore,
            displayName: row.displayName,
            avatarId: row.avatarId,
          })),
          skipDuplicates: true,
        });
      }
      await tx.event.update({
        where: { id: eventId },
        data: {
          status: 'FINALIZING',
          snapshotAt: new Date(),
        },
      });
    });
    const fresh = await this.requireEvent(eventId);
    if (!fresh.endedNotifiedAt) {
      await this.notifyEnded(fresh);
    }
  }

  async distributeRewards(eventId: string): Promise<void> {
    const event = await this.requireEvent(eventId);
    if (event.rewardHold) return;
    if (!event.snapshotAt) {
      await this.snapshotEvent(eventId);
    }
    const results = await this.prisma.eventResult.findMany({
      where: { eventId },
      orderBy: { rank: 'asc' },
    });
    for (const result of results) {
      const tier = tierForRank(result.rank, event.rewardTiers);
      if (!tier) continue;
      await this.unlockAvatarForEvent(result.userId, tier.avatarId);
      try {
        const grant = await this.prisma.eventRewardGrant.create({
          data: {
            eventId,
            userId: result.userId,
            rewardTierId: tier.id,
            avatarId: tier.avatarId,
            avatarImageUrl: tier.avatarImageUrl,
            nameTh: tier.nameTh,
            nameEn: tier.nameEn,
            rank: result.rank,
          },
        });
        await this.notifyReward(event, result.userId, result.rank, grant.id, tier.nameTh);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'REWARDED',
        rewardedAt: new Date(),
        rewardHold: false,
      },
    });
  }

  async unlockAvatarForEvent(userId: string, avatarId: string): Promise<void> {
    const id = avatarId.trim();
    if (!id) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { unlockedAvatarIds: true },
    });
    if (!user || user.unlockedAvatarIds.includes(id)) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        unlockedAvatarIds: { set: [...new Set([...user.unlockedAvatarIds, id])] },
      },
    });
  }

  private async leaderboardPayload(
    event: EventWithTiers,
    user: User | null,
    options: { live: boolean; take: number },
  ) {
    const empty = {
      eventId: event.id,
      status: event.status,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      rewardTiers: event.rewardTiers.map((tier) => this.serializeTier(tier)),
      top: [] as EventLeaderboardEntryDto[],
      me: null as EventLeaderboardEntryDto | null,
      snapshot: !options.live,
    };
    if (options.live) {
      const rows = await this.prisma.eventLeaderboard.findMany({
        where: { eventId: event.id },
        orderBy: [{ bestScore: 'desc' }, { updatedAt: 'asc' }],
        take: options.take,
        include: { user: { select: { displayName: true } } },
      });
      const top = rows.map((row, index) => ({
        rank: index + 1,
        name: row.user.displayName?.trim() || row.displayName?.trim() || 'Player',
        score: row.bestScore,
        avatarId: row.avatarId,
        isYou: user ? row.userId === user.id : false,
      }));
      let me: EventLeaderboardEntryDto | null = null;
      if (user) {
        const mine = await this.prisma.eventLeaderboard.findUnique({
          where: { eventId_userId: { eventId: event.id, userId: user.id } },
          include: { user: { select: { displayName: true } } },
        });
        if (mine) {
          const better = await this.prisma.eventLeaderboard.count({
            where: {
              eventId: event.id,
              OR: [
                { bestScore: { gt: mine.bestScore } },
                { bestScore: mine.bestScore, updatedAt: { lt: mine.updatedAt } },
              ],
            },
          });
          me = {
            rank: better + 1,
            name:
              mine.user.displayName?.trim() ||
              user.displayName?.trim() ||
              mine.displayName?.trim() ||
              'You',
            score: mine.bestScore,
            avatarId: mine.avatarId,
            isYou: true,
          };
        }
      }
      return { ...empty, top, me };
    }

    const rows = await this.prisma.eventResult.findMany({
      where: { eventId: event.id },
      orderBy: { rank: 'asc' },
      take: options.take,
      include: { user: { select: { displayName: true } } },
    });
    const top = rows.map((row) => ({
      rank: row.rank,
      name: row.user.displayName?.trim() || row.displayName?.trim() || 'Player',
      score: row.score,
      avatarId: row.avatarId,
      isYou: user ? row.userId === user.id : false,
    }));
    let me: EventLeaderboardEntryDto | null = null;
    if (user) {
      const mine = await this.prisma.eventResult.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
        include: { user: { select: { displayName: true } } },
      });
      if (mine) {
        me = {
          rank: mine.rank,
          name:
            mine.user.displayName?.trim() ||
            user.displayName?.trim() ||
            mine.displayName?.trim() ||
            'You',
          score: mine.score,
          avatarId: mine.avatarId,
          isYou: true,
        };
      }
    }
    return { ...empty, top, me };
  }

  private parseWrite(
    body: {
      gameKey?: string | null;
      topicId?: string | null;
      name?: string | null;
      startsAt?: string | null;
      endsAt?: string | null;
      timezone?: string | null;
      enabled?: boolean;
      autoDistributeRewards?: boolean;
      rewardHold?: boolean;
      headlineTh?: string | null;
      headlineEn?: string | null;
      bannerImageUrl?: string | null;
      ctaRoute?: string | null;
      rewardTiers?: AdminEventTierDto[];
    },
    eventId?: string,
  ) {
    const gameKey = body.gameKey;
    if (!gameKey || !isEventGameKey(gameKey)) {
      throw new BadRequestException('Unknown gameKey');
    }
    if (!body.name?.trim() || !body.startsAt || !body.endsAt) {
      throw new BadRequestException('name, startsAt, and endsAt are required');
    }
    let startsAt: Date;
    let endsAt: Date;
    try {
      startsAt = parseBangkokDateTime(body.startsAt);
      endsAt = parseBangkokDateTime(body.endsAt, { endOfDay: true });
    } catch (error) {
      throw new BadRequestException(String(error));
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    const tiers = (body.rewardTiers ?? []).map((tier, index) =>
      this.normalizeTier(tier, eventId ?? 'new', index),
    );
    try {
      validateRewardTiers(tiers);
    } catch (error) {
      throw new BadRequestException(String(error));
    }
    return {
      event: {
        gameKey,
        topicId: body.topicId?.trim() || null,
        name: body.name.trim(),
        startsAt,
        endsAt,
        timezone: eventTimezoneOrDefault(body.timezone),
        enabled: body.enabled === true,
        autoDistributeRewards: body.autoDistributeRewards !== false,
        rewardHold: body.rewardHold === true,
        headlineTh: body.headlineTh?.trim() || null,
        headlineEn: body.headlineEn?.trim() || null,
        bannerImageUrl: body.bannerImageUrl?.trim() || null,
        ctaRoute: body.ctaRoute?.trim() || defaultCtaRoute(gameKey),
      },
      tiers,
    };
  }

  private normalizeTier(tier: AdminEventTierDto, eventId: string, index: number) {
    return {
      rankFrom: tier.rankFrom,
      rankTo: tier.rankTo,
      avatarId: tier.avatarId?.trim() || defaultEventAvatarId(eventId, tier.rankFrom),
      avatarImageUrl: tier.avatarImageUrl?.trim() || null,
      nameTh: tier.nameTh.trim(),
      nameEn: tier.nameEn.trim(),
      sortOrder: index,
    };
  }

  private toWriteShape(event: EventWithTiers): AdminCreateEventDto {
    return {
      gameKey: event.gameKey,
      topicId: event.topicId ?? undefined,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      timezone: event.timezone,
      enabled: event.enabled,
      autoDistributeRewards: event.autoDistributeRewards,
      rewardHold: event.rewardHold,
      headlineTh: event.headlineTh ?? undefined,
      headlineEn: event.headlineEn ?? undefined,
      bannerImageUrl: event.bannerImageUrl ?? undefined,
      ctaRoute: event.ctaRoute ?? undefined,
      rewardTiers: event.rewardTiers.map((tier) => ({
        rankFrom: tier.rankFrom,
        rankTo: tier.rankTo,
        avatarId: tier.avatarId,
        avatarImageUrl: tier.avatarImageUrl ?? undefined,
        nameTh: tier.nameTh,
        nameEn: tier.nameEn,
      })),
    };
  }

  private serializeAdmin(event: EventWithTiers & { _count?: { leaderboard: number; results: number; grants: number; attempts: number } }) {
    return {
      ...this.serializePublic(event),
      enabled: event.enabled,
      autoDistributeRewards: event.autoDistributeRewards,
      rewardHold: event.rewardHold,
      startNotifiedAt: event.startNotifiedAt?.toISOString() ?? null,
      endingSoonNotifiedAt: event.endingSoonNotifiedAt?.toISOString() ?? null,
      endedNotifiedAt: event.endedNotifiedAt?.toISOString() ?? null,
      snapshotAt: event.snapshotAt?.toISOString() ?? null,
      rewardedAt: event.rewardedAt?.toISOString() ?? null,
      archivedAt: event.archivedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      counts: event._count ?? undefined,
    };
  }

  private serializePublic(event: EventWithTiers) {
    return {
      id: event.id,
      gameKey: event.gameKey,
      topicId: event.topicId,
      name: event.name,
      status: event.status,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      timezone: event.timezone,
      headlineTh: event.headlineTh,
      headlineEn: event.headlineEn,
      bannerImageUrl: event.bannerImageUrl,
      ctaRoute: event.ctaRoute || defaultCtaRoute(event.gameKey as EventGameKey),
      gameLabel: isEventGameKey(event.gameKey) ? EVENT_GAME_LABELS[event.gameKey] : event.gameKey,
      rewardTiers: event.rewardTiers.map((tier) => this.serializeTier(tier)),
    };
  }

  private serializeTier(tier: EventWithTiers['rewardTiers'][number]) {
    return {
      id: tier.id,
      rankFrom: tier.rankFrom,
      rankTo: tier.rankTo,
      rewardType: tier.rewardType,
      avatarId: tier.avatarId,
      avatarImageUrl: tier.avatarImageUrl,
      nameTh: tier.nameTh,
      nameEn: tier.nameEn,
    };
  }

  private async assertSingleActive(
    gameKey: string,
    nextStatus: string,
    exceptId?: string,
  ): Promise<void> {
    if (nextStatus !== 'ACTIVE') return;
    const other = await this.prisma.event.findFirst({
      where: {
        gameKey,
        status: 'ACTIVE',
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true, name: true },
    });
    if (other) {
      throw new ConflictException(
        `An Active event already exists for this game (${other.name})`,
      );
    }
  }

  private async requireEvent(id: string): Promise<EventWithTiers> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: EVENT_INCLUDE,
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  private requireImageExt(file?: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image is required');
    }
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
      throw new BadRequestException('Image must be 5MB or smaller');
    }
    const ext = extensionForHeroMime(file.mimetype);
    if (!ext) {
      throw new BadRequestException('Image must be jpeg, png, or webp');
    }
    return ext;
  }

  private async savePublicImage(file: UploadFile | undefined, objectPath: string) {
    const ext = this.requireImageExt(file);
    void ext;
    const uploaded = await this.firebase.uploadPublicFile(
      objectPath,
      file!.buffer,
      file!.mimetype,
    );
    if (!uploaded) {
      throw new ServiceUnavailableException('Image upload unavailable');
    }
    return publicEventImageUrl(uploaded.bucket, objectPath);
  }

  private async tryLock(jobKey: string, runKey: string): Promise<boolean> {
    try {
      await this.prisma.eventJobLock.create({ data: { jobKey, runKey } });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  private async userIdsWhoPlayed(event: EventWithTiers): Promise<string[]> {
    if (event.gameKey === 'emoji_speak_endless') {
      const rows = await this.prisma.emojiSpeakEndlessWeeklyScore.findMany({
        where: { weekKey: 'all' },
        select: { userId: true },
        distinct: ['userId'],
      });
      return rows.map((row) => row.userId);
    }
    if (event.gameKey === 'word_cards_endless') {
      const rows = await this.prisma.wordCardsEndlessScore.findMany({
        select: { userId: true },
        distinct: ['userId'],
      });
      return rows.map((row) => row.userId);
    }
    const topicId = event.topicId || 'challenge';
    const rows = await this.prisma.explainItTopicScore.findMany({
      where: { topicId },
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.map((row) => row.userId);
  }

  private async notifyStart(event: EventWithTiers) {
    const userIds = await this.userIdsWhoPlayed(event);
    const route = event.ctaRoute || defaultCtaRoute(event.gameKey as EventGameKey);
    await this.notifyUsers(userIds, {
      type: 'event_start',
      title: '🎉 อีเวนต์เริ่มแล้ว!',
      body: `${event.name} เปิดแข่งแล้ว มาลุยกัน`,
      data: { route, eventId: event.id, gameKey: event.gameKey },
    });
    await this.prisma.event.update({
      where: { id: event.id },
      data: { startNotifiedAt: new Date() },
    });
  }

  private async notifyEndingSoon(event: EventWithTiers) {
    const rows = await this.prisma.eventLeaderboard.findMany({
      where: { eventId: event.id },
      select: { userId: true },
    });
    const route = event.ctaRoute || defaultCtaRoute(event.gameKey as EventGameKey);
    await this.notifyUsers(
      rows.map((row) => row.userId),
      {
        type: 'event_ending_soon',
        title: '⏰ อีเวนต์ใกล้จบแล้ว',
        body: `${event.name} เหลืออีกไม่ถึง 24 ชม. รีบเก็บคะแนน!`,
        data: { route, eventId: event.id, gameKey: event.gameKey },
      },
    );
    await this.prisma.event.update({
      where: { id: event.id },
      data: { endingSoonNotifiedAt: new Date() },
    });
  }

  private async notifyEnded(event: EventWithTiers) {
    const rows = await this.prisma.eventResult.findMany({
      where: { eventId: event.id },
      select: { userId: true, rank: true },
    });
    const route = event.ctaRoute || defaultCtaRoute(event.gameKey as EventGameKey);
    for (const row of rows) {
      await this.notifyUser(row.userId, {
        type: 'event_ended',
        title: '🏁 อีเวนต์จบแล้ว',
        body: `${event.name} อันดับของคุณคือ #${row.rank}`,
        data: {
          route,
          eventId: event.id,
          gameKey: event.gameKey,
          rank: String(row.rank),
        },
      });
    }
    await this.prisma.event.update({
      where: { id: event.id },
      data: { endedNotifiedAt: new Date() },
    });
  }

  private async notifyReward(
    event: EventWithTiers,
    userId: string,
    rank: number,
    grantId: string,
    nameTh: string,
  ) {
    await this.notifyUser(userId, {
      type: 'event_reward',
      title: '🎁 ได้ Avatar ใหม่!',
      body: `อันดับ #${rank} ของ ${event.name} — ปลดล็อก ${nameTh}`,
      data: {
        route: '/games',
        eventId: event.id,
        grantId,
        gameKey: event.gameKey,
      },
    });
  }

  private async notifyUsers(userIds: string[], payload: PushNotificationPayload) {
    const unique = [...new Set(userIds)];
    for (const userId of unique) {
      await this.notifyUser(userId, payload);
    }
  }

  private async notifyUser(userId: string, payload: PushNotificationPayload) {
    try {
      const tokens = await this.prisma.userFcmToken.findMany({
        where: { userId },
        select: { token: true },
      });
      await this.fcm.sendAndPersist({
        userId,
        tokens: tokens.map((row) => row.token),
        payload,
      });
    } catch (error) {
      this.logger.warn(
        `Event notify ${payload.type} failed for ${userId}: ${String(error).slice(0, 160)}`,
      );
    }
  }
}
