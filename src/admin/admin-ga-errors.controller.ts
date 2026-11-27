import { createSign, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Logger,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAuthGuard } from './admin-auth.guard';
import { parseDateRange } from './admin-metrics.util';

/** Error events the app logs to GA (lib/core/analytics/analytics_events.dart). */
export const GA_ERROR_EVENTS = ['app_error', 'api_error', 'stt_error', 'error_shown'] as const;

/**
 * Event params we group by. GA only reports a param once it is registered
 * as an event-scoped custom dimension (Admin → Custom definitions); the
 * response lists the missing ones so the page can say what to register.
 */
const PARAMS = ['message', 'source', 'error_type', 'error_where', 'path', 'status_code'] as const;
type Param = (typeof PARAMS)[number];

type Row = { dims: string[]; events: number; users: number };
type ReportRequest = {
  dimensions: string[];
  metrics?: string[];
  eventNames?: readonly string[];
  limit?: number;
};

/**
 * GA4 Data API reader for the admin Errors page. Service account: env
 * `GA_SERVICE_ACCOUNT_JSON`, else the Firebase Admin one
 * (FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY). That account must be a
 * Viewer on the GA property (`GA4_PROPERTY_ID`, default banana-english-ecf11).
 */
@Injectable()
export class GaErrorsService {
  private readonly logger = new Logger(GaErrorsService.name);
  private token: { value: string; expiresAt: number } | null = null;
  private dims: { at: number; names: Set<string> } | null = null;
  private readonly cache = new Map<string, { at: number; value: unknown }>();
  private static readonly CACHE_MS = 10 * 60_000;

  constructor(private readonly config: ConfigService) {}

  get propertyId(): string {
    return this.config.get<string>('GA4_PROPERTY_ID')?.trim() || '545009325';
  }

