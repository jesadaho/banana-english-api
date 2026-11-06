import sharp from 'sharp';
import type { HeroImageExt } from '../articles/article-hero';

export type OptimizedEventImage = {
  buffer: Buffer;
  mimetype: 'image/webp';
  ext: Extract<HeroImageExt, 'webp'>;
};

const BANNER_MAX_WIDTH = 1200;
const AVATAR_MAX_EDGE = 512;
const WEBP_QUALITY = 82;

/** Resize + encode event banners / reward avatars as WebP for faster loads. */
export async function optimizeEventImage(
  input: Buffer,
  kind: 'banner' | 'avatar',
): Promise<OptimizedEventImage> {
  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  if (kind === 'banner') {
    pipeline = pipeline.resize({
      width: BANNER_MAX_WIDTH,
      withoutEnlargement: true,
      fit: 'inside',
    });
  } else {
    pipeline = pipeline.resize({
      width: AVATAR_MAX_EDGE,
      height: AVATAR_MAX_EDGE,
      withoutEnlargement: true,
      fit: 'inside',
    });
  }
  const buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  return { buffer, mimetype: 'image/webp', ext: 'webp' };
}
