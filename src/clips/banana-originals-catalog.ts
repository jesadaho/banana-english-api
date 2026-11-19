import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type BananaOriginalsChapter = {
  id: string;
  label: string;
  fromIdx: number;
  toIdx: number;
};

export type BananaOriginalsSentence = {
  idx: number;
  startMs: number;
  endMs: number;
  text: string;
  textTh?: string;
  section?: string;
};

export type BananaOriginalsEpisode = {
  id: string;
  episode: number;
  title: string;
  titleTh?: string;
  level: string;
  category: string;
  credit: string;
  source: string;
  sourceUrl: string;
  audioUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  sortOrder: number;
  chapters: BananaOriginalsChapter[];
  sentences: BananaOriginalsSentence[];
};

export type BananaOriginalsCatalog = {
  series: string;
  season: number;
  episodes: BananaOriginalsEpisode[];
};

let cached: BananaOriginalsCatalog | null | undefined;

/** Load Season 1 catalog from clips-cc (cached). Missing file → null. */
export function loadBananaOriginalsCatalog(
  root = process.env.CLIPS_CC_DIR ?? join(process.cwd(), 'clips-cc'),
): BananaOriginalsCatalog | null {
  if (cached !== undefined) return cached;
  const path = join(root, 'banana-originals', 'toeic-listening', 'catalog.json');
  if (!existsSync(path)) {
    cached = null;
    return null;
  }
  try {
    cached = JSON.parse(readFileSync(path, 'utf8')) as BananaOriginalsCatalog;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function bananaOriginalsChaptersFor(
  clipId: string,
): BananaOriginalsChapter[] {
  const cat = loadBananaOriginalsCatalog();
  const ep = cat?.episodes.find((e) => e.id === clipId);
  return ep?.chapters ?? [];
}
