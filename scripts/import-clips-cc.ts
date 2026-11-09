/**
 * Import clips-cc caption packs into the Clips tab (publish by default).
 *
 *   DATABASE_URL=... GEMINI_API_KEY=... npx tsx scripts/import-clips-cc.ts
 *   npx tsx scripts/import-clips-cc.ts --dry-run
 *   npx tsx scripts/import-clips-cc.ts --replace
 *   npx tsx scripts/import-clips-cc.ts --only=v95eemWZ-4s
 *   CLIPS_CC_DIR=/path/to/clips-cc npx tsx scripts/import-clips-cc.ts
 *
 * Reads clip.json + *.srt under clips-cc/{A1,A2,B1,B2}/<slug>/.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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

function collectPacks(root: string): Array<{
  dir: string;
  meta: ClipMeta;
  srtPath: string;
}> {
  const out: Array<{ dir: string; meta: ClipMeta; srtPath: string }> = [];
  for (const level of ['A1', 'A2', 'B1', 'B2']) {
    const levelDir = join(root, level);
    if (!existsSync(levelDir)) continue;
    for (const slug of readdirSync(levelDir)) {
      const dir = join(levelDir, slug);
      const metaPath = join(dir, 'clip.json');
      if (!existsSync(metaPath)) continue;
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as ClipMeta;
      if (meta.ok === false) continue;
      const files = meta.subtitle_files?.length
        ? meta.subtitle_files
        : readdirSync(dir).filter((f) => /\.(srt|vtt)$/i.test(f));
      const srt = files.map((f) => join(dir, f)).find((p) => existsSync(p));
      if (!srt) {
        console.warn(`skip ${slug}: no subtitle file`);
        continue;
      }
      out.push({ dir, meta: { ...meta, level: meta.level ?? level }, srtPath: srt });
    }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const replace = args.includes('--replace');
  const draft = args.includes('--draft');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length) : null;
  const root = process.env.CLIPS_CC_DIR ?? join(process.cwd(), 'clips-cc');

  if (!existsSync(root)) {
    console.error(`clips-cc not found at ${root}`);
    process.exit(1);
  }

  let packs = collectPacks(root);
  if (only) packs = packs.filter((p) => p.meta.id === only);
  console.log(`Found ${packs.length} clip pack(s) under ${root}`);

  if (dryRun) {
    for (const p of packs) {
      console.log(
        JSON.stringify({
          id: p.meta.id,
          title: p.meta.title,
          level: p.meta.level,
          category: guessCategory(p.meta.title ?? ''),
          srt: p.srtPath,
        }),
      );
    }
    return;
  }

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { CcImportService } = await import('../src/clips/cc-import.service');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const cc = app.get(CcImportService);
    const results: Array<Record<string, unknown>> = [];
    for (const p of packs) {
      const youtube = p.meta.id;
      if (!youtube) {
        results.push({ skipped: true, reason: 'no_id', dir: p.dir });
        continue;
      }
      const captions = readFileSync(p.srtPath, 'utf8');
      const title = p.meta.title ?? youtube;
      try {
        const res = (await cc.importCaptions({
          youtube,
          title,
          channel: p.meta.channel,
          level: p.meta.level,
          category: guessCategory(title),
          captions,
          publish: !draft,
          replace,
        })) as {
          skipped?: boolean;
          clip?: { id?: string; status?: string };
          sentences?: unknown[];
        };
        const row = {
          id: youtube,
          skipped: Boolean(res.skipped),
          status: res.clip?.status,
          sentenceCount: res.sentences?.length ?? 0,
          clipId: res.clip?.id,
        };
        results.push(row);
        console.log(JSON.stringify(row));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: youtube, error: msg });
        console.error(JSON.stringify({ id: youtube, error: msg }));
      }
    }
    const ok = results.filter((r) => !r.error && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => r.error).length;
    console.log(
      JSON.stringify({ summary: { ok, skipped, failed, total: results.length } }),
    );
    if (failed > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
