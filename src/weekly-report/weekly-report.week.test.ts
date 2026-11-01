import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeDaysBits,
  isSundayEvening,
  localWeekDateKeys,
  previousWeekKey,
  WEEKLY_REPORT_HOUR,
} from './weekly-report.week';
import { appSupportsWeeklyReport, dateLabel, reportRoute } from './weekly-report.helpers';

describe('week window', () => {
  it('lists Monday–Sunday ending on the Sunday that contains now', () => {
    const keys = localWeekDateKeys('Asia/Bangkok', new Date('2026-11-01T12:00:00+07:00'));
    assert.deepEqual(keys, [
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('is Sunday 19:00 local only', () => {
    assert.equal(
      isSundayEvening('Asia/Bangkok', new Date('2026-11-01T19:05:00+07:00')),
      true,
    );
    assert.equal(
      isSundayEvening('Asia/Bangkok', new Date('2026-11-01T18:05:00+07:00')),
      false,
    );
    assert.equal(WEEKLY_REPORT_HOUR, 19);
  });

  it('walks ISO week keys backwards', () => {
    assert.equal(previousWeekKey('2026-W44'), '2026-W43');
    assert.equal(previousWeekKey('2026-W01'), '2025-W52');
  });

  it('encodes the 7-day bar', () => {
    assert.equal(
      activeDaysBits(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        new Set(['a', 'c', 'g']),
      ),
      '1010001',
    );
  });
});

describe('report helpers', () => {
  it('fails closed for old app versions', () => {
    assert.equal(appSupportsWeeklyReport(null), true);
    assert.equal(appSupportsWeeklyReport('1.0.19+10'), false);
    assert.equal(appSupportsWeeklyReport('1.0.20+22'), true);
    assert.equal(reportRoute('2026-W44', '1.0.19'), '/train');
    assert.equal(reportRoute('2026-W44', '1.0.20+22'), '/weekly-report/2026-W44');
  });

  it('formats a Thai date range', () => {
    assert.equal(
      dateLabel(['2026-10-26', '2026-11-01'], 'th'),
      '26 ต.ค. – 1 พ.ย.',
    );
  });
});
