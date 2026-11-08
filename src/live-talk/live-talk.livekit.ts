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

type LiveKitTrack = {
  sid?: string;
  type?: string | number;
  source?: string | number;
};

type LiveKitParticipant = {
  identity?: string;
  tracks?: LiveKitTrack[];
};

export function isLiveKitAudioTrack(track: LiveKitTrack): boolean {
  const type = track.type;
  if (type === 'AUDIO' || type === 0 || type === '0') return true;
  const source = track.source;
  return (
    source === 'MICROPHONE' ||
    source === 2 ||
    source === '2' ||
    source === 'SCREEN_SHARE_AUDIO' ||
    source === 4 ||
    source === '4'
  );
}

async function liveKitAdminCall(
  method: string,
  body: unknown,
  env = process.env,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 2500,
  service = 'livekit.RoomService',
): Promise<unknown | null> {
  const cfg = liveKitConfigFromEnv(env);
  if (!cfg) return null;
  try {
    const token = mintLiveKitServiceJwt(cfg.apiKey, cfg.apiSecret);
    const res = await fetchFn(
      `${liveKitHttpOrigin(cfg.url)}/twirp/${service}/${method}`,
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

/** LiveKit occupancy by room name. `null` = skip (no config or request failed). */
export async function fetchLiveKitOccupancy(
  env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, number> | null> {
  const cfg = liveKitConfigFromEnv(env);
  if (!cfg) return null;
  const body = (await liveKitAdminCall(
    'ListRooms',
    {},
    env,
    fetchFn,
  )) as {
    rooms?: Array<{
      name?: string;
      num_participants?: number;
      numParticipants?: number;
    }>;
  } | null;
  if (!body) return null;
  const map = new Map<string, number>();
  for (const room of body.rooms ?? []) {
    const name = room.name?.trim();
    if (!name) continue;
    map.set(name, room.numParticipants ?? room.num_participants ?? 0);
  }
  return map;
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

export async function removeLiveKitParticipant(
  roomName: string,
  identity: string,
  env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const result = await liveKitAdminCall(
    'RemoveParticipant',
    { room: roomName, identity },
    env,
    fetchFn,
  );
  return result !== null;
}

export async function setLiveKitParticipantMuted(
  roomName: string,
  identity: string,
  muted: boolean,
  env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const listed = (await liveKitAdminCall(
    'ListParticipants',
    { room: roomName },
    env,
    fetchFn,
  )) as { participants?: LiveKitParticipant[] } | null;
  const person = listed?.participants?.find((p) => p.identity === identity);
  for (const track of person?.tracks ?? []) {
    if (!track.sid || !isLiveKitAudioTrack(track)) continue;
    await liveKitAdminCall(
      'MutePublishedTrack',
      {
        room: roomName,
        identity,
        track_sid: track.sid,
        muted,
      },
      env,
      fetchFn,
    );
  }
  const updated = await liveKitAdminCall(
    'UpdateParticipant',
    {
      room: roomName,
      identity,
      permission: {
        can_subscribe: true,
        can_publish: !muted,
        can_publish_data: true,
      },
    },
    env,
    fetchFn,
  );
  return updated !== null;
}

/**
 * Let [identity] publish on their current connection (co-host promotion),
 * without touching their tracks, so a self-muted mic stays muted.
 */
export async function grantLiveKitPublish(
  roomName: string,
  identity: string,
  env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const updated = await liveKitAdminCall(
    'UpdateParticipant',
    {
      room: roomName,
      identity,
      permission: {
        can_subscribe: true,
        can_publish: true,
        can_publish_data: true,
      },
    },
    env,
    fetchFn,
  );
  return updated !== null;
}

/** Agent name for Live Talk captions; `off` / empty disables dispatch. */
export function liveKitCaptionsAgentName(env = process.env): string | null {
  const raw = (env.LIVE_TALK_CAPTIONS_AGENT ?? 'banana-captions').trim();
  if (!raw || raw.toLowerCase() === 'off') return null;
  return raw;
}

/**
 * Ask LiveKit Cloud to send the captions agent into this room (host-only STT).
 * Best effort: `false` when disabled, unconfigured or the call failed.
 */
export async function dispatchCaptionsAgent(
  roomName: string,
  hostId: string,
  env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const agentName = liveKitCaptionsAgentName(env);
  if (!agentName) return false;
  const result = await liveKitAdminCall(
    'CreateDispatch',
    {
      agent_name: agentName,
      room: roomName,
      metadata: JSON.stringify({ hostId }),
    },
    env,
    fetchFn,
    4000,
    'livekit.AgentDispatchService',
  );
  return result !== null;
}
