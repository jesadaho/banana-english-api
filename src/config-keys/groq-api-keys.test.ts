import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  GROQ_KEY_COOLDOWN_MS,
  isGroqKeyHot,
  markGroqKeyHot,
  parseGroqApiKeys,
  pickGroqApiKeyForClient,
  resetGroqClientKeyState,
} from './groq-api-keys';

describe('parseGroqApiKeys', () => {
  afterEach(() => {
    resetGroqClientKeyState();
  });

  it('reads a single GROQ_API_KEY', () => {
    assert.deepEqual(parseGroqApiKeys({ GROQ_API_KEY: 'gsk_a' }), ['gsk_a']);
  });

  it('prefers GROQ_API_KEYS list and dedupes', () => {
    assert.deepEqual(
      parseGroqApiKeys({
        GROQ_API_KEY: 'gsk_old',
        GROQ_API_KEYS: 'gsk_a, gsk_b;gsk_a\ngsk_c',
      }),
      ['gsk_a', 'gsk_b', 'gsk_c'],
    );
  });

  it('returns empty when nothing is set', () => {
    assert.deepEqual(parseGroqApiKeys({}), []);
  });

  it('picks one client key at a time from the pool', () => {
    const keys = ['gsk_a', 'gsk_b', 'gsk_c'];
    assert.deepEqual(pickGroqApiKeyForClient(keys), { key: 'gsk_a', keyId: 'k1' });
    assert.deepEqual(pickGroqApiKeyForClient(keys), { key: 'gsk_b', keyId: 'k2' });
    assert.deepEqual(pickGroqApiKeyForClient(keys), { key: 'gsk_c', keyId: 'k3' });
    assert.deepEqual(pickGroqApiKeyForClient(keys), { key: 'gsk_a', keyId: 'k1' });
  });

  it('skips hot keys until cooldown expires', () => {
    const keys = ['gsk_a', 'gsk_b', 'gsk_c'];
    const now = 1_000_000;
    markGroqKeyHot('k1', now);
    assert.equal(isGroqKeyHot('k1', now), true);
    assert.deepEqual(pickGroqApiKeyForClient(keys, now), {
      key: 'gsk_b',
      keyId: 'k2',
    });
    markGroqKeyHot('k2', now);
    markGroqKeyHot('k3', now);
    assert.equal(pickGroqApiKeyForClient(keys, now), undefined);
    const cooled = pickGroqApiKeyForClient(
      keys,
      now + GROQ_KEY_COOLDOWN_MS + 1,
    );
    assert.ok(cooled);
    assert.equal(['gsk_a', 'gsk_b', 'gsk_c'].includes(cooled.key), true);
  });
});
