import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deleteLiveKitRoom,
  dispatchCaptionsAgent,
  isLiveKitAudioTrack,
  liveKitCaptionsAgentName,
} from './live-talk.livekit';

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

describe('isLiveKitAudioTrack', () => {
  it('matches protojson AUDIO names and numeric enums', () => {
    assert.equal(isLiveKitAudioTrack({ type: 'AUDIO' }), true);
    assert.equal(isLiveKitAudioTrack({ type: 0 }), true);
    assert.equal(isLiveKitAudioTrack({ source: 'MICROPHONE' }), true);
    assert.equal(isLiveKitAudioTrack({ source: 2 }), true);
  });

  it('ignores video tracks', () => {
    assert.equal(isLiveKitAudioTrack({ type: 'VIDEO' }), false);
    assert.equal(isLiveKitAudioTrack({ type: 1, source: 'CAMERA' }), false);
  });
});

describe('captions agent dispatch', () => {
  const env = {
    LIVEKIT_URL: 'wss://demo.livekit.cloud',
    LIVEKIT_API_KEY: 'key',
    LIVEKIT_API_SECRET: 'secret',
  } as NodeJS.ProcessEnv;

  it('defaults to banana-captions and can be turned off', () => {
    assert.equal(liveKitCaptionsAgentName({}), 'banana-captions');
    assert.equal(liveKitCaptionsAgentName({ LIVE_TALK_CAPTIONS_AGENT: 'off' }), null);
    assert.equal(liveKitCaptionsAgentName({ LIVE_TALK_CAPTIONS_AGENT: ' x ' }), 'x');
  });

  it('posts CreateDispatch with the host id in metadata', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const ok = await dispatchCaptionsAgent('lt_room', 'host-1', env, fetchFn);
    assert.equal(ok, true);
    assert.equal(
      calls[0].url,
      'https://demo.livekit.cloud/twirp/livekit.AgentDispatchService/CreateDispatch',
    );
    assert.equal(calls[0].body.agent_name, 'banana-captions');
    assert.equal(calls[0].body.room, 'lt_room');
    assert.deepEqual(JSON.parse(String(calls[0].body.metadata)), { hostId: 'host-1' });
  });

  it('skips the call when disabled', async () => {
    let called = false;
    const fetchFn = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    const ok = await dispatchCaptionsAgent(
      'lt_room',
      'host-1',
      { ...env, LIVE_TALK_CAPTIONS_AGENT: 'off' },
      fetchFn,
    );
    assert.equal(ok, false);
    assert.equal(called, false);
  });
});
