import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * Old routes stay open for app builds that predate /api/v2.
 * Plan: set force_update minVersion and delete these routes after this date.
 */
export const LEGACY_API_SUNSET = '2026-11-15';

const SUNSET_HTTP_DATE = new Date(`${LEGACY_API_SUNSET}T00:00:00Z`).toUTCString();
const LOG_EVERY_MS = 10 * 60_000;

/** Marks legacy responses and logs how often they are still called. */
@Injectable()
export class LegacyApiInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LegacyApi');
  private readonly counts = new Map<string, number>();
  private lastLogAt = Date.now();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method?: string; route?: { path?: string } }>();
    const response = http.getResponse<{
      setHeader?: (name: string, value: string) => void;
    }>();
    response.setHeader?.('Deprecation', 'true');
    response.setHeader?.('Sunset', SUNSET_HTTP_DATE);

    const route = `${request.method ?? '?'} ${request.route?.path ?? '?'}`;
    this.counts.set(route, (this.counts.get(route) ?? 0) + 1);
    const now = Date.now();
    if (now - this.lastLogAt >= LOG_EVERY_MS) {
      const summary = [...this.counts.entries()]
        .map(([r, n]) => `${r}=${n}`)
        .join(', ');
      this.logger.log(`legacy calls in last ${Math.round((now - this.lastLogAt) / 60_000)} min: ${summary}`);
      this.counts.clear();
      this.lastLogAt = now;
    }
    return next.handle();
  }
}
