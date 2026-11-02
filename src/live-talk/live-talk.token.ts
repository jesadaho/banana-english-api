import { createHmac, randomUUID } from 'crypto';

export type LiveKitGrant = {
  identity: string;
  displayName: string;
  room: string;
  canPublish: boolean;
};

function b64url(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf.toString('base64url');
}

export function mintLiveKitJwt(
  grant: LiveKitGrant,
  apiKey: string,
  apiSecret: string,
  ttlSec = 60 * 60 * 6,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: apiKey,
      sub: grant.identity,
      name: grant.displayName,
      nbf: now - 10,
      exp: now + ttlSec,
      jti: randomUUID(),
      video: {
        roomJoin: true,
        room: grant.room,
        canPublish: grant.canPublish,
        canSubscribe: true,
        canPublishData: true,
      },
    }),
  );
  const sig = createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest();
  return `${header}.${payload}.${b64url(sig)}`;
}

export function liveKitConfigFromEnv(env = process.env): {
  url: string;
  apiKey: string;
  apiSecret: string;
} | null {
  const url = env.LIVEKIT_URL?.trim() ?? '';
  const apiKey = env.LIVEKIT_API_KEY?.trim() ?? '';
  const apiSecret = env.LIVEKIT_API_SECRET?.trim() ?? '';
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}
