import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { V7_LEGACY_FLOWS } from './foundation-v7-legacy-flows';

describe('Chapter 13 happening-now lessons', () => {
  it('Happening Now contrasts habit vs now then builds am/is/are + -ing', () => {
    const steps = V7_LEGACY_FLOWS.fnd_v7_happening_now;
    assert.ok(steps);
    assert.match(steps[0].instruction, /I read every day/);
    assert.match(steps[0].instruction, /I am reading now/);
    assert.equal(steps[0].expectedSpeech, 'I am reading.');
    assert.equal(steps[1].expectedSpeech, 'She is reading.');
    assert.equal(steps[3].expectedSpeech, 'They are reading.');
    assert.match(steps[5].instruction, /eat/);
    assert.match(steps[5].instruction, /eating/);
    assert.equal(steps[5].expectedSpeech, 'I am eating.');
    assert.equal(steps.at(-1)!.kind, 'complete');
  });

  it('Are They Working? teaches Yes/No short answers with clear situations', () => {
    const steps = V7_LEGACY_FLOWS.fnd_v7_are_they_working;
    assert.ok(steps);
    assert.match(steps[0].instruction, /ถามว่ากำลังทำสิ่งนั้นอยู่ไหม/);
    assert.equal(steps[0].expectedSpeech, 'Are they working?');
    assert.equal(steps[2].expectedSpeech, 'They are not working.');
    assert.match(steps[2].instruction, /not หลัง are/);
    assert.equal(steps[4].expectedSpeech, 'Yes, she is.');
    assert.match(steps[4].instruction, /กำลังนั่งทำงาน/);
    assert.equal(steps[5].expectedSpeech, 'No, she is not.');
    assert.match(steps[5].instruction, /กำลังกินข้าว/);
    assert.equal(steps[6].expectedSpeech, 'Yes, they are.');
    assert.equal(steps.at(-1)!.kind, 'complete');
  });
});
