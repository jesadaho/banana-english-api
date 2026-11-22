import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { frameText, hintPolicyFor, itemHint, parseHintPolicyEnv } from './hint-policy';

describe('hint policy', () => {
  it('A1 Describe It: full frame first, first word later, full on retry, word bank on retry', () => {
    const p = hintPolicyFor('describe_it', 'fnd_v7_u04n05', {});
    assert.deepEqual(itemHint(p, 'She is a _____', 0), {
      frame: 'She is a _____',
      retryFrame: 'She is a _____',
      wordBank: 'retry',
      letterHints: 3,
      reveal: true,
    });
    assert.equal(itemHint(p, 'She is a _____', 1).frame, 'She ___');
    assert.equal(itemHint(p, 'She _____', 1).frame, 'She _____');
    assert.equal(itemHint(p, undefined, 1).frame, null);
  });

  it('other courses keep the full frame and no word bank', () => {
    const p = hintPolicyFor('describe_it', 'a2_c03n08', {});
    assert.equal(itemHint(p, 'It has a _____', 3).frame, 'It has a _____');
    assert.equal(p.wordBank, 'never');
    assert.equal(hintPolicyFor('say_it', 'time', {}).wordBank, 'never');
    assert.equal(hintPolicyFor('say_it', 'fnd_v7_u09n13', {}).wordBank, 'retry');
  });

  it('env overrides: a1, then per pool; bad values ignored', () => {
    const env = parseHintPolicyEnv(
      JSON.stringify({
        describe_it: { a1: { frame: { later: 'none' } }, pools: { fnd_x: { wordBank: 'always', frame: { first: 'bogus' } } } },
        say_it: { a1: { letterHints: 1, reveal: false } },
      }),
    );
    const a1 = hintPolicyFor('describe_it', 'fnd_y', env);
    assert.equal(a1.frame.later, 'none');
    assert.equal(a1.frame.first, 'full');
    const pool = hintPolicyFor('describe_it', 'fnd_x', env);
    assert.equal(pool.wordBank, 'always');
    assert.equal(pool.frame.first, 'full');
    const say = hintPolicyFor('say_it', 'fnd_z', env);
    assert.equal(say.letterHints, 1);
    assert.equal(say.reveal, false);
    assert.deepEqual(parseHintPolicyEnv('{not json'), {});
  });

  it('frameText modes', () => {
    assert.equal(frameText('I am _____', 'none'), null);
    assert.equal(frameText('A blue bag and a _____', 'first_word'), 'A ___');
  });
});
