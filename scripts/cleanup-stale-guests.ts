/**
 * Manual / CI entry for stale guest cleanup.
 *
 *   npx tsx scripts/cleanup-stale-guests.ts
 *   npx tsx scripts/cleanup-stale-guests.ts --execute
 *   npx tsx scripts/cleanup-stale-guests.ts --days=45 --execute
 *
 * Default is dry-run (count + sample only). Requires DATABASE_URL (Nest loads .env).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StaleGuestCleanupService } from '../src/users/stale-guest-cleanup.service';

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const daysArg = args.find((a) => a.startsWith('--days='));
  const days = daysArg ? Number(daysArg.slice('--days='.length)) : undefined;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const cleanup = app.get(StaleGuestCleanupService);
    const result = await cleanup.runCleanup({
      mode: execute ? 'execute' : 'dry-run',
      days: Number.isFinite(days) ? days : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
