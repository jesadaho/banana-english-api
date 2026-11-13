import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { CcImportService } from './cc-import.service';
import { MAX_LINE_WORDS } from './cc-import.rules';
import { guessClipCategory } from './clips.rules';
import { ClipsService } from './clips.service';

type ClipMeta = {
  id?: string;
  youtube_id?: string;
  title?: string;
  channel?: string;
  level?: string;
  category?: string;
  subtitle_files?: string[];
  ok?: boolean;
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

async function httpJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'X-Anonymous-User-Id': 'clips-thai-mirror' },
  });
  if (!res.ok) throw new Error(`http_${res.status}_${url}`);
  return (await res.json()) as T;
}

function pickSubFile(dir: string, meta: ClipMeta): string | null {
  const named = meta.subtitle_files?.length
    ? meta.subtitle_files
    : readdirSync(dir).filter((f) => /\.(srt|vtt)$/i.test(f));
  const prefer = named.filter((n) => !/-orig\./i.test(n));
  const files = prefer.length ? prefer : named;
  const hit = files.map((f) => join(dir, f)).find((p) => existsSync(p));
  return hit ?? null;
}

/**
 * Seed / refresh clips-cc packs:
 * - import any pack whose YouTube id is not in the DB yet (incl. parroto/)
 * - empty DB → import + publish all
 * - any stored line still > MAX_LINE_WORDS / caption noise → re-import with replace
 */
@Injectable()
export class ClipsSeedService implements OnModuleInit {
  private readonly logger = new Logger(ClipsSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cc: CcImportService,
    private readonly clips: ClipsService,
  ) {}

  onModuleInit() {
    void this.maybeSeed();
  }

