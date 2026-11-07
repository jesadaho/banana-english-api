import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deleteLiveKitRoom } from './live-talk.livekit';

describe('deleteLiveKitRoom', () => {
  it('calls LiveKit DeleteRoom for the given name', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const ok = await deleteLiveKitRoom(
      'lt_abc',
      {
        LIVEKIT_URL: 'wss://live.example',
        LIVEKIT_API_KEY: 'key',
        LIVEKIT_API_SECRET: 'secret',
      } as NodeJS.ProcessEnv,
      (async (input, init) => {
        calls.push({
          url: String(input),
          body: String(init?.body ?? ''),
        });
        return new Response('{}', { status: 200 });
      }) as typeof fetch,
    );
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /DeleteRoom$/);
    assert.equal(JSON.parse(calls[0].body).room, 'lt_abc');
  });

  it('returns false when LiveKit is not configured', async () => {
    const ok = await deleteLiveKitRoom('lt_abc', {} as NodeJS.ProcessEnv);
    assert.equal(ok, false);
  });
});
