import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { composeIdle } from './weekly-report.copy';
import { decideSend } from './weekly-report.rules';
import { buildAddons, notificationData } from './weekly-report.helpers';
import { WeeklyReportService } from './weekly-report.service';

describe('weekly report job rules', () => {
  it('does not send after 14 silent days', () => {
    const gone = decideSend({
      sentences: 0,
      activeDays: 0,
      words: 0,
      daysSinceLastOpen: 15,
      createdThisWeek: false,
      consecutiveIdleWeeks: 0,
    });
    assert.deepEqual(gone, { send: false, reason: 'gone' });
  });

  it('keeps idle week 2 in the miss-you pool then stops', () => {
    const week2 = decideSend({
      sentences: 0,
      activeDays: 0,
      words: 0,
      daysSinceLastOpen: 8,
      createdThisWeek: false,
      consecutiveIdleWeeks: 1,
    });
    assert.equal(week2.send, true);
    const copy = composeIdle({
      locale: 'th',
      vars: { x: 2, chapter: 'At the Café' },
      recentIds: [],
      consecutiveIdleWeeks: 1,
      previousActiveDays: 0,
      idle01Blocked: true,
      random: () => 0,
    });
    assert.ok(['idle_02', 'idle_03', 'idle_06'].includes(copy.templateId));
    const week3 = decideSend({
      sentences: 0,
      activeDays: 0,
      words: 0,
      daysSinceLastOpen: 8,
      createdThisWeek: false,
      consecutiveIdleWeeks: 2,
    });
    assert.deepEqual(week3, { send: false, reason: 'idle_stopped' });
  });

  it('stores string-only notification data', () => {
    const data = notificationData({
      route: '/weekly-report/2026-W44',
      weekKey: '2026-W44',
      segment: 'active',
      templateId: 'open_01+close_01',
      sentences: 142,
      minutes: 48,
      words: 23,
      activeDays: '1111111',
    });
    assert.equal(data.sentences, '142');
    assert.equal(data.activeDays, '1111111');
  });

  it('ranks interview above vocab', () => {
    const addons = buildAddons({
      interviews: [{ scenarioId: 'final_interview_john' }],
      badges: [],
      streakDays: 3,
      perfectStars: 2,
      words: 12,
      locale: 'th',
    });
    assert.equal(addons[0]?.kind, 'interview');
    assert.ok(addons.some((item) => item.kind === 'vocab'));
  });
});

describe('GET snapshot', () => {
  it('404s when no snapshot exists (idle / not sent)', async () => {
    const prisma = {
      weeklyReportSnapshot: {
        findUnique: async () => null,
      },
    };
    const service = new WeeklyReportService(prisma as never, {} as never);
    await assert.rejects(() => service.getSnapshot('u1', '2026-W44'), NotFoundException);
  });

  it('returns the frozen row', async () => {
    const prisma = {
      weeklyReportSnapshot: {
        findUnique: async () => ({
          weekKey: '2026-W44',
          segment: 'active',
          templateId: 'open_01+close_01',
          locale: 'th',
          title: 'สรุปอาทิตย์นี้มาแล้ว',
          body: 'พูดไป 142 ประโยค',
          payload: { sentences: 142 },
        }),
      },
    };
    const service = new WeeklyReportService(prisma as never, {} as never);
    const row = await service.getSnapshot('u1', '2026-W44');
    assert.equal(row.segment, 'active');
    assert.equal((row.payload as { sentences: number }).sentences, 142);
  });
});

describe('skip daily after weekly', () => {
  it('sees a weekly_report log on that Sunday', async () => {
    const prisma = {
      notificationLog: {
        findUnique: async () => ({ id: 'n1' }),
      },
    };
    const service = new WeeklyReportService(prisma as never, {} as never);
    assert.equal(await service.hasWeeklyReportOn('u1', '2026-11-01'), true);
  });
});
