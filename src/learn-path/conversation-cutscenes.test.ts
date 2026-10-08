import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADVENTURE_A2_COURSE } from './foundation-v7-path.data';
import { toFoundationV7ClientChapters } from './foundation-v7-path.view';
import {
  CONVERSATION_CUTSCENES,
  conversationCutsceneUrl,
} from './conversation-cutscenes';

describe('conversation cutscene URLs', () => {
  it('joins a Bunny pull zone with the uploaded file', () => {
    assert.equal(
      conversationCutsceneUrl(
        'a2_c01n09',
        { a2_c01n09: 'conversation-cutscenes/a2_c01n09.mp4' },
        'https://banana.b-cdn.net/',
      ),
      'https://banana.b-cdn.net/conversation-cutscenes/a2_c01n09.mp4',
    );
  });

  it('keeps an absolute Bunny URL without a pull zone', () => {
    assert.equal(
      conversationCutsceneUrl(
        'a2_c01n09',
        { a2_c01n09: 'https://vz-example.b-cdn.net/video/play_720p.mp4' },
        '',
      ),
      'https://vz-example.b-cdn.net/video/play_720p.mp4',
    );
  });

  it('omits the URL until a clip is published', () => {
    assert.equal(
      conversationCutsceneUrl('a2_c01n09', {}, 'https://banana.b-cdn.net'),
      undefined,
    );
  });

  it('sends the Bunny URL on the Adventure conversation node', () => {
    const previous = process.env.BUNNY_CUTSCENE_BASE_URL;
    process.env.BUNNY_CUTSCENE_BASE_URL = 'https://banana.b-cdn.net';
    CONVERSATION_CUTSCENES.a2_c01n09 = 'conversation-cutscenes/a2_c01n09.mp4';
    try {
      const chapter = toFoundationV7ClientChapters([], ADVENTURE_A2_COURSE).find(
        (item) => item.number === 1,
      );
      const node = chapter?.items.find((item) => item.id === 'a2_c01n09');
      assert.equal(
        node?.cutsceneUrl,
        'https://banana.b-cdn.net/conversation-cutscenes/a2_c01n09.mp4',
      );
      const other = chapter?.items.find((item) => item.type !== 'mission');
      assert.equal(other?.cutsceneUrl, undefined);
    } finally {
      delete CONVERSATION_CUTSCENES.a2_c01n09;
      if (previous === undefined) delete process.env.BUNNY_CUTSCENE_BASE_URL;
      else process.env.BUNNY_CUTSCENE_BASE_URL = previous;
    }
  });
});
