import {
  extensionForHeroMime,
  HERO_MAX_BYTES,
  publicHeroUrl,
  type HeroImageExt,
} from '../articles/article-hero';

export const EVENT_IMAGE_MAX_BYTES = HERO_MAX_BYTES;

export function eventBannerObjectPath(eventId: string, ext: HeroImageExt): string {
  return `events/${eventId}/banner.${ext}`;
}

export function eventTierAvatarObjectPath(
  eventId: string,
  tierId: string,
  ext: HeroImageExt,
): string {
  return `events/${eventId}/tiers/${tierId}.${ext}`;
}

export function publicEventImageUrl(
  bucket: string,
  objectPath: string,
  versionMs = Date.now(),
): string {
  return publicHeroUrl(bucket, objectPath, versionMs);
}

export { extensionForHeroMime };
