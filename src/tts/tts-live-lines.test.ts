import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { liveSpeechLines, ttsLiveLineKey } from './tts-live-lines';

describe('liveSpeechLines', () => {
  it('keeps a spoken line that has no banked clip', () => {
    assert.deepEqual(liveSpeechLines({ text: 'See you tomorrow!' }), [
      'See you tomorrow!',
    ]);
  });

  it('skips a line that already has a clip, and still keeps a missing praise', () => {
    assert.deepEqual(
      liveSpeechLines({
        text: 'จบบทแล้ว',
        audioUrl: 'https://example.com/body.mp3',
        praiseText: 'Good!',
      }),
      ['Good!'],
    );
    assert.deepEqual(
      liveSpeechLines({
        text: 'จบบทแล้ว',
        audioUrl: 'https://example.com/body.mp3',
        praiseText: 'Good!',
        praiseAudioUrl: 'https://example.com/good.mp3',
      }),
      [],
    );
  });

  it('counts scene lines instead of the bubble', () => {
    assert.deepEqual(
      liveSpeechLines({
        text: 'Watch this.',
        sceneLines: [{ textEn: 'Hello!' }, { textEn: 'Hello!' }, { textEn: 'Bye.' }],
      }),
      ['Hello!', 'Bye.'],
    );
  });

  it('drops templates, names, and very long text', () => {
    assert.deepEqual(liveSpeechLines({ text: 'Hi {name}!' }), []);
    assert.deepEqual(
      liveSpeechLines({ text: 'Hi Somchai!', excludeName: 'Somchai' }),
      [],
    );
    assert.deepEqual(liveSpeechLines({ text: 'x'.repeat(801) }), []);
  });

  it('collapses whitespace into one key', () => {
    const [line] = liveSpeechLines({ text: 'See   you\ntomorrow!' });
    assert.equal(line, 'See you tomorrow!');
    assert.equal(ttsLiveLineKey(line), ttsLiveLineKey('See you tomorrow!'));
  });
});
