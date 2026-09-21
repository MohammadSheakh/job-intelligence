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
import { CompanyIntelligenceModule } from '../../src/features/company-intelligence/company-intelligence.module';
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
describe('Candidate and Company Intelligence browser flows', () => {
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
      imports: [
        PrismaModule,
        BrowserConfigurationModule,
        CandidatePortalModule,
        CompanyIntelligenceModule,
      ],
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

  describe('Company Intelligence admin', () => {
    beforeEach(async () => {
      await prisma.company.deleteMany({ where: { id: { startsWith: 'admin-ui-' } } });
      await prisma.category.upsert({
        where: { name: 'Other' },
        create: { name: 'Other', type: 'other' },
        update: {},
      });
      await prisma.company.create({
        data: {
          id: 'admin-ui-main',
          name: 'Admin Alpha',
          location: 'Dhaka',
          recommended_action: 'MONITOR_READY',
          categories: { create: { category: { connect: { name: 'NestJS' } } } },
        },
      });
      await prisma.company.createMany({
        data: Array.from({ length: 26 }, (_, index) => ({
          id: `admin-ui-${index}`,
          name: `Admin Fixture ${String(index).padStart(2, '0')}`,
        })),
      });
    });

    async function adminLogin() {
      await page.getByLabel('Username', { exact: true }).fill('browser-admin');
      await page.getByLabel('Password', { exact: true }).fill('browser-password');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
    }

    it('rejects wrong credentials, keeps credentials out of storage, and signs out', async () => {
      await page.goto(`${baseUrl}/admin/companies`);
      await page.getByLabel('Username').fill('browser-admin');
      await page.getByLabel('Password').fill('incorrect');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('alert').waitFor();
      await adminLogin();
      await page.getByRole('link', { name: 'Admin Alpha', exact: true }).waitFor();
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([
        0, 0,
      ]);
      await page.reload();
      await page.getByRole('heading', { name: 'Admin sign in' }).waitFor();
      await adminLogin();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('heading', { name: 'Admin sign in' }).waitFor();
    });

    it('does not treat a candidate session as administrator authorization', async () => {
      await login();
      await page.waitForURL(`${baseUrl}/candidate/change-password`);
      await page.goto(`${baseUrl}/admin/categories`);
      await page.getByRole('heading', { name: 'Admin sign in' }).waitFor();
      expect(await page.getByRole('button', { name: 'Save category' }).count()).toBe(0);
    });

    it('paginates companies, applies filters, and shows an empty state', async () => {
      await page.goto(`${baseUrl}/admin/companies`);
      await adminLogin();
      await page.getByText('28 companies · Page 1 of 2').waitFor();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByText('28 companies · Page 2 of 2').waitFor();
      await page.getByLabel('Search companies').fill('Alpha');
      await page.getByLabel('Category', { exact: true }).selectOption('NestJS');
      await page.getByLabel('Research action').selectOption('MONITOR_READY');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.getByText('1 company · Page 1 of 1').waitFor();
      await page.getByRole('link', { name: 'Admin Alpha' }).waitFor();
      await page.getByLabel('Search companies').fill('no-such-company');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.getByText('No companies match these filters.').waitFor();
    });

    it('saves company research and category replacement, including clearing optional fields', async () => {
      await page.goto(`${baseUrl}/admin/companies/admin-ui-main`);
      await adminLogin();
      await page.getByLabel('Company name').fill('Admin Updated');
      await page.getByLabel('Contact email').fill('contact@example.test');
      await page.getByLabel('Career page', { exact: true }).fill('https://example.test/careers');
      await page.getByLabel('Research action').selectOption('NO_HIRING_PAGE_FOUND');
      await page.getByLabel('Notes', { exact: true }).fill('Needs a hiring page');
      await page.getByLabel('Active company').uncheck();
      await page.getByRole('checkbox', { name: 'NestJS', exact: true }).uncheck();
      await page.getByRole('checkbox', { name: 'Logistics', exact: true }).check();
      await page.getByRole('button', { name: 'Save company' }).click();
      await page.getByText('Company saved.', { exact: true }).waitFor();
      let company = await prisma.company.findUniqueOrThrow({
        where: { id: 'admin-ui-main' },
        include: { categories: { include: { category: true } } },
      });
      expect(company).toMatchObject({
        name: 'Admin Updated',
        active: false,
        email: 'contact@example.test',
        recommended_action: 'NO_HIRING_PAGE_FOUND',
        notes: 'Needs a hiring page',
      });
      expect(company.categories.map((entry) => entry.category.name)).toEqual(['Logistics']);
      await page.getByLabel('Contact email').fill('');
      await page.getByRole('checkbox', { name: 'Logistics', exact: true }).uncheck();
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith('/admin/companies/admin-ui-main') &&
          response.request().method() === 'PUT',
      );
      await page.getByRole('button', { name: 'Save company' }).click();
      expect((await saved).ok()).toBe(true);
      await page.getByText('Company saved.', { exact: true }).waitFor();
      company = await prisma.company.findUniqueOrThrow({
        where: { id: 'admin-ui-main' },
        include: { categories: { include: { category: true } } },
      });
      expect(company.email).toBeNull();
      expect(company.categories.map((entry) => entry.category.name)).toEqual(['Other']);
    });

    it('creates a category and updates its type without creating another record', async () => {
      await page.goto(`${baseUrl}/admin/categories`);
      await adminLogin();
      await page.getByLabel('Category name').fill('Browser category');
      await page.getByLabel('Category type').selectOption('technology');
      await page.getByRole('button', { name: 'Save category' }).click();
      await page.getByText('Category saved.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Edit Browser category', exact: true }).click();
      await page.getByLabel('Category type').selectOption('domain');
      await page.getByRole('button', { name: 'Save category' }).click();
      await page.getByText('Category saved.', { exact: true }).waitFor();
      expect(await prisma.category.count({ where: { name: 'Browser category' } })).toBe(1);
      expect(
        (await prisma.category.findUniqueOrThrow({ where: { name: 'Browser category' } })).type,
      ).toBe('domain');
    });

    it('shows missing-company errors and recovers from transient catalog failures', async () => {
      await page.goto(`${baseUrl}/admin/companies/missing`);
      await adminLogin();
      await page.getByRole('alert').filter({ hasText: 'Company was not found.' }).waitFor();
      await page.route('**/api/v1/admin/companies?*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Temporary catalog failure' }),
        }),
      );
      await page.getByRole('link', { name: 'Companies', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Temporary catalog failure' }).waitFor();
      await page.unroute('**/api/v1/admin/companies?*');
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByRole('link', { name: 'Admin Alpha' }).waitFor();
    });

    it('returns to sign-in when an admin request is rejected', async () => {
      await page.goto(`${baseUrl}/admin/companies`);
      await adminLogin();
      await page.route('**/api/v1/admin/categories', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Administrator authentication is required.' }),
        }),
      );
      await page.getByRole('link', { name: 'Categories', exact: true }).click();
      await page.getByRole('heading', { name: 'Admin sign in' }).waitFor();
    });

    it('keeps the admin list usable at a narrow viewport', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${baseUrl}/admin/companies`);
      await adminLogin();
      await page.getByRole('link', { name: 'Admin Alpha' }).waitFor();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({ path: '/tmp/job-admin-companies-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: '/tmp/job-admin-companies.png', fullPage: true });
    });
  });
});
