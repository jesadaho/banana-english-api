/** App build that sent the request (X-App-Platform / X-App-Version). */
export type ClientInfo = { platform?: string; version?: string };

const PLATFORMS = new Set(['ios', 'android', 'web', 'other']);

function header(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function clientInfoFrom(
  headers: Record<string, string | string[] | undefined>,
): ClientInfo {
  const platform = header(headers['x-app-platform'])?.toLowerCase();
  const version = header(headers['x-app-version']);
  return {
    platform: platform && PLATFORMS.has(platform) ? platform : undefined,
    // e.g. "1.0.21+45"; anything else is ignored.
    version: version && /^[0-9][0-9A-Za-z.+-]{0,39}$/.test(version) ? version : undefined,
  };
}
