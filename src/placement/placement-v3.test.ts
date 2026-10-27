import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPlacementQuestion } from './placement.bank';
import {
  normalizePlacementBand,
  normalizePlacementResultPayload,
  placementBandFromResult,
} from './placement-band';
import {
  placementCaptureNoise,
  placementLocalScore,
  placementSttPromptLeak,
} from './placement.runtime';

function local(id: string, transcript: string) {
  return placementLocalScore(getPlacementQuestion(id)!, transcript)?.score ?? null;
}

describe('placement v3 local scoring', () => {
  it('S01: a name sentence is 2, the name alone is 1, never judges the name', () => {
    assert.equal(local('S01', 'My name is Ploy.'), 2);
    assert.equal(local('S01', "My name's Nong Fah."), 2);
    assert.equal(local('S01', "I'm Kittipong."), 2);
    assert.equal(local('S01', 'Im Tee'), 2);
    assert.equal(local('S01', 'I am Somchai.'), 2);
    assert.equal(local('S01', 'Ploy.'), 1);
    assert.equal(local('S01', 'Nong Fah'), 1);
    // Greetings / echoes are not a name: let the judge decide.
    assert.equal(local('S01', 'Hello.'), null);
  });

  it('S03: I am + feeling is 2 (also "am happy"), a feeling word is 1', () => {
    assert.equal(local('S03', "I'm happy."), 2);
    assert.equal(local('S03', 'I am very tired today.'), 2);
    assert.equal(local('S03', "I'm not hungry."), 2);
    assert.equal(local('S03', 'Am fine.'), 2);
    assert.equal(local('S03', 'I feel good.'), 2);
    assert.equal(local('S03', 'Happy.'), 1);
    assert.equal(local('S03', 'Fine, thank you.'), 1);
    assert.equal(local('S03', 'I go to school.'), null);
  });

  it('Q06: "three" in Thai-accented ASR forms is 2 (prod v2.4 transcripts)', () => {
    for (const said of [
      'Three apples.',
      'Three.',
      'Tree',
      'Tree apple',
      'Ttri.',
      'Ttrii',
      'Tui',
      'Tui Apple',
      'TIE',
      'TIE Eppo.',
      'Thai. Thai apple.',
      'T-Apples.',
      'T. Apple. T.',
      'Apple T. Apple',
      'There are three efforts.',
      "Three's apple?",
      'There are 3 apples.',
    ]) {
      assert.equal(local('Q06', said), 2, said);
    }
  });

  it('Q06: a wrong count is 0, the noun alone is 1, unclear goes to the judge', () => {
    assert.equal(local('Q06', 'Four. Four.'), 0);
    assert.equal(local('Q06', 'Five. Apple.'), 0);
    assert.equal(local('Q06', 'Apple.'), 1);
    assert.equal(local('Q06', 'Apples.'), 1);
    // "tea" alone (no apple) is too ambiguous to award.
    assert.equal(local('Q06', 'It is tea.'), null);
    assert.equal(local('Q06', 'Cheese'), null);
  });

  it('other items are left to the judge', () => {
    assert.equal(local('Q02', 'My mother is a teacher.'), null);
    assert.equal(local('Q04', 'A book.'), null);
  });
});

describe('placement v3 STT prompt leak', () => {
  it('treats echoed Whisper bias prompts as capture noise (ask again)', () => {
    for (const said of [
      'Thai learner.',
      'Tai learner practicing.',
      'Thai learner practicing spoken English with a Thai accent.',
      'Casual Thai and English mixed speech.',
    ]) {
      assert.equal(placementSttPromptLeak(said), true, said);
      assert.equal(placementCaptureNoise(said), true, said);
    }
  });

  it('keeps real answers that mention Thai', () => {
    for (const said of ["I'm from Thailand.", 'My friend is a Thai student.', 'Thai food.']) {
      assert.equal(placementSttPromptLeak(said), false, said);
    }
  });
});

describe('placement v3 legacy bands', () => {
  it('reads pre-v3 "Seed+" as Seed++ and leaves v3 results alone', () => {
    assert.equal(normalizePlacementBand('Seed+', 'placement-q-v2.4'), 'Seed++');
    assert.equal(normalizePlacementBand('Seed+', undefined), 'Seed++');
    assert.equal(normalizePlacementBand('Seed+', 'placement-q-v3.0'), 'Seed+');
    assert.equal(normalizePlacementBand('A1', 'placement-q-v2.4'), 'A1');
    assert.equal(normalizePlacementBand('', 'placement-q-v2.4'), null);
    assert.equal(
      placementBandFromResult({ publicResult: 'Seed+', questionVersion: 'placement-q-v2.3' }),
      'Seed++',
    );
  });

  it('rewrites the app payload label for legacy Seed+', () => {
    const legacy = { publicResult: 'Seed+', questionVersion: 'placement-q-v2.4', resultLabel: 'old' };
    const out = normalizePlacementResultPayload(legacy) as Record<string, unknown>;
    assert.equal(out.publicResult, 'Seed++');
    assert.match(String(out.resultLabel), /^Seed\+\+ · /);
    const v3 = { publicResult: 'Seed+', questionVersion: 'placement-q-v3.0' };
    assert.equal(normalizePlacementResultPayload(v3), v3);
    assert.equal(normalizePlacementResultPayload(null), null);
  });
});
