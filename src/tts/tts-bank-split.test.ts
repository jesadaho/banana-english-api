import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  audioUrlForTurn,
  audioUrlsForSplitTurn,
  loadTtsBank,
  ttsBankLookupKey,
} from './tts-bank';
import { collectInteractiveScenarioBankLines } from '../interactive-scenario/interactive-scenario.runtime';
import {
  getInteractiveScenario,
  listInteractiveScenarioIds,
} from '../interactive-scenario/interactive-scenario.data';

describe('tts bank lookup', () => {
  it('ignores emoji', () => {
    assert.equal(
      ttsBankLookupKey('สุดยอดครับ! 🎉 เก่งมาก 🍌✨'),
      ttsBankLookupKey('สุดยอดครับ! เก่งมาก'),
    );
  });

  it('split turn: banked halves win over the joined line', () => {
    const banked = Object.keys(loadTtsBank().lines).filter(
      (l) => l.length > 8 && !l.includes('{'),
    );
    const [a, b] = banked;
    assert.ok(a && b);
    const both = audioUrlsForSplitTurn(`${a} ${b} zz-not-banked`, { lead: a, body: b });
    assert.equal(both.praiseAudioUrl, audioUrlForTurn(a));
    assert.equal(both.audioUrl, audioUrlForTurn(b));
    const preferHalves = audioUrlsForSplitTurn(a, { lead: a, body: b });
    assert.equal(preferHalves.praiseAudioUrl, audioUrlForTurn(a));
    assert.equal(preferHalves.audioUrl, audioUrlForTurn(b));
    const half = audioUrlsForSplitTurn(`${a} zz-unknown`, { lead: a, body: 'zz-unknown line' });
    assert.deepEqual(half, { audioUrl: null, praiseAudioUrl: null });
    const whole = audioUrlsForSplitTurn(a, { lead: 'zz', body: 'zz' });
    assert.deepEqual(whole, { audioUrl: audioUrlForTurn(a), praiseAudioUrl: null });
  });
});

describe('interactive scenario bank lines', () => {
  const scenarios = listInteractiveScenarioIds()
    .map((id) => getInteractiveScenario(id))
    .filter((s): s is NonNullable<typeof s> => s != null);
  const lines = collectInteractiveScenarioBankLines(scenarios);

  it('covers the Final Interview opening, prompts and praise as separate clips', () => {
    assert.ok(lines.some((l) => l.startsWith('Finally… you made it to the top.')));
    assert.ok(lines.includes('Look at the table. How many apples are there?'));
    assert.ok(lines.includes('Yes! Three apples. Excellent!'));
    assert.ok(lines.includes('Hmm… not yet. Try again!'));
    assert.ok(lines.includes("I'm good at exploring new places!"));
    assert.ok(lines.includes('Saturday evening? Great!'));
    assert.ok(lines.includes("Hello! I am Teacher Minnie. What's your name?"));
    assert.equal(
      lines.some((l) => l.includes('Yes! Three apples') && l.includes('What')),
      false,
    );
  });

  it('skips learner-specific {slot} lines', () => {
    assert.equal(lines.some((l) => l.includes('{')), false);
  });
});
