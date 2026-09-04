import assert from 'node:assert/strict';
import {
  INTRO_DEFAULT_DISPLAY_NAME,
  extractUserName,
  isPlausibleIntroDisplayName,
  pickIntroDisplayName,
} from '../topics/intro_script';

assert.equal(extractUserName("My name is Somchai"), 'Somchai');
assert.equal(extractUserName("I'm Jim"), 'Jim');
assert.equal(extractUserName('Hello'), null);

assert.equal(isPlausibleIntroDisplayName('Somchai'), true);
assert.equal(isPlausibleIntroDisplayName('not a learner'), false);
assert.equal(isPlausibleIntroDisplayName('นักเรียน'), false);
assert.equal(isPlausibleIntroDisplayName('ผู้เรียน'), false);
assert.equal(isPlausibleIntroDisplayName('Learner'), false);
assert.equal(isPlausibleIntroDisplayName('Thank you'), false);
assert.equal(isPlausibleIntroDisplayName('What is your name'), false);
assert.equal(isPlausibleIntroDisplayName('[Learner\'s Name]'), false);
assert.equal(isPlausibleIntroDisplayName('displayName'), false);

assert.equal(pickIntroDisplayName('Nana'), 'Nana');
assert.equal(pickIntroDisplayName('not a learner'), INTRO_DEFAULT_DISPLAY_NAME);
assert.equal(pickIntroDisplayName(null), INTRO_DEFAULT_DISPLAY_NAME);
assert.equal(pickIntroDisplayName(''), INTRO_DEFAULT_DISPLAY_NAME);
assert.equal(INTRO_DEFAULT_DISPLAY_NAME, 'Newbie');

console.log('intro-display-name.test.ts OK');
