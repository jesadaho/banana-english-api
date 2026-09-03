/**
 * Export LessonRating rows to CSV for Google Sheets / Excel.
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' npx tsx scripts/export-lesson-ratings.ts
 *
 * Output:
 *   scripts/output/lesson-ratings-YYYY-MM-DD.csv
 *   scripts/output/lesson-ratings-summary-YYYY-MM-DD.csv
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const ratings = await prisma.lessonRating.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          displayName: true,
          email: true,
          anonymousId: true,
          firebaseUid: true,
          selfReportedEnglishLevel: true,
          acquisitionSource: true,
          createdAt: true,
          fcmTokens: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { platform: true, createdAt: true },
          },
        },
      },
    },
  });

  const detailHeaders = [
    'createdAt',
    'stars',
    'lessonId',
    'sessionId',
    'feedback',
    'ratingId',
    'displayName',
    'email',
    'anonymousId',
    'firebaseUid',
    'platform',
    'selfReportedEnglishLevel',
    'acquisitionSource',
    'userCreatedAt',
  ];

  const detailRows = ratings.map((row) => [
    row.createdAt.toISOString(),
    row.stars,
    row.lessonId,
    row.sessionId ?? '',
    row.feedback ?? '',
    row.id,
    row.user.displayName ?? '',
    row.user.email ?? '',
    row.user.anonymousId,
    row.user.firebaseUid ?? '',
    row.user.fcmTokens[0]?.platform ?? '',
    row.user.selfReportedEnglishLevel ?? '',
    row.user.acquisitionSource ?? '',
    row.user.createdAt.toISOString(),
  ]);

  const starCounts = new Map<number, number>();
  for (const row of ratings) {
    starCounts.set(row.stars, (starCounts.get(row.stars) ?? 0) + 1);
  }

  const fiveStar = starCounts.get(5) ?? 0;
  const belowFive = ratings.length - fiveStar;

  const summaryHeaders = ['metric', 'value'];
  const summaryRows: unknown[][] = [
    ['total_ratings', ratings.length],
    ['five_star', fiveStar],
    ['below_five_star', belowFive],
    ['unique_users', new Set(ratings.map((r) => r.userId)).size],
    ['', ''],
    ['stars', 'count'],
    ...[5, 4, 3, 2, 1].map((stars) => [stars, starCounts.get(stars) ?? 0]),
    ['', ''],
    ['lessonId', 'count', 'avg_stars'],
  ];

  const byLesson = new Map<string, { count: number; sum: number }>();
  for (const row of ratings) {
    const current = byLesson.get(row.lessonId) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += row.stars;
    byLesson.set(row.lessonId, current);
  }

  for (const [lessonId, stats] of [...byLesson.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  )) {
    summaryRows.push([
      lessonId,
      stats.count,
      (stats.sum / stats.count).toFixed(2),
    ]);
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const outDir = join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });

  const detailPath = join(outDir, `lesson-ratings-${dateKey}.csv`);
  const summaryPath = join(outDir, `lesson-ratings-summary-${dateKey}.csv`);

  writeFileSync(detailPath, toCsv(detailHeaders, detailRows), 'utf8');
  writeFileSync(summaryPath, toCsv(summaryHeaders, summaryRows), 'utf8');

  console.log(`Exported ${ratings.length} ratings`);
  console.log(`  Detail:  ${detailPath}`);
  console.log(`  Summary: ${summaryPath}`);
  console.log('');
  console.log('Star breakdown:');
  for (const stars of [5, 4, 3, 2, 1]) {
    console.log(`  ${stars}★: ${starCounts.get(stars) ?? 0}`);
  }
  console.log('');
  console.log(
    `Note: Only 5★ users are prompted for App Store review (once). ` +
      `Apple may silently skip the dialog — so App Store reviews are usually much lower than in-app ratings.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
