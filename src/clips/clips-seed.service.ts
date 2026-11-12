import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { CcImportService } from './cc-import.service';
import { MAX_LINE_WORDS } from './cc-import.rules';

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

function guessCategory(title: string, categoryHint?: string): string {
  const hint = (categoryHint ?? '').toLowerCase();
  if (hint.includes('movie') || hint.includes('entertainment')) return 'movies';
  if (hint.includes('kid') || hint.includes('song')) return 'songs';
  if (hint.includes('voa') || hint.includes('news') || hint.includes('bbc')) return 'news';
  if (hint.includes('stor')) return 'stories';
  if (
    /trailer|nine-nine|stranger things|toy story|mickey|disney|pixar|ghibli|netflix|short film/i.test(
      title,
    )
  ) {
    return 'movies';
  }
  if (/song|music|sing/i.test(title)) return 'songs';
  if (/court|news|testimony|report/i.test(title)) return 'news';
  if (/story|penguin|fox/i.test(title)) return 'stories';
  return 'daily';
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
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
      return;
    }

    const count = await this.prisma.clip.count();
    const sentences = await this.prisma.clipSentence.findMany({
      select: { text: true },
    });
    const hasLongLine = sentences.some((s) => wordCount(s.text) > MAX_LINE_WORDS);
    const hasCaptionNoise = sentences.some(
      (s) =>
        /[(\[]/.test(s.text) ||
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
        `Clips seed skipped (${count} clip(s), ${allPacks.length} pack(s) on disk, nothing new)`,
      );
      return;
    }

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
          category: guessCategory(p.meta.title ?? '', p.meta.category),
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
