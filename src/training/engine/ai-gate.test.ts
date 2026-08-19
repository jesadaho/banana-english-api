import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ASSESS_CLASSIFICATION_RUBRIC } from './ai-gate';

describe('ASSESS_CLASSIFICATION_RUBRIC', () => {
  it('defines all three tiers with meaning-first rules', () => {
    assert.match(ASSESS_CLASSIFICATION_RUBRIC, /correct \| close \| incorrect/);
    assert.match(ASSESS_CLASSIFICATION_RUBRIC, /TUTOR QUESTION/);
    assert.match(ASSESS_CLASSIFICATION_RUBRIC, /I from Thailand/);
    assert.match(ASSESS_CLASSIFICATION_RUBRIC, /Nice meet you/);
    assert.match(ASSESS_CLASSIFICATION_RUBRIC, /I'm Nana/);
    assert.match(
      ASSESS_CLASSIFICATION_RUBRIC,
      /Do not mark an answer close solely because a person/,
    );
  });
});