  private creds(): { client_email: string; private_key: string } | null {
    const raw = this.config.get<string>('GA_SERVICE_ACCOUNT_JSON')?.trim();
    if (raw) {
      try {
        const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
        if (j.client_email && j.private_key) {
          return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, '\n') };
        }
      } catch {
        this.logger.warn('Invalid GA_SERVICE_ACCOUNT_JSON');
      }
    }
    const email = this.config.get<string>('FIREBASE_CLIENT_EMAIL')?.trim();
    const key = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n').trim();
    return email && key ? { client_email: email, private_key: key } : null;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const creds = this.creds();
    if (!creds) throw new ServiceUnavailableException('ga_not_configured');
    const now = Math.floor(Date.now() / 1000);
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
      iss: creds.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      jti: randomUUID(),
    })}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const jwt = `${unsigned}.${signer.sign(creds.private_key).toString('base64url')}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!res.ok || !data.access_token) {
      throw new ServiceUnavailableException(`ga_token_failed_${res.status}`);
    }
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return data.access_token;
  }

  private async call<T>(path: string, body?: unknown): Promise<T> {
    const token = await this.accessToken();
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${this.propertyId}${path}`,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
    if (!res.ok) {
      const msg = data.error?.status ?? String(res.status);
      // 403 = the service account is not a Viewer on the property.
      throw new ServiceUnavailableException(res.status === 403 ? 'ga_no_access' : `ga_error_${msg}`);
    }
    return data;
  }

  /** Registered event-scoped custom dimensions (`customEvent:<param>`). */
  private async customDims(): Promise<Set<string>> {
    if (this.dims && Date.now() - this.dims.at < 60 * 60_000) return this.dims.names;
    const meta = await this.call<{ dimensions?: { apiName: string }[] }>('/metadata');
    const names = new Set(
      (meta.dimensions ?? [])
        .map((d) => d.apiName)
        .filter((n) => n.startsWith('customEvent:'))
        .map((n) => n.slice('customEvent:'.length)),
    );
    this.dims = { at: Date.now(), names };
    return names;
  }

  private async report(range: { start: string; end: string }, req: ReportRequest): Promise<Row[]> {
    const metrics = req.metrics ?? ['eventCount', 'totalUsers'];
    const body = {
      dateRanges: [{ startDate: range.start, endDate: range.end }],
      dimensions: req.dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      ...(req.eventNames
        ? {
            dimensionFilter: {
              filter: { fieldName: 'eventName', inListFilter: { values: [...req.eventNames] } },
            },
          }
        : {}),
      orderBys: [{ metric: { metricName: metrics[0] }, desc: true }],
      limit: req.limit ?? 50,
    };
    const res = await this.call<{
      rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
    }>(':runReport', body);
    return (res.rows ?? []).map((r) => ({
      dims: (r.dimensionValues ?? []).map((d) => d.value ?? ''),
      events: Number(r.metricValues?.[0]?.value ?? 0),
      users: Number(r.metricValues?.[1]?.value ?? 0),
    }));
  }

  async errors(from: Date, to: Date) {
    const range = { start: ymd(from), end: ymd(to) };
    const key = `${range.start}_${range.end}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < GaErrorsService.CACHE_MS) return hit.value;

    const custom = await this.customDims();
    const has = (p: Param) => custom.has(p);
    const dim = (p: Param) => `customEvent:${p}`;
    const missing = PARAMS.filter((p) => !has(p));

    const [active, totals, daily, byVersion] = await Promise.all([
      this.report(range, { dimensions: [], metrics: ['activeUsers'] }),
      this.report(range, { dimensions: ['eventName'], eventNames: GA_ERROR_EVENTS }),
      this.report(range, {
        dimensions: ['date', 'eventName'],
        eventNames: GA_ERROR_EVENTS,
        limit: 500,
      }),
      this.report(range, {
        dimensions: ['appVersion', 'platform'],
        eventNames: ['app_error'],
        limit: 30,
      }),
    ]);

    // Top messages per event (only with the dims GA knows).
    const groups: Record<string, Param[]> = {
      app_error: (['message', 'source', 'error_where'] as Param[]).filter(has),
      api_error: (['path', 'status_code', 'message'] as Param[]).filter(has),
      stt_error: (['error_type', 'source', 'status_code'] as Param[]).filter(has),
      error_shown: (['source', 'message'] as Param[]).filter(has),
    };
    const top = await Promise.all(
      GA_ERROR_EVENTS.map(async (event) => {
        const params = groups[event];
        if (params.length === 0) return { event, params, rows: [] as Row[] };
        const rows = await this.report(range, {
          dimensions: params.map(dim),
          eventNames: [event],
          limit: 25,
        });
        return { event, params, rows };
      }),
    );

    const activeUsers = active[0]?.events ?? 0;
    const value = {
      from: range.start,
      to: range.end,
      propertyId: this.propertyId,
      activeUsers,
      totals: GA_ERROR_EVENTS.map((event) => {
        const row = totals.find((r) => r.dims[0] === event);
        const users = row?.users ?? 0;
        return {
          event,
          events: row?.events ?? 0,
          users,
          usersPct: activeUsers ? Math.round((users / activeUsers) * 1000) / 10 : null,
        };
      }),
      daily: daily
        .map((r) => ({ day: `${r.dims[0].slice(0, 4)}-${r.dims[0].slice(4, 6)}-${r.dims[0].slice(6, 8)}`, event: r.dims[1], events: r.events }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      byVersion: byVersion.map((r) => ({ appVersion: r.dims[0], platform: r.dims[1], events: r.events, users: r.users })),
      top: top.map((t) => ({
        event: t.event,
        params: t.params,
        rows: t.rows.map((r) => ({ values: r.dims, events: r.events, users: r.users })),
      })),
      missingDimensions: missing,
    };
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /**
   * Onboarding funnel from GA: users per onboarding step (`step` param) and
   * per platform, plus `first_open` as the top. Users = GA totalUsers who
   * logged that step in the range.
   */
  async onboardingFunnel(from: Date, to: Date) {
    const range = { start: ymd(from), end: ymd(to) };
    const key = `onboarding_${range.start}_${range.end}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < GaErrorsService.CACHE_MS) return hit.value;

    const custom = await this.customDims();
    const hasStep = custom.has('step');
    const [opens, steps, byPlatform] = await Promise.all([
      this.report(range, { dimensions: ['platform'], eventNames: ['first_open'], limit: 10 }),
      hasStep
        ? this.report(range, {
            dimensions: ['customEvent:step'],
            eventNames: [ONBOARDING_STEP_EVENT],
            limit: 100,
          })
        : Promise.resolve([] as Row[]),
      hasStep
        ? this.report(range, {
            dimensions: ['customEvent:step', 'platform'],
            eventNames: [ONBOARDING_STEP_EVENT],
            limit: 400,
          })
        : Promise.resolve([] as Row[]),
    ]);
    const value = {
      from: range.start,
      to: range.end,
      event: ONBOARDING_STEP_EVENT,
      missingDimensions: hasStep ? [] : ['step'],
      firstOpen: {
        users: opens.reduce((n, r) => n + r.users, 0),
        byPlatform: Object.fromEntries(opens.map((r) => [r.dims[0].toLowerCase(), r.users])),
      },
      steps: steps.map((r) => ({ step: r.dims[0], events: r.events, users: r.users })),
      byPlatform: byPlatform.map((r) => ({
        step: r.dims[0],
        platform: r.dims[1].toLowerCase(),
        users: r.users,
      })),
    };
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }
}

/** GA event the onboarding v2/v3 screens log (param `step`). */
export const ONBOARDING_STEP_EVENT = 'onboarding_v2_step_viewed';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Admin → Errors (and the Overview card): GA error events. */
@Controller('admin/metrics')
@UseGuards(AdminAuthGuard)
export class AdminGaErrorsController {
  constructor(private readonly ga: GaErrorsService) {}

  @Get('errors')
  async errors(@Query('from') from?: string, @Query('to') to?: string) {
    let range: { from: Date; to: Date };
    try {
      range = parseDateRange(from, to);
    } catch {
      throw new BadRequestException('invalid_range');
    }
    return this.ga.errors(range.from, range.to);
  }

  /** Admin → Onboarding: GA step funnel (see GaErrorsService.onboardingFunnel). */
  @Get('onboarding-funnel')
  async onboardingFunnel(@Query('from') from?: string, @Query('to') to?: string) {
    let range: { from: Date; to: Date };
    try {
      range = parseDateRange(from, to);
    } catch {
      throw new BadRequestException('invalid_range');
    }
    return this.ga.onboardingFunnel(range.from, range.to);
  }
}
