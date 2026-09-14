import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';

const runOnStart = ['1','true','yes','on'].includes((process.env.RUN_DAILY_ON_START ?? '').toLowerCase());
const hour = Math.max(0, Math.min(23, Number(process.env.DAILY_CRAWL_HOUR ?? 6) || 6));
const minute = Math.max(0, Math.min(59, Number(process.env.DAILY_CRAWL_MINUTE ?? 15) || 15));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextRun(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

async function runTsScript(script: string): Promise<number> {
  return await new Promise((resolve) => {
    const tsxBin = path.resolve('node_modules/.bin/tsx');
    const child = spawn(tsxBin, [script], { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function runDailyPipeline(): Promise<void> {
  console.log(`[scheduler] daily pipeline started at ${new Date().toISOString()}`);
  const crawlCode = await runTsScript('scripts/crawl-daily.ts');
  if (crawlCode !== 0) {
    console.error(`[scheduler] crawler exited with code ${crawlCode}; notification step skipped`);
    return;
  }
  const notifyCode = await runTsScript('scripts/notify-daily.ts');
  if (notifyCode !== 0) console.error(`[scheduler] notifier exited with code ${notifyCode}`);
  else console.log('[scheduler] daily pipeline completed');
}

if (runOnStart) await runDailyPipeline();

for (;;) {
  const next = nextRun();
  const waitMs = Math.max(1000, next.getTime() - Date.now());
  console.log(`[scheduler] next run: ${next.toString()}`);
  await sleep(waitMs);
  await runDailyPipeline();
}
