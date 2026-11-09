import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { CcImportService } from './cc-import.service';
import { MAX_LINE_WORDS } from './cc-import.rules';

type ClipMeta = {
  id?: string;
  title?: string;
  channel?: string;
  level?: string;
  subtitle_files?: string[];
  ok?: boolean;
};

function guessCategory(title: string): string {
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

/**
 * Seed / refresh clips-cc packs:
 * - empty DB → import + publish
 * - any stored line still > MAX_LINE_WORDS → re-import with replace
 *   (picks up splitter fixes without a manual admin pass)
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
    // Prisma has no word-count filter — texts are tiny at this scale.
    const sentences = await this.prisma.clipSentence.findMany({
      select: { text: true },
    });
    const hasLongLine = sentences.some((s) => wordCount(s.text) > MAX_LINE_WORDS);

    if (count > 0 && !hasLongLine) {
      this.logger.log(`Clips seed skipped (${count} clip(s), lines ≤ ${MAX_LINE_WORDS} words)`);
      return;
    }

    const replace = count > 0;
    const packs = this.collect(root);
    this.logger.log(
      `Clips seed starting: ${packs.length} pack(s)${replace ? ' (replace long lines)' : ''} from ${root}`,
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
          category: guessCategory(p.meta.title ?? ''),
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
        const metaPath = join(dir, 'clip.json');
        if (!existsSync(metaPath)) continue;
        const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as ClipMeta;
        if (meta.ok === false || !meta.id) continue;
        const files = meta.subtitle_files?.length
          ? meta.subtitle_files
          : readdirSync(dir).filter((f) => /\.(srt|vtt)$/i.test(f));
        const srt = files.map((f) => join(dir, f)).find((p) => existsSync(p));
        if (!srt) continue;
        out.push({ meta: { ...meta, level: meta.level ?? level }, srtPath: srt });
      }
    }
    return out;
  }
}