  private async maybeSeed() {
    const root = process.env.CLIPS_CC_DIR ?? join(process.cwd(), 'clips-cc');
    if (!existsSync(root)) {
      this.logger.log(`Clips seed skipped (no ${root})`);
      return;
    }
    if (process.env.CLIPS_CC_AUTO_IMPORT === '0') {
      this.logger.log('Clips seed skipped (CLIPS_CC_AUTO_IMPORT=0)');
      await this.backfillMissingThai();
      return;
    }

    await this.remapCategories();

    // Fill blank Thai first (mirror from Staging, then Gemini) so a long
    // missing-pack import cannot starve translations for hours.
    await this.backfillMissingThai();

    const count = await this.prisma.clip.count();
    const sentences = await this.prisma.clipSentence.findMany({
      select: { text: true, textTh: true },
    });
    const hasLongLine = sentences.some((s) => wordCount(s.text) > MAX_LINE_WORDS);
    const hasCaptionNoise = sentences.some(
      (s) =>
        /[(\[（【]/.test(s.text) ||
        /เสียงประกอบ|เสียงเพลง|เพลงประกอบ/.test(s.text) ||
        /เสียงประกอบ|เสียงเพลง|เพลงประกอบ/.test(s.textTh) ||
        /(^|[.!?]\s+)[A-Z]{2,}[A-Z0-9 .'&-]{0,24}:\s/.test(s.text),
    );

    const existing = await this.prisma.clip.findMany({
      select: { youtubeId: true },
    });
    const have = new Set(existing.map((c) => c.youtubeId).filter(Boolean));

    const allPacks = this.collect(root);
    const missing = allPacks.filter((p) => p.meta.id && !have.has(p.meta.id!));
    const refreshAll = count > 0 && (hasLongLine || hasCaptionNoise);

    if (!refreshAll && missing.length === 0) {
      this.logger.log(
        `Clips seed import skipped (${count} clip(s), ${allPacks.length} pack(s) on disk, nothing new)`,
      );
    } else {
      const packs = refreshAll ? allPacks : missing;
      const replace = refreshAll;
      this.logger.log(
        `Clips seed starting: ${packs.length} pack(s)${
          replace ? ' (replace: long lines / caption notes)' : ' (new only)'
        } from ${root}`,
      );
      let ok = 0;
      let failed = 0;
      for (const p of packs) {
        try {
          await this.cc.importCaptions({
            youtube: p.meta.id,
            title: p.meta.title,
            channel: p.meta.channel,
            level: p.meta.level,
            category: guessClipCategory(p.meta.title ?? '', p.meta.category),
            captions: readFileSync(p.srtPath, 'utf8'),
            publish: true,
            replace,
          });
          ok += 1;
          this.logger.log(`Clips seed ok ${p.meta.id}`);
        } catch (err) {
          failed += 1;
          this.logger.warn(`Clips seed fail ${p.meta.id}: ${String(err)}`);
        }
      }
      this.logger.log(`Clips seed done: ok=${ok} failed=${failed}`);
      // New imports may still lack Thai if Gemini failed — mirror/retry once more.
      await this.backfillMissingThai();
    }
  }

  /**
   * Fill blank textTh without re-paying Gemini when possible:
   * 1) mirror from Staging (same YouTube id) on production
   * 2) Gemini prepare for whatever is still blank
   */
  private async backfillMissingThai() {
    const blank = await this.prisma.clipSentence.findMany({
      where: { textTh: '' },
      select: { clipId: true },
      distinct: ['clipId'],
    });
    if (blank.length === 0) {
      this.logger.log('Clips Thai backfill skipped (none missing)');
      return;
    }
    this.logger.log(`Clips Thai backfill starting: ${blank.length} clip(s)`);

    const source = this.resolveThaiSourceUrl();
    let mirrored = 0;
    if (source) {
      try {
        mirrored = await this.mirrorThaiFromSource(
          blank.map((b) => b.clipId),
          source,
        );
        this.logger.log(`Clips Thai mirrored from ${source}: ${mirrored} clip(s)`);
      } catch (err) {
        this.logger.warn(`Clips Thai mirror failed: ${String(err)}`);
      }
    }

    const still = await this.prisma.clipSentence.findMany({
      where: { textTh: '' },
      select: { clipId: true },
      distinct: ['clipId'],
    });
    // Avoid burning the shared Gemini chat key on boot (that starves live lessons).
    // Set CLIPS_THAI_GEMINI_BACKFILL=1 to re-enable prepare-on-boot.
    const geminiBackfill =
      (process.env.CLIPS_THAI_GEMINI_BACKFILL ?? '').trim() === '1';
    if (!geminiBackfill) {
      this.logger.log(
        `Clips Thai Gemini backfill skipped (${still.length} clip(s) still blank; mirrored=${mirrored})`,
      );
      return;
    }
    let ok = mirrored;
    let failed = 0;
    for (const { clipId } of still) {
      try {
        await this.clips.adminPrepare(clipId, {});
        const left = await this.prisma.clipSentence.count({
          where: { clipId, textTh: '' },
        });
        if (left === 0) ok += 1;
        else {
          failed += 1;
          this.logger.warn(`Clips Thai backfill still blank ${clipId}: ${left} line(s)`);
        }
      } catch (err) {
        failed += 1;
        this.logger.warn(`Clips Thai backfill fail ${clipId}: ${String(err)}`);
      }
    }
    this.logger.log(`Clips Thai backfill done: ok=${ok} failed=${failed} mirrored=${mirrored}`);
  }

  /**
   * Prefer Staging's already-translated Thai (matched by YouTube id).
   * Set CLIPS_THAI_SOURCE_URL=0 to disable, or to another base URL to override.
   */
  private resolveThaiSourceUrl(): string | null {
    const raw = (process.env.CLIPS_THAI_SOURCE_URL ?? '').trim().replace(/\/$/, '');
    if (raw === '0' || (process.env.CLIPS_THAI_MIRROR_STAGING ?? '').trim() === '0') {
      return null;
    }
    if (raw && raw !== '1') return raw;
    return 'https://banana-english-api-staging.up.railway.app';
  }

  private async mirrorThaiFromSource(clipIds: string[], sourceBase: string): Promise<number> {
    const clips = await this.prisma.clip.findMany({
      where: { id: { in: clipIds }, youtubeId: { not: '' } },
      select: { id: true, youtubeId: true },
    });
    if (clips.length === 0) return 0;

    const ytToSourceId = await this.fetchSourceClipIndex(sourceBase);
    let done = 0;
    for (const clip of clips) {
      const sourceId = ytToSourceId.get(clip.youtubeId);
      if (!sourceId) continue;
      const sourceLines = await this.fetchSourceSentences(sourceBase, sourceId);
      if (sourceLines.length === 0) continue;
      const byText = new Map<string, (typeof sourceLines)[number]>();
      for (const s of sourceLines) {
        const key = normLine(s.text);
        if (key && !byText.has(key)) byText.set(key, s);
      }
      const local = await this.prisma.clipSentence.findMany({
        where: { clipId: clip.id },
        orderBy: { idx: 'asc' },
      });
      let filled = 0;
      for (const line of local) {
        if (line.textTh) continue;
        const hit =
          byText.get(normLine(line.text)) ??
          sourceLines.find((s) => s.idx === line.idx && !!s.textTh);
        if (!hit?.textTh) continue;
        await this.prisma.clipSentence.update({
          where: { id: line.id },
          data: {
            textTh: hit.textTh.slice(0, 400),
            ...(hit.dictation != null
              ? { dictation: hit.dictation as Prisma.InputJsonValue }
              : {}),
            ...(hit.highlights != null
              ? { highlights: hit.highlights as Prisma.InputJsonValue }
              : {}),
          },
        });
        filled += 1;
      }
      if (filled > 0) {
        done += 1;
        this.logger.log(
          `Clips Thai mirror ${clip.youtubeId}: filled ${filled}/${local.length} line(s)`,
        );
      }
    }
    return done;
  }

  private async fetchSourceClipIndex(sourceBase: string): Promise<Map<string, string>> {
    const data = await httpJson<{
      sections?: Array<{ clips?: Array<{ id: string; youtubeId?: string }> }>;
      popular?: Array<{ id: string; youtubeId?: string }>;
      recommended?: Array<{ id: string; youtubeId?: string }>;
    }>(`${sourceBase}/clips`);
    const map = new Map<string, string>();
    const add = (c?: { id: string; youtubeId?: string }) => {
      const yt = (c?.youtubeId ?? '').trim();
      if (c?.id && yt && !map.has(yt)) map.set(yt, c.id);
    };
    for (const s of data.sections ?? []) for (const c of s.clips ?? []) add(c);
    for (const c of data.popular ?? []) add(c);
    for (const c of data.recommended ?? []) add(c);
    return map;
  }

  private async fetchSourceSentences(sourceBase: string, clipId: string) {
    const data = await httpJson<{
      sentences?: Array<{
        idx?: number;
        text?: string;
        textTh?: string;
        dictation?: unknown;
        highlights?: unknown;
      }>;
    }>(`${sourceBase}/clips/${clipId}`);
    return (data.sentences ?? [])
      .map((s, i) => ({
        idx: Number.isInteger(s.idx) ? (s.idx as number) : i,
        text: String(s.text ?? '').trim(),
        textTh: String(s.textTh ?? '').trim(),
        dictation: s.dictation ?? null,
        highlights: s.highlights ?? null,
      }))
      .filter((s) => s.text);
  }

  /** Align stored category ids/titles with the current Clips tab rails. */
  private async remapCategories() {
    const clips = await this.prisma.clip.findMany({
      select: { id: true, title: true, category: true, credit: true },
    });
    let changed = 0;
    for (const c of clips) {
      const next = guessClipCategory(c.title, c.credit);
      if (next === c.category) continue;
      await this.prisma.clip.update({ where: { id: c.id }, data: { category: next } });
      changed += 1;
    }
    if (changed) this.logger.log(`Clips categories remapped: ${changed}`);
  }

  private collect(root: string) {
    const out: Array<{ meta: ClipMeta; srtPath: string }> = [];
    for (const level of ['A1', 'A2', 'B1', 'B2']) {
      const levelDir = join(root, level);
      if (!existsSync(levelDir)) continue;
      for (const slug of readdirSync(levelDir)) {
        const dir = join(levelDir, slug);
        if (!statSync(dir).isDirectory()) continue;
        const pack = this.readPack(dir, level);
        if (pack) out.push(pack);
      }
    }
    const parroto = join(root, 'parroto');
    if (existsSync(parroto)) {
      this.walkParroto(parroto, out);
    }
    return out;
  }

  private walkParroto(dir: string, out: Array<{ meta: ClipMeta; srtPath: string }>) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (!statSync(path).isDirectory()) continue;
      if (existsSync(join(path, 'clip.json'))) {
        const pack = this.readPack(path);
        if (pack) out.push(pack);
      } else {
        this.walkParroto(path, out);
      }
    }
  }

  private readPack(dir: string, fallbackLevel?: string) {
    const metaPath = join(dir, 'clip.json');
    if (!existsSync(metaPath)) return null;
    const raw = JSON.parse(readFileSync(metaPath, 'utf8')) as ClipMeta;
    const id = (raw.id || raw.youtube_id || '').trim();
    if (raw.ok === false || !id) return null;
    const srtPath = pickSubFile(dir, raw);
    if (!srtPath) return null;
    const level = (raw.level || fallbackLevel || 'A2').toUpperCase();
    return {
      meta: { ...raw, id, level },
      srtPath,
    };
  }
}
