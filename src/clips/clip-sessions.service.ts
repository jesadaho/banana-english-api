import { BadRequestException, Injectable } from '@nestjs/common';
import { parseDateRange } from '../admin/admin-metrics.util';
import { PrismaService } from '../prisma/prisma.service';

export const CLIP_SESSION_MODES = ['watch', 'dictation', 'shadowing'] as const;
export type ClipSessionMode = (typeof CLIP_SESSION_MODES)[number];

/** Clip page sessions per mode (the app logs one per mode per page visit). */
@Injectable()
export class ClipSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, clipId: string, rawMode: unknown): Promise<{ ok: true }> {
    const mode = String(rawMode ?? '');
    if (!(CLIP_SESSION_MODES as readonly string[]).includes(mode)) {
      throw new BadRequestException('mode_invalid');
    }
    const clip = await this.prisma.clip.findUnique({ where: { id: clipId }, select: { id: true } });
    if (!clip) return { ok: true };
    await this.prisma.clipSession.create({ data: { userId, clipId, mode } });
    return { ok: true };
  }

  /**
   * Played to the end: marks this user's latest open session of that mode on
   * the clip (last 6 h); creates one if none (e.g. the open ping was lost).
   */
  async complete(userId: string, clipId: string, rawMode: unknown): Promise<{ ok: true }> {
    const mode = String(rawMode ?? '');
    if (!(CLIP_SESSION_MODES as readonly string[]).includes(mode)) {
      throw new BadRequestException('mode_invalid');
    }
    const clip = await this.prisma.clip.findUnique({ where: { id: clipId }, select: { id: true } });
    if (!clip) return { ok: true };
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const open = await this.prisma.clipSession.findFirst({
      where: { userId, clipId, mode, completedAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (open) {
      await this.prisma.clipSession.update({
        where: { id: open.id },
        data: { completedAt: new Date() },
      });
    } else {
      await this.prisma.clipSession.create({
        data: { userId, clipId, mode, completedAt: new Date() },
      });
    }
    return { ok: true };
  }

  /**
   * Admin Videos page: per clip × mode — plays (sessions), players, plays
   * finished. Sorted by total plays.
   */
  async topClips(fromRaw?: string, toRaw?: string) {
    let range: { from: Date; to: Date };
    try {
      range = parseDateRange(fromRaw, toRaw);
    } catch {
      throw new BadRequestException('invalid_range');
    }
    const where = { createdAt: { gte: range.from, lte: range.to } };
    const [plays, done, players] = await Promise.all([
      this.prisma.clipSession.groupBy({ by: ['clipId', 'mode'], where, _count: { _all: true } }),
      this.prisma.clipSession.groupBy({
        by: ['clipId', 'mode'],
        where: { ...where, completedAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.clipSession.findMany({
        where,
        distinct: ['clipId', 'mode', 'userId'],
        select: { clipId: true, mode: true },
      }),
    ]);
    const key = (c: string, m: string) => `${c}|${m}`;
    const doneMap = new Map(done.map((d) => [key(d.clipId, d.mode), d._count._all]));
    const playerMap = new Map<string, number>();
    for (const p of players) {
      const k = key(p.clipId, p.mode);
      playerMap.set(k, (playerMap.get(k) ?? 0) + 1);
    }
    const clipIds = [...new Set(plays.map((p) => p.clipId))];
    const clips = await this.prisma.clip.findMany({
      where: { id: { in: clipIds } },
      select: { id: true, title: true, titleTh: true, level: true, category: true, status: true },
    });
    type ModeStat = { plays: number; players: number; completed: number };
    const empty = (): ModeStat => ({ plays: 0, players: 0, completed: 0 });
    const rows = clips.map((c) => {
      const byMode = Object.fromEntries(
        CLIP_SESSION_MODES.map((m) => [m, empty()]),
      ) as Record<ClipSessionMode, ModeStat>;
      for (const p of plays) {
        if (p.clipId !== c.id) continue;
        const m = p.mode as ClipSessionMode;
        if (!byMode[m]) continue;
        byMode[m] = {
          plays: p._count._all,
          players: playerMap.get(key(c.id, m)) ?? 0,
          completed: doneMap.get(key(c.id, m)) ?? 0,
        };
      }
      const total = CLIP_SESSION_MODES.reduce(
        (a, m) => ({
          plays: a.plays + byMode[m].plays,
          completed: a.completed + byMode[m].completed,
        }),
        { plays: 0, completed: 0 },
      );
      return { ...c, byMode, totalPlays: total.plays, totalCompleted: total.completed };
    });
    rows.sort((a, b) => b.totalPlays - a.totalPlays);
    return { from: range.from.toISOString(), to: range.to.toISOString(), clips: rows };
  }

  /** Admin Retention → "Session volume by type": video_watch / video_dictation / video_shadowing. */
  async sessionMix(fromRaw?: string, toRaw?: string) {
    let range: { from: Date; to: Date };
    try {
      range = parseDateRange(fromRaw, toRaw);
    } catch {
      throw new BadRequestException('invalid_range');
    }
    const where = { createdAt: { gte: range.from, lte: range.to } };
    const [counts, players] = await Promise.all([
      this.prisma.clipSession.groupBy({ by: ['mode'], where, _count: { _all: true } }),
      this.prisma.clipSession.findMany({
        where,
        distinct: ['mode', 'userId'],
        select: { mode: true, userId: true },
      }),
    ]);
    const users = new Map<string, number>();
    for (const p of players) users.set(p.mode, (users.get(p.mode) ?? 0) + 1);
    const allUsers = new Set(players.map((p) => p.userId)).size;
    const rows = CLIP_SESSION_MODES.map((mode) => ({
      sessionType: `video_${mode}`,
      mode,
      count: counts.find((c) => c.mode === mode)?._count._all ?? 0,
      users: users.get(mode) ?? 0,
      source: 'clip_session',
    }));
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      rows,
      totalSessions: rows.reduce((a, r) => a + r.count, 0),
      totalUsers: allUsers,
    };
  }
}
