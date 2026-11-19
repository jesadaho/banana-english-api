import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUDIO_CLIPS_MIN_APP_VERSION,
  appSupportsAudioClips,
} from './audio-clips-version';

describe('appSupportsAudioClips', () => {
  it('uses 1.0.325 as the floor', () => {
    assert.equal(AUDIO_CLIPS_MIN_APP_VERSION, '1.0.325');
  });

  it('rejects missing or invalid versions', () => {
    assert.equal(appSupportsAudioClips(null), false);
    assert.equal(appSupportsAudioClips(undefined), false);
    assert.equal(appSupportsAudioClips(''), false);
    assert.equal(appSupportsAudioClips('nope'), false);
  });

  it('rejects builds below the floor', () => {
    assert.equal(appSupportsAudioClips('1.0.20'), false);
    assert.equal(appSupportsAudioClips('1.0.324'), false);
    assert.equal(appSupportsAudioClips('1.0.324+99'), false);
  });

  it('accepts the floor and newer', () => {
    assert.equal(appSupportsAudioClips('1.0.325'), true);
    assert.equal(appSupportsAudioClips('1.0.325+1'), true);
    assert.equal(appSupportsAudioClips('1.0.326'), true);
    assert.equal(appSupportsAudioClips('1.1.0'), true);
  });
});
