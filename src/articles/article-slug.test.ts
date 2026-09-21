import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  articleHeroObjectPath,
  extensionForHeroMime,
  publicHeroUrl,
} from './article-hero';
import {
  isPublicArticle,
  normalizeArticleSlug,
  slugFromTitle,
} from './article-slug';

describe('normalizeArticleSlug', () => {
  it('kebabs English titles', () => {
    assert.equal(normalizeArticleSlug('Hello World'), 'hello-world');
    assert.equal(normalizeArticleSlug('  Hello--World!! '), 'hello-world');
  });

  it('keeps Thai letters', () => {
    assert.equal(normalizeArticleSlug('ฝึกพูด อังกฤษ'), 'ฝึกพูด-อังกฤษ');
  });

  it('returns empty when nothing usable remains', () => {
    assert.equal(normalizeArticleSlug('!!!'), '');
    assert.equal(normalizeArticleSlug(''), '');
  });
});

describe('slugFromTitle', () => {
  it('matches normalizeArticleSlug', () => {
    assert.equal(slugFromTitle('Say Hello'), normalizeArticleSlug('Say Hello'));
  });
});

describe('public listing', () => {
  it('hides unpublished articles', () => {
    assert.equal(isPublicArticle({ published: true }), true);
    assert.equal(isPublicArticle({ published: false }), false);
  });
});

describe('hero helpers', () => {
  it('maps allowed mime types', () => {
    assert.equal(extensionForHeroMime('image/jpeg'), 'jpg');
    assert.equal(extensionForHeroMime('image/png'), 'png');
    assert.equal(extensionForHeroMime('image/webp'), 'webp');
    assert.equal(extensionForHeroMime('image/gif'), null);
  });

  it('builds storage paths and public URLs', () => {
    assert.equal(
      articleHeroObjectPath('abc', 'jpg'),
      'articles/abc/hero.jpg',
    );
    assert.equal(
      publicHeroUrl('bucket.appspot.com', 'articles/abc/hero.jpg', 9),
      'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/articles%2Fabc%2Fhero.jpg?alt=media&v=9',
    );
  });
});
