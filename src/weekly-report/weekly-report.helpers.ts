import { getAchievementById } from '../achievements/achievements.data';
import { LEARN_COURSES } from '../learn-path/foundation-v7-path.data';
import { streakHitMilestone } from './weekly-report.rules';
import type {
  WeeklyAddon,
  WeeklyReportLocale,
  WeeklyStats,
} from './weekly-report.types';

export const WEEKLY_REPORT_MIN_APP_VERSION = '1.0.20';

const INTERVIEW_NAMES: Record<string, string> = {
  final_interview_john: 'John',
  final_interview_minnie: 'Minnie',
  final_interview_nina: 'Nina',
};

const TH_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function parseAppVersion(raw?: string | null): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(raw ?? '');
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareAppVersion(a: string, b: string): number {
  const left = parseAppVersion(a);
  const right = parseAppVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i]! !== right[i]!) return left[i]! - right[i]!;
  }
  return 0;
}

export function appSupportsWeeklyReport(version?: string | null): boolean {
  if (!version) return true;
  return compareAppVersion(version, WEEKLY_REPORT_MIN_APP_VERSION) >= 0;
}

export function reportRoute(weekKey: string, appVersion?: string | null): string {
  return appSupportsWeeklyReport(appVersion)
    ? `/weekly-report/${weekKey}`
    : '/train';
}

export function dateLabel(
  dateKeys: string[],
  locale: WeeklyReportLocale,
): string {
  const first = dateKeys[0]!;
  const last = dateKeys[dateKeys.length - 1]!;
  return `${formatDay(first, locale)} – ${formatDay(last, locale)}`;
}

function formatDay(dateKey: string, locale: WeeklyReportLocale): string {
  const [, month, day] = dateKey.split('-').map(Number);
  const months = locale === 'en' ? EN_MONTHS : TH_MONTHS;
  return `${day} ${months[month - 1]}`;
}

export function remainingChapter(
  lastStudiedLessonId: string | null | undefined,
): {
  chapter: number;
  chapterNameTh: string;
  chapterNameEn: string;
  remaining: number;
  complete: boolean;
  progress: number;
} | null {
  if (!lastStudiedLessonId) return null;
  for (const course of LEARN_COURSES) {
    for (const chapter of course.catalog.chapters) {
      const index = chapter.items.findIndex(
        (node) =>
          node.id === lastStudiedLessonId ||
          node.contentRef.lessonId === lastStudiedLessonId,
      );
      if (index < 0) continue;
      const remaining = Math.max(0, chapter.items.length - index - 1);
      return {
        chapter: chapter.number,
        chapterNameTh: chapter.titleTh,
        chapterNameEn: chapter.titleEn,
        remaining,
        complete: remaining === 0,
        progress: Math.round(((index + 1) / chapter.items.length) * 100),
      };
    }
  }
  return null;
}

export function buildAddons(input: {
  interviews: Array<{ scenarioId: string }>;
  placementLevel?: string | null;
  placementTopPercent?: number | null;
  rank?: number;
  game?: string;
  badges: Array<{ achievementId: string }>;
  streakDays: number;
  perfectStars: number;
  words: number;
  locale: WeeklyReportLocale;
}): WeeklyAddon[] {
  const addons: WeeklyAddon[] = [];

  for (const row of input.interviews) {
    const name = INTERVIEW_NAMES[row.scenarioId];
    if (!name) continue;
    addons.push({
      kind: 'interview',
      rank: 1,
      titleTh: `ผ่านสัมภาษณ์ ${name}`,
      titleEn: `Passed ${name}'s interview`,
      descTh: 'Final Interview',
      descEn: 'Final Interview',
      route: '/train',
      icon: 'mic',
      vars: { name },
    });
  }

  if (input.placementLevel && input.placementTopPercent != null) {
    addons.push({
      kind: 'level_test',
      rank: 1,
      titleTh: `สอบได้ ${input.placementLevel}`,
      titleEn: `Placed ${input.placementLevel}`,
      descTh: `Top ${input.placementTopPercent}%`,
      descEn: `Top ${input.placementTopPercent}%`,
      route: '/journey',
      icon: 'trophy',
      vars: { level: input.placementLevel, x: input.placementTopPercent },
    });
  }

  if (input.rank && input.game) {
    addons.push({
      kind: input.rank <= 3 ? 'leaderboard_top' : 'leaderboard',
      rank: input.rank <= 3 ? 1 : 2,
      titleTh: `อันดับ #${input.rank} ${input.game}`,
      titleEn: `#${input.rank} on ${input.game}`,
      descTh: 'ตารางอันดับรายสัปดาห์',
      descEn: 'Weekly leaderboard',
      route: '/games',
      icon: 'medal',
      vars: { r: input.rank, game: input.game },
    });
  }

  if (input.badges.length > 0) {
    const first = getAchievementById(input.badges[0]!.achievementId);
    const badgeName =
      input.locale === 'en' ? first?.titleEn ?? 'badge' : first?.titleTh ?? 'badge';
    addons.push({
      kind: 'badge',
      rank: 2,
      titleTh:
        input.badges.length >= 2
          ? `ปลดล็อก badge ${input.badges.length} อัน`
          : `ปลดล็อก ${badgeName}`,
      titleEn:
        input.badges.length >= 2
          ? `${input.badges.length} new badges`
          : `Unlocked ${badgeName}`,
      descTh: 'ความสำเร็จใหม่',
      descEn: 'New achievement',
      route: '/journey',
      icon: 'badge',
      vars: { badge: badgeName, count: input.badges.length },
    });
  }

  if (streakHitMilestone(input.streakDays)) {
    addons.push({
      kind: 'streak',
      rank: 2,
      titleTh: `ไฟติด ${input.streakDays} วัน`,
      titleEn: `${input.streakDays}-day streak`,
      descTh: 'ไม่หลุดเลย',
      descEn: 'Still going',
      route: '/train',
      icon: 'fire',
      vars: { s: input.streakDays },
    });
  }

  if (input.perfectStars > 0) {
    addons.push({
      kind: 'perfect',
      rank: 3,
      titleTh: `ดาว Perfect ${input.perfectStars} ดวง`,
      titleEn: `${input.perfectStars} Perfect stars`,
      descTh: 'เล่นเป๊ะทั้งรอบ',
      descEn: 'Cleared without a miss',
      route: '/games',
      icon: 'star',
      vars: { k: input.perfectStars },
    });
  }

  if (input.words > 0) {
    addons.push({
      kind: 'vocab',
      rank: 3,
      titleTh: `คำศัพท์ใหม่ ${input.words} คำ`,
      titleEn: `${input.words} new words`,
      descTh: 'เก็บจากบทเรียน',
      descEn: 'From this week’s lessons',
      route: '/games',
      icon: 'book',
      vars: { w: input.words },
    });
  }

  return addons;
}

export function notificationData(input: {
  route: string;
  weekKey: string;
  segment: string;
  templateId: string;
  sentences: number;
  minutes: number;
  words: number;
  activeDays: string;
}): Record<string, string> {
  return {
    route: input.route,
    weekKey: input.weekKey,
    segment: input.segment,
    templateId: input.templateId,
    sentences: String(input.sentences),
    minutes: String(input.minutes),
    words: String(input.words),
    activeDays: input.activeDays,
  };
}

export function emptyStats(): WeeklyStats {
  return {
    sentences: 0,
    minutes: 0,
    words: 0,
    speakSessions: 0,
    lessonsCompleted: 0,
    activeDayCount: 0,
    activeDays: '0000000',
    streakDays: 0,
    streakRecord: false,
    addons: [],
  };
}
