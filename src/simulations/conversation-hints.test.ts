import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { simulationExpectedHints } from './conversation-hints';
import { getSimulation } from './simulations.data';

describe('conversation stuck hints', () => {
  it('uses the movie-ticket request, not a free-talk line', () => {
    const config = getSimulation('foundation_v7_u09n09');
    assert.ok(config);
    const hints = simulationExpectedHints(config, {});
    assert.equal(hints.length, 1);
    assert.equal(hints[0]?.sentenceEn, 'One ticket, please');
    assert.equal(hints[0]?.label, 'ขอตั๋วหนึ่งใบ');
    assert.equal(
      hints.some((hint) => /learn English|advice|practice speaking/i.test(hint.sentenceEn)),
      false,
    );
  });

  it('moves to the next expected line after the ticket is requested', () => {
    const config = getSimulation('foundation_v7_u09n09');
    assert.ok(config);
    const hints = simulationExpectedHints(config, { ticket: true });
    assert.deepEqual(
      hints.map((hint) => hint.sentenceEn),
      ['Friday at ten?', 'On Friday at ten.'],
    );
  });
});
