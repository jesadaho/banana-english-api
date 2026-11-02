import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isGamesHubStart } from './is-games-hub-start';

describe('isGamesHubStart', () => {
  it('treats hub aliases as games-tab starts', () => {
    assert.equal(isGamesHubStart('hub'), true);
    assert.equal(isGamesHubStart('world-map'), true);
    assert.equal(isGamesHubStart('games'), true);
    assert.equal(isGamesHubStart('HUB'), true);
  });

  it('leaves path starts as not hub', () => {
    assert.equal(isGamesHubStart(undefined), false);
    assert.equal(isGamesHubStart('foundation'), false);
    assert.equal(isGamesHubStart(''), false);
  });
});
