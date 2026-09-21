import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

/** Run once for a scheduler; help never initializes providers or opens a database connection. */
async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: pnpm crawl:daily\nCrawls active MONITOR_READY companies and writes jobs/logs to DATABASE_URL.\nRun after pnpm build. External scheduler owns the 06:15 Asia/Dhaka trigger.',
    );
    return;
  }
  if (process.argv.length > 2) throw new Error('Unsupported arguments. Use --help.');
  const { CrawlWorkerModule } = await import('./crawl-worker.module.js');
  const { DailyCrawlService } =
    await import('../features/job-crawling/services/daily-crawl.service.js');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const app = await NestFactory.createApplicationContext(CrawlWorkerModule, {
      logger: ['log', 'warn'],
      abortOnError: false,
    });
    try {
      const summary = await app.get(DailyCrawlService).run(controller.signal);
      console.log(JSON.stringify(summary));
      if (summary.failed > 0 || summary.status === 'stopped') process.exitCode = 1;
    } finally {
      await app.close();
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

void main().catch(() => {
  console.error('Daily crawl failed. Check database connectivity and crawler configuration.');
  process.exitCode = 1;
});
