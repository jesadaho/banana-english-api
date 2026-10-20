import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sniffAudioKind } from './gcp-stt.service';

describe('sniffAudioKind', () => {
  it('detects wav and m4a from magic bytes', () => {
    const wav = Buffer.alloc(16);
    wav.write('RIFF', 0);
    wav.write('WAVE', 8);
    assert.equal(sniffAudioKind(wav, 'recording.m4a'), 'wav');

    const m4a = Buffer.alloc(16);
    m4a.write('ftyp', 4);
    assert.equal(sniffAudioKind(m4a, 'recording.m4a'), 'm4a');
  });

  it('does not treat m4a as mp3 from the filename fallback', () => {
    assert.equal(sniffAudioKind(Buffer.alloc(4), 'recording.m4a'), 'm4a');
  });
});
