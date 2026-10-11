export const REFERRER_REWARD_BANANAS = 10;
export const INVITEE_BONUS_BANANAS = 5;
/** Map nodes the invitee must finish before the referrer is paid. */
export const REFERRAL_REQUIRED_NODES = 3;
export const REFERRER_MONTHLY_CAP_BANANAS = 100;
export const REFERRAL_LINK_BASE = 'https://bananaenglish.app/invite/';

export const REFERRAL_SOURCES = [
  'play_referrer',
  'clipboard',
  'link',
  'manual',
] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

/** No 0/O/1/I/L — codes get read aloud and typed by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_PREFIX = 'BANANA-';

export function generateReferralCode(random: () => number = Math.random): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return `${REFERRAL_CODE_PREFIX}${suffix}`;
}

/** Accepts `k7q2`, `BANANA-K7Q2`, `banana k7q2`, `BANANA-REF:BANANA-K7Q2`. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toUpperCase();
  if (value.startsWith('BANANA-REF:')) value = value.slice('BANANA-REF:'.length);
  value = value.replace(/[\s_]+/g, '-');
  if (value.startsWith('BANANA-')) value = value.slice('BANANA-'.length);
  else if (value.startsWith('BANANA')) value = value.slice('BANANA'.length);
  value = value.replace(/-/g, '');
  if (!/^[A-Z0-9]{4,8}$/.test(value)) return null;
  return `${REFERRAL_CODE_PREFIX}${value}`;
}

/** First instant of the current calendar month in Asia/Bangkok (UTC+7, no DST). */
export function bangkokMonthStart(now = new Date()): Date {
  const offsetMs = 7 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offsetMs,
  );
}
