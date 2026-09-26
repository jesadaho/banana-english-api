import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseGroqApiKeys, pickGroqApiKeyForClient } from './groq-api-keys';

describe('parseGroqApiKeys', () => {
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
    assert.equal(pickGroqApiKeyForClient(keys), 'gsk_a');
    assert.equal(pickGroqApiKeyForClient(keys), 'gsk_b');
    assert.equal(pickGroqApiKeyForClient(keys), 'gsk_c');
    assert.equal(pickGroqApiKeyForClient(keys), 'gsk_a');
  });
});
