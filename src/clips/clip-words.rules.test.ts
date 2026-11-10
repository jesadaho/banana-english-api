import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanGloss, pickIpa, wordAt } from './clip-words.rules';

describe('clip words', () => {
  it('wordAt splits like the app and skips punctuation-only tokens', () => {
    assert.deepEqual(wordAt('I want to grab a bite, before the movie.', 5), {
      word: 'bite,',
      core: 'bite',
    });
    assert.equal(wordAt('Hi — there', 1), null);
    assert.equal(wordAt('Hi there', 9), null);
    assert.equal(wordAt("Don't go", 0)?.core, "don't");
  });

  it('pickIpa reads phonetic, then phonetics[].text', () => {
    assert.equal(pickIpa([{ phonetic: '/ɡræb/' }]), '/ɡræb/');
    assert.equal(pickIpa([{ phonetics: [{}, { text: '/baɪt/' }] }]), '/baɪt/');
    assert.equal(pickIpa({ title: 'No Definitions Found' }), '');
  });

  it('cleanGloss needs Thai and bounds fields', () => {
    assert.equal(cleanGloss({ th: '  ' }), null);
    const g = cleanGloss({ th: 'คำกินเล็กน้อย', lemma: 'Bite', pos: 'Noun', example: 'x'.repeat(300) });
    assert.equal(g?.lemma, 'bite');
    assert.equal(g?.pos, 'noun');
    assert.equal(g?.example.length, 140);
  });
});
