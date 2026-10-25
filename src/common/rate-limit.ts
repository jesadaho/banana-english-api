import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Small in-memory rate limiter (one Railway instance, so memory is enough).
 * Counts per fixed window. Limits are per user (X-Anonymous-User-Id) and per IP.
 * IP limits are loose on purpose: Thai mobile carriers put many users behind one IP.
 */
export type RateLimitRule = {
  /** Bucket name, e.g. 'tts-token'. */
  name: string;
  windowMs: number;
  perUser?: number;
  perIp?: number;
};

export const RATE_LIMIT_KEY = 'banana:rate-limit';
export const RateLimit = (rule: RateLimitRule) =>
  SetMetadata(RATE_LIMIT_KEY, rule);

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Counts one hit. Returns seconds to wait when over the limit, else 0. */
export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): number {
  sweep(now);
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  }
  return 0;
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
};

/** Client IP behind Railway's proxy (first X-Forwarded-For entry). */
export function clientIp(request: RequestLike): string {
  const forwarded = request.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim();
  return first || request.ip || request.socket?.remoteAddress || 'unknown';
}

export function tooManyRequests(retryAfterSec: number): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too many requests',
      retryAfterSec,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rule) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<{
      setHeader?: (name: string, value: string) => void;
    }>();

    const checks: Array<[string, number]> = [];
    if (rule.perIp) {
      checks.push([`${rule.name}:ip:${clientIp(request)}`, rule.perIp]);
    }
    const rawUser = request.headers['x-anonymous-user-id'];
    const userId = (Array.isArray(rawUser) ? rawUser[0] : rawUser)?.trim();
    if (rule.perUser && userId) {
      checks.push([`${rule.name}:user:${userId}`, rule.perUser]);
    }

    for (const [key, limit] of checks) {
      const wait = hitRateLimit(key, limit, rule.windowMs);
      if (wait > 0) {
        response.setHeader?.('Retry-After', String(wait));
        throw tooManyRequests(wait);
      }
    }
    return true;
  }
}
