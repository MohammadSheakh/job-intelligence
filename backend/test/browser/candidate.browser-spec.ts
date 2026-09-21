import 'reflect-metadata';
import { Global, Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { mkdtemp, cp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaModule, PrismaService } from '@app/database';
import { AppConfigService } from '../../src/config/config.service';
import { CandidatePortalModule } from '../../src/features/candidate-portal/candidate-portal.module';
import { hashLegacyScrypt } from '../../src/features/authentication/services/password.service';

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useValue: { app: { adminUsername: 'browser-admin', adminPassword: 'browser-password' } },
    },
  ],
  exports: [AppConfigService],
})
class BrowserConfigurationModule {}

/** A real browser talks to Next and Nest on loopback; only the disposable database is writable. */
describe('Candidate browser flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let frontend: ChildProcess;
  let baseUrl: string;
  let candidateId: bigint;
  let passwordHash: string;
  let frontendLog = '';
  let frontendRoot: string;

  async function login() {
    await page.goto(`${baseUrl}/candidate/login`);
    await page.getByLabel('Email').fill('browser@example.test');
    await page.getByLabel('Password', { exact: true }).fill('temporary-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
    if (
      process.env.JI_DISPOSABLE_DATABASE !== 'true' ||
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/ji_migration_test' ||
      url.username !== 'ji_test'
    ) {
      throw new Error('Use pnpm test:browser to provision a disposable database.');
    }
    const fixture = await Test.createTestingModule({
      imports: [PrismaModule, BrowserConfigurationModule, CandidatePortalModule],
    }).compile();
    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    const port = await new Promise<number>((resolvePort, reject) => {
      const socket = createServer();
      socket.once('error', reject);
      socket.listen(0, '127.0.0.1', () => {
        const address = socket.address();
        if (!address || typeof address === 'string') return reject(new Error('Missing test port.'));
        socket.close(() => resolvePort(address.port));
      });
    });
    baseUrl = `http://127.0.0.1:${port}`;
    app.enableCors({
      origin: baseUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    passwordHash = await hashLegacyScrypt('temporary-password');
    const candidate = await prisma.candidate.create({
      data: {
        name: 'Browser Candidate',
        email: 'browser@example.test',
        auth: { create: { passwordHash, mustChangePassword: true } },
      },
    });
    candidateId = candidate.id;
    await prisma.company.create({
      data: { id: 'browser-company', name: 'Browser Company', location: 'Dhaka' },
    });
    // Compile a source copy: Next updates tsconfig/next-env and must not touch the developer's files.
    const sourceRoot = resolve(process.cwd(), '../frontend');
    frontendRoot = await mkdtemp(join(tmpdir(), 'job-intelligence-browser-'));
    for (const entry of [
      'app',
      'lib',
      'package.json',
      'postcss.config.mjs',
      'tsconfig.json',
      'next.config.mjs',
    ]) {
      await cp(join(sourceRoot, entry), join(frontendRoot, entry), { recursive: true });
    }
    await symlink(join(sourceRoot, 'node_modules'), join(frontendRoot, 'node_modules'), 'dir');
    frontend = spawn(
      process.execPath,
      [
        resolve(frontendRoot, 'node_modules/next/dist/bin/next'),
        'dev',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      {
        cwd: frontendRoot,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          NEXT_TELEMETRY_DISABLED: '1',
          NEXT_PUBLIC_API_URL: `${await app.getUrl()}/api/v1`,
        },
      },
    );
    frontend.stdout?.on('data', (chunk) => {
      frontendLog = (frontendLog + chunk.toString()).slice(-8000);
    });
    frontend.stderr?.on('data', (chunk) => {
      frontendLog = (frontendLog + chunk.toString()).slice(-8000);
    });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (frontend.exitCode !== null) throw new Error(`Next exited: ${frontendLog}`);
      try {
        if ((await fetch(`${baseUrl}/candidate/login`, { signal: AbortSignal.timeout(3000) })).ok) {
          ready = true;
          break;
        }
      } catch {
        /* Next may still be compiling the initial route. */
      }
      await delay(250);
    }
    if (!ready) throw new Error(`Next did not become ready: ${frontendLog}`);
    browser = await chromium.launch({ headless: true });
  });

  beforeEach(async () => {
    await prisma.candidateAuth.update({
      where: { candidateId },
      data: { passwordHash, mustChangePassword: true },
    });
    await prisma.candidate_company_state.deleteMany({ where: { candidate_id: candidateId } });
    context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(15000);
  });
  afterEach(async () => {
    await context?.close();
  });
  afterAll(async () => {
    await browser?.close();
    if (frontend?.pid && frontend.exitCode === null) {
      const exited = new Promise<void>((done) => frontend.once('exit', () => done()));
      process.kill(-frontend.pid, 'SIGTERM');
      await Promise.race([exited, delay(5000, undefined, { ref: false })]);
      if (frontend.exitCode === null) process.kill(-frontend.pid, 'SIGKILL');
    }
    await app?.close();
    if (frontendRoot) await rm(frontendRoot, { recursive: true, force: true });
  });

  it.each(['profile', 'companies', 'pipeline'])(
    'redirects unsigned direct navigation to %s to login',
    async (route) => {
      await page.goto(`${baseUrl}/candidate/${route}`);
      await page.waitForURL(`${baseUrl}/candidate/login`);
    },
  );

  it.each(['profile', 'companies', 'pipeline'])(
    'redirects required-password direct navigation to %s to password change',
    async (route) => {
      await login();
      await page.waitForURL(`${baseUrl}/candidate/change-password`);
      await page.goto(`${baseUrl}/candidate/${route}`);
      await page.waitForURL(`${baseUrl}/candidate/change-password`);
    },
  );

  it('shows invalid credentials without creating a session', async () => {
    await page.goto(`${baseUrl}/candidate/login`);
    await page.getByLabel('Email').fill('browser@example.test');
    await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('alert').waitFor();
    expect(await context.cookies()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'ji_candidate_session' })]),
    );
  });

  it('changes password, persists profile edits, and creates/updates/removes pipeline state', async () => {
    await login();
    await page.waitForURL(`${baseUrl}/candidate/change-password`);
    await page.getByLabel('New password', { exact: true }).fill('chosen-password');
    await page.getByLabel('Confirm password').fill('chosen-password');
    await page.getByRole('button', { name: 'Save password' }).click();
    await page.waitForURL(`${baseUrl}/candidate`);
    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Browser Updated');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.getByText('Profile saved.', { exact: true }).waitFor();
    expect((await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } })).name).toBe(
      'Browser Updated',
    );
    await page.getByRole('link', { name: 'Companies', exact: true }).click();
    const planned = page.waitForResponse(
      (response) =>
        response.url().endsWith('/candidate/pipeline/company-state') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('combobox').selectOption('PLANNING');
    expect((await planned).ok()).toBe(true);
    await page.getByRole('link', { name: 'Pipeline', exact: true }).click();
    await page.getByRole('heading', { name: 'Browser Company' }).waitFor();
    await page.getByRole('combobox').selectOption('APPLIED');
    await page.getByLabel('Notes').fill('Browser note');
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/candidate/pipeline/company-state') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).ok()).toBe(true);
    const row = await prisma.candidate_company_state.findUniqueOrThrow({
      where: {
        candidate_id_company_id: { candidate_id: candidateId, company_id: 'browser-company' },
      },
    });
    expect(row).toMatchObject({ status: 'APPLIED', notes: 'Browser note' });
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('heading', { name: 'Browser Company' }).waitFor({ state: 'detached' });
    expect(
      await prisma.candidate_company_state.count({ where: { candidate_id: candidateId } }),
    ).toBe(0);
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL(`${baseUrl}/candidate/login`);
    expect((await context.cookies()).some((entry) => entry.name === 'ji_candidate_session')).toBe(
      false,
    );
    await page.goto(`${baseUrl}/candidate/pipeline`);
    await page.waitForURL(`${baseUrl}/candidate/login`);
  });
});
