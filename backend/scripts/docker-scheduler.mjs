import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');

const runOnStart = ['1', 'true', 'yes', 'on'].includes(
  (process.env.RUN_DAILY_ON_START ?? '').toLowerCase(),
);
const hour = Math.max(0, Math.min(23, Number(process.env.DAILY_CRAWL_HOUR ?? 6) || 6));
const minute = Math.max(0, Math.min(59, Number(process.env.DAILY_CRAWL_MINUTE ?? 15) || 15));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextRun() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

async function runNodeScript(scriptRelativePath) {
  return await new Promise((resolve) => {
    const fullPath = path.resolve(backendRoot, scriptRelativePath);
    console.log(`[scheduler] running node ${scriptRelativePath}...`);
    const child = spawn(process.execPath, [fullPath], {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`[scheduler] failed to launch ${scriptRelativePath}:`, err);
      resolve(1);
    });
  });
}

async function runDailyPipeline() {
  console.log(`[scheduler] daily pipeline started at ${new Date().toISOString()}`);
  const crawlCode = await runNodeScript('dist/src/commands/crawl-daily.js');
  if (crawlCode !== 0) {
    console.error(`[scheduler] crawler exited with code ${crawlCode}; skipping notifications`);
    return;
  }
  const notifyCode = await runNodeScript('dist/src/commands/notify-daily.js');
  if (notifyCode !== 0) {
    console.error(`[scheduler] notifications exited with code ${notifyCode}`);
  } else {
    console.log('[scheduler] daily pipeline completed successfully');
  }
}

if (runOnStart) {
  await runDailyPipeline();
}

for (;;) {
  const next = nextRun();
  const waitMs = Math.max(1000, next.getTime() - Date.now());
  console.log(`[scheduler] next scheduled run: ${next.toString()}`);
  await sleep(waitMs);
  await runDailyPipeline();
}
