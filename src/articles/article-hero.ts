export const HERO_MAX_BYTES = 5 * 1024 * 1024;

const HERO_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type HeroImageExt = (typeof HERO_MIME_TO_EXT)[keyof typeof HERO_MIME_TO_EXT];

export function extensionForHeroMime(mime: string | undefined | null): HeroImageExt | null {
  const key = (mime ?? '').trim().toLowerCase();
  return HERO_MIME_TO_EXT[key as keyof typeof HERO_MIME_TO_EXT] ?? null;
}

export function articleHeroObjectPath(articleId: string, ext: HeroImageExt): string {
  return `articles/${articleId}/hero.${ext}`;
}

export function publicHeroUrl(bucket: string, objectPath: string, versionMs: number): string {
  const encoded = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media&v=${versionMs}`;
}
