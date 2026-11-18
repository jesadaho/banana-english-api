import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ALL_LEARN_PATH_NODES } from '../learn-path/foundation-v7-path.data';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { parseDateRange, parseMetricsFilters, type MetricsFilters } from './admin-metrics.util';

/** Lesson ids of Pronunciation nodes (Foundation `pron_*` and A2 ids). */
export function pronunciationLessonIds(): string[] {
  return [
    ...new Set(
      ALL_LEARN_PATH_NODES.filter((n) => n.type === 'pronunciation')
        .map((n) => n.contentRef.lessonId)
        .filter((id): id is string => !!id),
    ),
  ];
}

/**
 * Admin Retention → "Session volume by type", extra rows the main content
 * metrics merge into `training`: Pronunciation nodes are lesson sessions
 * (`training`) too. Returns `pronunciation` and `training` without them, so
 * the page can show both. (Kept out of admin-metrics.service on purpose.)
 */
@Controller('admin/metrics')
@UseGuards(AdminAuthGuard)
export class AdminSessionMixExtraController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('session-mix-extra')
  async sessionMixExtra(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('requireOnboarding') requireOnboarding?: string,
    @Query('requireSignedIn') requireSignedIn?: string,
    @Query('requireAppOpen') requireAppOpen?: string,
    @Query('excludeUnsetSource') excludeUnsetSource?: string,
  ) {
    let range: { from: Date; to: Date };
    try {
      range = parseDateRange(from, to);
    } catch {
      throw new BadRequestException('invalid_range');
    }
    const filters = parseMetricsFilters({
      requireOnboarding,
      requireSignedIn,
      requireAppOpen,
      excludeUnsetSource,
    });
    const pron = pronunciationLessonIds();
    const base: Prisma.UserSessionWhereInput = {
      sessionType: 'training',
      createdAt: { gte: range.from, lte: range.to },
      user: userWhere(filters),
    };
    const pronWhere: Prisma.UserSessionWhereInput = {
      ...base,
      OR: [{ lessonId: { in: pron } }, { lessonId: { startsWith: 'pron_' } }],
    };
    // Every other training session (lessonId null kept: NOT IN drops NULLs).
    const lessonWhere: Prisma.UserSessionWhereInput = {
      ...base,
      OR: [
        { lessonId: null },
        { AND: [{ lessonId: { notIn: pron } }, { NOT: { lessonId: { startsWith: 'pron_' } } }] },
      ],
    };
    const [pronCount, pronUsers, lessonCount, lessonUsers] = await Promise.all([
      this.prisma.userSession.count({ where: pronWhere }),
      this.prisma.userSession.findMany({ where: pronWhere, distinct: ['userId'], select: { userId: true } }),
      this.prisma.userSession.count({ where: lessonWhere }),
      this.prisma.userSession.findMany({ where: lessonWhere, distinct: ['userId'], select: { userId: true } }),
    ]);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      rows: [
        { sessionType: 'training', count: lessonCount, users: lessonUsers.length, source: 'user_session' },
        { sessionType: 'pronunciation', count: pronCount, users: pronUsers.length, source: 'user_session' },
      ],
    };
  }

  /**
   * Tap Mode vs speaking, per UTC day and node kind: answers, learners and
   * correct %. Rows come from `AnswerModeDaily` (app reports every answer).
   */
  @Get('answer-modes')
  async answerModes(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('requireOnboarding') requireOnboarding?: string,
    @Query('requireSignedIn') requireSignedIn?: string,
    @Query('requireAppOpen') requireAppOpen?: string,
    @Query('excludeUnsetSource') excludeUnsetSource?: string,
  ) {
    let range: { from: Date; to: Date };
    try {
      range = parseDateRange(from, to);
    } catch {
      throw new BadRequestException('invalid_range');
    }
    const filters = parseMetricsFilters({
      requireOnboarding,
      requireSignedIn,
      requireAppOpen,
      excludeUnsetSource,
    });
    const rows = await this.prisma.answerModeDaily.findMany({
      where: { day: { gte: range.from, lte: range.to }, user: userWhere(filters) },
      select: { day: true, userId: true, kind: true, mode: true, count: true, correct: true },
    });
    type Acc = { answers: number; correct: number; users: Set<string> };
    const byDay = new Map<string, Map<string, Acc>>();
    const totals = new Map<string, Acc>();
    const add = (map: Map<string, Acc>, key: string, r: (typeof rows)[number]) => {
      const acc = map.get(key) ?? { answers: 0, correct: 0, users: new Set<string>() };
      acc.answers += r.count;
      acc.correct += r.correct;
      acc.users.add(r.userId);
      map.set(key, acc);
    };
    for (const r of rows) {
      const day = r.day.toISOString().slice(0, 10);
      const dayMap = byDay.get(day) ?? new Map<string, Acc>();
      byDay.set(day, dayMap);
      for (const kind of [r.kind, 'all']) {
        add(dayMap, `${kind}|${r.mode}`, r);
        add(totals, `${kind}|${r.mode}`, r);
      }
    }
    const view = (map: Map<string, Acc>, kind: string) => {
      const pick = (mode: string) => {
        const a = map.get(`${kind}|${mode}`);
        return {
          answers: a?.answers ?? 0,
          users: a?.users.size ?? 0,
          correctPct: a && a.answers ? Math.round((a.correct / a.answers) * 1000) / 10 : null,
        };
      };
      const speak = pick('speak');
      const tap = pick('tap');
      const total = speak.answers + tap.answers;
      return {
        kind,
        speak,
        tap,
        tapSharePct: total ? Math.round((tap.answers / total) * 1000) / 10 : null,
      };
    };
    const kinds = ['all', 'lesson', 'say_it', 'new_words', 'word_cards', 'see_and_say', 'in_on_at'];
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      totals: kinds.map((k) => view(totals, k)),
      days: [...byDay.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([day, map]) => ({ day, kinds: kinds.map((k) => view(map, k)) })),
    };
  }
}

/** Same user filters as the other admin metrics. */
function userWhere(filters: MetricsFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (filters.requireOnboarding) where.onboardingCompleted = true;
  if (filters.requireSignedIn) where.firebaseUid = { not: null };
  if (filters.requireAppOpen) where.lastAppOpenDate = { not: null };
  if (filters.excludeUnsetSource) {
    where.AND = [{ acquisitionSource: { not: null } }, { NOT: { acquisitionSource: '' } }];
  }
  return where;
}
