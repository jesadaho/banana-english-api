import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BODY_MAX, composeActive, composeIdle, composeIdleApp, composeLight, visibleLength } from './weekly-report.copy';
import { decideSend, pickHighestAddon, speakSegment } from './weekly-report.rules';

describe('speakSegment', () => {
  it('splits active light idle_app idle', () => {
    assert.equal(speakSegment(10, 1, 0), 'active');
    assert.equal(speakSegment(9, 1, 0), 'light');
    assert.equal(speakSegment(0, 2, 0), 'idle_app');
    assert.equal(speakSegment(0, 0, 4), 'idle_app');
    assert.equal(speakSegment(0, 0, 0), 'idle');
  });
});

describe('decideSend', () => {
  it('skips learners gone more than 14 days', () => {
    const d = decideSend({
      sentences: 0,
      activeDays: 0,
      words: 0,
      daysSinceLastOpen: 15,
      createdThisWeek: false,
      consecutiveIdleWeeks: 0,
    });
    assert.deepEqual(d, { send: false, reason: 'gone' });
  });

  it('stops after two consecutive idle weeks', () => {
    const d = decideSend({
      sentences: 0,
      activeDays: 0,
      words: 0,
      daysSinceLastOpen: 10,
      createdThisWeek: false,
      consecutiveIdleWeeks: 2,
    });
    assert.deepEqual(d, { send: false, reason: 'idle_stopped' });
  });

  it('tags first week over speak segment', () => {
    const d = decideSend({
      sentences: 18,
      activeDays: 3,
      words: 8,
      daysSinceLastOpen: 0,
      createdThisWeek: true,
      consecutiveIdleWeeks: 0,
    });
    assert.deepEqual(d, { send: true, speak: 'active', segment: 'first_week' });
  });

  it('sends idle on week two so the restricted pool can fire', () => {
    const d = decideSend({
      sentences: 0,
      activeDays: 0,
      words: 0,
      daysSinceLastOpen: 8,
      createdThisWeek: false,
      consecutiveIdleWeeks: 1,
    });
    assert.deepEqual(d, { send: true, speak: 'idle', segment: 'idle' });
  });
});

describe('pickHighestAddon', () => {
  it('keeps the best rank and ties break randomly among that rank', () => {
    const picked = pickHighestAddon(
      [
        { kind: 'vocab', rank: 3, titleTh: '', titleEn: '', descTh: '', descEn: '', route: '', icon: 'book', vars: {} },
        { kind: 'interview', rank: 1, titleTh: '', titleEn: '', descTh: '', descEn: '', route: '', icon: 'mic', vars: {} },
        { kind: 'level_test', rank: 1, titleTh: '', titleEn: '', descTh: '', descEn: '', route: '', icon: 'trophy', vars: {} },
      ],
      () => 0,
    );
    assert.equal(picked?.kind, 'interview');
  });
});

describe('composer', () => {
  it('keeps title and body within limits', () => {
    const out = composeActive({
      locale: 'th',
      firstWeek: false,
      vars: { n: 142 },
      addon: {
        kind: 'interview',
        rank: 1,
        titleTh: 'John',
        titleEn: 'John',
        descTh: '',
        descEn: '',
        route: '',
        icon: 'mic',
        vars: { name: 'John' },
      },
      recentIds: [],
      random: () => 0,
    });
    assert.ok(visibleLength(out.title) <= 30);
    assert.ok(visibleLength(out.body) <= BODY_MAX);
    assert.match(out.templateId, /open_01\+add_interview\+close_01/);
  });

  it('uses the first-week title and drops compare-style numbers in title', () => {
    const out = composeLight({
      locale: 'th',
      firstWeek: true,
      vars: { n: 6 },
      recentIds: [],
      random: () => 0,
    });
    assert.equal(out.title, 'สรุปสัปดาห์แรกของคุณ');
    assert.doesNotMatch(out.title, /\d/);
  });

  it('filters idle_app lines to ones with data', () => {
    const out = composeIdleApp({
      locale: 'th',
      firstWeek: false,
      vars: { w: 12 },
      recentIds: [],
      random: () => 0,
    });
    assert.match(out.body, /12/);
    assert.equal(out.templateId, 'idle_app_vocab');
  });

  it('restricts idle week 2 to the miss-you pool', () => {
    const out = composeIdle({
      locale: 'th',
      vars: {},
      recentIds: [],
      consecutiveIdleWeeks: 1,
      previousActiveDays: 0,
      idle01Blocked: true,
      random: () => 0,
    });
    assert.ok(['idle_02', 'idle_03', 'idle_06'].includes(out.templateId));
  });

  it('blocks sulky idle_01 without two prior active days', () => {
    const out = composeIdle({
      locale: 'th',
      vars: {},
      recentIds: ['idle_02', 'idle_03', 'idle_04', 'idle_05', 'idle_07', 'idle_08'],
      consecutiveIdleWeeks: 0,
      previousActiveDays: 1,
      idle01Blocked: false,
      random: () => 0,
    });
    assert.notEqual(out.templateId, 'idle_01');
  });
});
