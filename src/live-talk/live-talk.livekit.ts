import { createHmac, randomUUID } from 'crypto';
import { liveKitConfigFromEnv } from './live-talk.token';

function b64url(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf.toString('base64url');
}

function liveKitHttpOrigin(url: string): string {
  return url.replace(/^ws/i, 'http');
}

function mintLiveKitServiceJwt(apiKey: string, apiSecret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: apiKey,
      nbf: now - 10,
      exp: now + 60,
      jti: randomUUID(),
      video: { roomList: true, roomAdmin: true, roomCreate: true },
    }),
  );
  const sig = createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest();
  return `${header}.${payload}.${b64url(sig)}`;
}

async function liveKitAdminCall(
  method: string,
  body: unknown,
  env = process.env,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<unknown | null> {
  const cfg = liveKitConfigFromEnv(env);
  if (!cfg) return null;
  try {
    const token = mintLiveKitServiceJwt(cfg.apiKey, cfg.apiSecret);
    const res = await fetchFn(
      `${liveKitHttpOrigin(cfg.url)}/twirp/livekit.RoomService/${method}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Tear down a LiveKit room so remaining clients are force-disconnected. */
export async function deleteLiveKitRoom(
  roomName: string,
  env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const name = roomName.trim();
  if (!name) return false;
  const result = await liveKitAdminCall(
    'DeleteRoom',
    { room: name },
    env,
    fetchFn,
  );
  return result !== null;
}
