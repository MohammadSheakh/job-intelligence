import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

/** Run once for a scheduler; help never initializes providers or opens a database connection. */
async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: pnpm notify:daily\nDistributes daily email digests to active candidates with new matching jobs.\nRun after pnpm build. External scheduler owns the periodic trigger.',
    );
    return;
  }
  if (process.argv.length > 2) throw new Error('Unsupported arguments. Use --help.');
  const { NotifyWorkerModule } = await import('./notify-worker.module.js');
  const { DailyNotificationService } =
    await import('../features/notifications/services/daily-notification.service.js');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const app = await NestFactory.createApplicationContext(NotifyWorkerModule, {
      logger: ['log', 'warn', 'error'],
      abortOnError: false,
    });
    try {
      const summary = await app.get(DailyNotificationService).run(controller.signal);
      console.log(JSON.stringify(summary, null, 2));
      if (summary.failedDigests > 0) process.exitCode = 1;
    } finally {
      await app.close();
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

void main().catch(() => {
  console.error('Daily notification execution failed. Check database and SMTP configuration.');
  process.exitCode = 1;
});
