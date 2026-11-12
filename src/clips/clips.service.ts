import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GeminiChatService } from '../gemini/gemini-chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { placementBandFromResult } from '../placement/placement-band';
import { parrotoViews } from './parroto-popularity';
import {
  CLIP_CATEGORIES,
  CLIP_CATEGORY_TITLES,
  normalizeClipCategory,
  CLIP_CHANNELS,
  CLIP_CHANNEL_TITLES,
  clipChannelOf,
  pickRecommendedClips,
  sortClipsForLearner,
  recommendedClipLevel,
  CLIP_LEVELS,
  type TimedLine,
  clipWords,
  isClipMode,
  normalizeDictation,
  normalizeHighlights,
  parseTranscript,
  parseYoutubeId,
  validateTimedLines,
} from './clips.rules';

type ClipRow = Prisma.ClipGetPayload<{ include: { _count: { select: { sentences: true } } } }>;

@Injectable()
export class ClipsService {
  private readonly logger = new Logger(ClipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: GeminiChatService,
  ) {}

  // ------------------------------------------------------------------ app

  /** Clips tab: "continue" + one section per category (published only). */
  async listForUser(userId: string) {
    const clips = await this.prisma.clip.findMany({
      where: { status: 'published' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { sentences: true } } },
    });
    const progress = await this.prisma.clipProgress.findMany({
      where: { userId, clipId: { in: clips.map((c) => c.id) } },
      orderBy: { updatedAt: 'desc' },
    });
    const byClip = new Map<string, typeof progress>();
    for (const p of progress) {
      byClip.set(p.clipId, [...(byClip.get(p.clipId) ?? []), p]);
    }
    const views = clips.map((c) => this.cardView(c, byClip.get(c.id) ?? []));
    const cont = progress.find((p) => p.mode !== 'watch' && !p.completedAt);
    const sections = CLIP_CATEGORIES
      .map((cat) => ({
        id: cat,
        titleEn: CLIP_CATEGORY_TITLES[cat].en,
        titleTh: CLIP_CATEGORY_TITLES[cat].th,
        clips: views.filter((v) => v.category === cat),
      }))
      .filter((s) => s.clips.length > 0);
    // Continue Watching rail: clips with unfinished progress, latest first.
    const continueIds: string[] = [];
    for (const p of progress) {
      if (p.completedAt || continueIds.includes(p.clipId)) continue;
      continueIds.push(p.clipId);
      if (continueIds.length >= 10) break;
    }
    const byId = new Map(views.map((v) => [v.id, v]));
    const continueList = continueIds
      .map((id) => {
        const p = progress.find((row) => row.clipId === id && !row.completedAt);
        const v = byId.get(id);
        return v ? { ...v, continueMode: p?.mode ?? 'watch' } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const channels = CLIP_CHANNELS.map((id) => ({
      id,
      titleEn: CLIP_CHANNEL_TITLES[id].en,
      titleTh: CLIP_CHANNEL_TITLES[id].th,
      count: views.filter((v) => v.channel === id).length,
    })).filter((c) => c.count > 0);
    // Recommended for You: unstarted clips around the learner's level.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { placementResult: true, selfReportedEnglishLevel: true },
    });
    const startedIds = new Set(progress.map((p) => p.clipId));
    const recLevel = recommendedClipLevel({
      practisedLevels: [...startedIds]
        .map((id) => byId.get(id)?.level)
        .filter((l): l is string => !!l),
      placementBand: placementBandFromResult(user?.placementResult),
      selfReported: user?.selfReportedEnglishLevel,
    });
    const recommended = pickRecommendedClips(views, {
      level: recLevel,
      startedIds,
      popularity: (v) => parrotoViews(v.title),
    });
    return {
      continue: cont ? views.find((v) => v.id === cont.clipId) ?? null : null,
      continueMode: cont?.mode ?? null,
      continueList,
      recommended,
      recommendedLevel: recLevel,
      popular: await this.popularClips(views),
      channels,
      // Every category rail: learner's level first, then Parroto popularity.
      sections: sections.map((sec) => ({
        ...sec,
        clips: sortClipsForLearner(sec.clips, {
          level: recLevel,
          popularity: (v) => parrotoViews(v.title),
        }),
      })),
    };
  }

  /**
   * Popular Now: ranked by Parroto's view counts for now (our own play data
   * is still thin), then topped up with our most played (ClipSession, 30 d)
   * and most practised clips.
   */
  private async popularClips<T extends { id: string; title: string }>(views: T[]): Promise<T[]> {
    const fromParroto = views
      .map((v) => ({ v, n: parrotoViews(v.title) }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((r) => r.v);
    if (fromParroto.length >= 10) return fromParroto.slice(0, 10);

    const since = new Date(Date.now() - 30 * 86_400_000);
    const ids = views.map((v) => v.id);
    let ranked: { clipId: string; n: number }[] = [];
    try {
      const rows = await this.prisma.clipSession.groupBy({
        by: ['clipId'],
        where: { clipId: { in: ids }, createdAt: { gte: since } },
        _count: { _all: true },
      });
      ranked = rows.map((r) => ({ clipId: r.clipId, n: r._count._all }));
    } catch {
      ranked = []; // table not migrated yet
    }
    const rows = await this.prisma.clipProgress.groupBy({
      by: ['clipId'],
      where: { clipId: { in: ids } },
      _count: { _all: true },
    });
    const seen = new Set(ranked.map((r) => r.clipId));
    ranked.push(
      ...rows
        .filter((r) => !seen.has(r.clipId))
        .map((r) => ({ clipId: r.clipId, n: r._count._all / 1000 })),
    );
    ranked.sort((a, b) => b.n - a.n);
    const byId = new Map(views.map((v) => [v.id, v]));
    const picked = new Set(fromParroto.map((v) => v.id));
    const rest = ranked
      .map((r) => byId.get(r.clipId))
      .filter((v): v is T => !!v && !picked.has(v.id));
    return [...fromParroto, ...rest].slice(0, 10);
  }

  async getForUser(userId: string, clipId: string) {
    const clip = await this.prisma.clip.findFirst({
      where: { id: clipId, status: 'published' },
      include: { sentences: { orderBy: { idx: 'asc' } }, _count: { select: { sentences: true } } },
    });
    if (!clip) throw new NotFoundException('clip_not_found');
    const progress = await this.prisma.clipProgress.findMany({
      where: { userId, clipId },
    });
    return {
      clip: this.cardView(clip, progress),
      sentences: clip.sentences.map((s) => ({
        idx: s.idx,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
        textTh: s.textTh,
        dictation: normalizeDictation(s.dictation, s.text),
        highlights: normalizeHighlights(s.highlights, s.text),
      })),
    };
  }

  /** One sentence done in a mode. `completed` marks the clip finished. */
  async saveProgress(
    userId: string,
    clipId: string,
    body: { mode?: unknown; idx?: unknown; correct?: unknown; score?: unknown; completed?: unknown },
  ) {
    if (!isClipMode(body.mode)) throw new BadRequestException('mode_invalid');
    const idx = Number(body.idx);
    if (!Number.isInteger(idx) || idx < 0) throw new BadRequestException('idx_invalid');
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      select: { id: true, _count: { select: { sentences: true } } },
    });
    if (!clip) throw new NotFoundException('clip_not_found');
    const correct = body.correct === true ? 1 : 0;
    const score = Math.max(0, Math.min(100, Math.round(Number(body.score) || 0)));
    const completed = body.completed === true;
    const existing = await this.prisma.clipProgress.findUnique({
      where: { userId_clipId_mode: { userId, clipId, mode: body.mode } },
    });
    const row = existing
      ? await this.prisma.clipProgress.update({
          where: { id: existing.id },
          data: {
            lastIdx: Math.max(existing.lastIdx, idx),
            doneCount: { increment: 1 },
            correctCount: { increment: correct },
            scoreSum: { increment: score },
            ...(completed ? { completedAt: new Date() } : {}),
          },
        })
      : await this.prisma.clipProgress.create({
          data: {
            userId,
            clipId,
            mode: body.mode,
            lastIdx: idx,
            doneCount: 1,
            correctCount: correct,
            scoreSum: score,
            completedAt: completed ? new Date() : null,
          },
        });
    return { progress: this.progressView(row, clip._count.sentences) };
  }

  private progressView(
    p: { mode: string; lastIdx: number; doneCount: number; correctCount: number; scoreSum: number; completedAt: Date | null },
    total: number,
  ) {
    return {
      mode: p.mode,
      lastIdx: p.lastIdx,
      done: Math.min(p.doneCount, total),
      correct: p.correctCount,
      avgScore: p.doneCount ? Math.round(p.scoreSum / p.doneCount) : 0,
      completed: p.completedAt != null,
      total,
    };
  }

  private cardView(
    c: ClipRow,
    progress: Array<{ mode: string; lastIdx: number; doneCount: number; correctCount: number; scoreSum: number; completedAt: Date | null }>,
  ) {
    const total = c._count.sentences;
    return {
      id: c.id,
      source: c.source,
      youtubeId: c.youtubeId,
      videoUrl: c.videoUrl,
      credit: c.credit,
      channel: clipChannelOf(c.credit),
      title: c.title,
      titleTh: c.titleTh,
      level: c.level,
      category: c.category,
      durationSec: c.durationSec,
      thumbnailUrl:
        c.thumbnailUrl ||
        (c.youtubeId ? `https://i.ytimg.com/vi/${c.youtubeId}/hqdefault.jpg` : ''),
      sentenceCount: total,
      progress: progress.map((p) => this.progressView(p, total)),
    };
  }

  // ---------------------------------------------------------------- admin

  async adminList() {
    const clips = await this.prisma.clip.findMany({
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { sentences: true } } },
    });
    return { clips: clips.map((c) => ({ ...this.cardView(c, []), status: c.status, sortOrder: c.sortOrder })) };
  }

  async adminGet(id: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id },
      include: { sentences: { orderBy: { idx: 'asc' } } },
    });
    if (!clip) throw new NotFoundException('clip_not_found');
    return {
      clip: {
        id: clip.id,
        source: clip.source,
        youtubeId: clip.youtubeId,
        videoUrl: clip.videoUrl,
        sourceUrl: clip.sourceUrl,
        credit: clip.credit,
        title: clip.title,
        titleTh: clip.titleTh,
        level: clip.level,
        category: clip.category,
        durationSec: clip.durationSec,
        thumbnailUrl: clip.thumbnailUrl,
        status: clip.status,
        sortOrder: clip.sortOrder,
      },
      sentences: clip.sentences.map((s) => ({
        idx: s.idx,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
        textTh: s.textTh,
        dictation: normalizeDictation(s.dictation, s.text),
        highlights: normalizeHighlights(s.highlights, s.text),
      })),
    };
  }

  /** New draft from a YouTube URL; title/thumbnail from YouTube oEmbed. */
  async adminCreate(body: { url?: unknown; level?: unknown; category?: unknown; title?: unknown }) {
    const youtubeId = parseYoutubeId(String(body.url ?? ''));
    if (!youtubeId) throw new BadRequestException('youtube_url_invalid');
    const meta = await this.oEmbed(youtubeId);
    const clip = await this.prisma.clip.create({
      data: {
        source: 'youtube',
        youtubeId,
        title: (typeof body.title === 'string' && body.title.trim()) || meta?.title || youtubeId,
        thumbnailUrl: meta?.thumbnailUrl ?? '',
        level: this.pickLevel(body.level),
        category: this.pickCategory(body.category),
      },
    });
    return this.adminGet(clip.id);
  }

  async adminUpdate(
    id: string,
    body: { title?: unknown; titleTh?: unknown; level?: unknown; category?: unknown; durationSec?: unknown; sortOrder?: unknown; status?: unknown; youtubeUrl?: unknown; source?: unknown },
  ) {
    const data: Prisma.ClipUpdateInput = {};
    // Switch player: embed a YouTube upload, or fall back to the direct mp4.
    if (typeof body.youtubeUrl === 'string') {
      const yt = body.youtubeUrl.trim() ? parseYoutubeId(body.youtubeUrl) : '';
      if (yt === null) throw new BadRequestException('youtube_url_invalid');
      data.youtubeId = yt;
      data.source = yt ? 'youtube' : 'video';
    } else if (body.source === 'youtube' || body.source === 'video') {
      data.source = body.source;
    }
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 120);
    if (typeof body.titleTh === 'string') data.titleTh = body.titleTh.trim().slice(0, 120);
    if (body.level !== undefined) data.level = this.pickLevel(body.level);
    if (body.category !== undefined) data.category = this.pickCategory(body.category);
    if (body.durationSec !== undefined) data.durationSec = Math.max(0, Math.round(Number(body.durationSec) || 0));
    if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
    if (body.status === 'published' || body.status === 'draft') {
      if (body.status === 'published') {
        const lines = await this.prisma.clipSentence.findMany({ where: { clipId: id }, orderBy: { idx: 'asc' } });
        const err = validateTimedLines(lines);
        if (err) throw new BadRequestException(`cannot_publish:${err}`);
      }
      data.status = body.status;
    }
    await this.prisma.clip.update({ where: { id }, data });
    return this.adminGet(id);
  }

  async adminDelete(id: string) {
    await this.prisma.clip.delete({ where: { id } });
    return { ok: true };
  }

  /** Parse SRT/VTT/plain text into lines (no save) for the editor. */
  adminParseTranscript(body: { text?: unknown }) {
    return { lines: parseTranscript(String(body.text ?? '')) };
  }

  /** Replace all lines (times, text, Thai, dictation) from the editor. */
  async adminSaveSentences(
    id: string,
    body: { sentences?: unknown },
  ) {
    const raw = Array.isArray(body.sentences) ? body.sentences : [];
    const rows = raw
      .map((r) => r as Partial<TimedLine & { textTh: string; dictation: unknown }>)
      .map((r, idx) => ({
        idx,
        startMs: Math.max(0, Math.round(Number(r.startMs) || 0)),
        endMs: Math.max(0, Math.round(Number(r.endMs) || 0)),
        text: String(r.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
        textTh: String(r.textTh ?? '').trim().slice(0, 400),
        dictation: r.dictation ?? null,
      }))
      .filter((r) => r.text);
    if (rows.length > 400) throw new BadRequestException('too_many_sentences');
    const clip = await this.prisma.clip.findUnique({ where: { id }, select: { id: true } });
    if (!clip) throw new NotFoundException('clip_not_found');
    await this.prisma.$transaction([
      this.prisma.clipSentence.deleteMany({ where: { clipId: id } }),
      this.prisma.clipSentence.createMany({
        data: rows.map((r) => ({
          clipId: id,
          idx: r.idx,
          startMs: r.startMs,
          endMs: r.endMs,
          text: r.text,
          textTh: r.textTh,
          // Omitted = NULL: the app falls back to default dictation picks.
          ...(r.dictation
            ? { dictation: normalizeDictation(r.dictation, r.text) as Prisma.InputJsonValue }
            : {}),
        })),
      }),
    ]);
    const last = rows.at(-1);
    if (last && last.endMs > 0) {
      await this.prisma.clip.update({
        where: { id },
        data: { durationSec: Math.ceil(last.endMs / 1000) },
      });
    }
    return this.adminGet(id);
  }

  /** Gemini: Thai + dictation picks for lines missing them (or all with force). */
  async adminPrepare(id: string, body: { force?: unknown }) {
    const lines = await this.prisma.clipSentence.findMany({
      where: { clipId: id },
      orderBy: { idx: 'asc' },
    });
    const todo = lines.filter(
      (l) =>
        body.force === true ||
        !l.textTh ||
        !l.dictation ||
        l.highlights == null,
    );
    if (todo.length === 0) return this.adminGet(id);
    const prepared = await this.chat.prepareClipSentences(todo.map((l) => l.text));
    await this.prisma.$transaction(
      todo.map((l, i) => {
        const p = prepared[i];
        const words = clipWords(l.text);
        return this.prisma.clipSentence.update({
          where: { id: l.id },
          data: {
            textTh: p.th || l.textTh,
            dictation: normalizeDictation(
              { hide: p.hide.filter((n) => n < words.length), distractors: p.distractors },
              l.text,
            ) as Prisma.InputJsonValue,
            highlights: normalizeHighlights(p.highlights, l.text) as Prisma.InputJsonValue,
          },
        });
      }),
    );
    this.logger.log(`Prepared ${todo.length} clip line(s) for ${id}`);
    return this.adminGet(id);
  }

  private pickLevel(v: unknown): string {
    const s = String(v ?? '').toUpperCase();
    return (CLIP_LEVELS as readonly string[]).includes(s) ? s : 'A2';
  }

  private pickCategory(v: unknown): string {
    return normalizeClipCategory(v);
  }

  private async oEmbed(youtubeId: string): Promise<{ title: string; thumbnailUrl: string } | null> {
    try {
      const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const json = (await res.json()) as { title?: string; thumbnail_url?: string };
      return { title: json.title?.trim() ?? '', thumbnailUrl: json.thumbnail_url ?? '' };
    } catch {
      return null;
    }
  }
}
