import 'reflect-metadata';
import { Global, Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaModule, PrismaService } from '@app/database';
import { AppConfigService } from '../../src/config/config.service';
import { AdminOperationsModule } from '../../src/features/admin-operations/admin-operations.module';
import { CompanyIntelligenceModule } from '../../src/features/company-intelligence/company-intelligence.module';
import { JobCrawlingModule } from '../../src/features/job-crawling/job-crawling.module';
import { SettingsModule } from '../../src/features/settings/settings.module';
import { verifyLegacyScrypt } from '../../src/features/authentication/services/password.service';

@Global()
@Module({
  providers: [{ provide: AppConfigService, useValue: { app: { adminUsername: 'admin-test', adminPassword: 'admin-test-password', defaultCandidatePassword: 'default-test-password' } } }],
  exports: [AppConfigService],
})
class TestConfigurationModule {}

const candidateInput = { name: ' Admin Candidate ', email: 'Admin-Candidate@example.test', active: true, minimumMatchScore: 60, preferredCategories: [' NestJS ', 'Logistics', 'NestJS'], excludedCategories: ['Logistics'] };
const settingsInput = { aiEnabled: true, aiProvider: ' test-provider ', aiDailyLimit: 10, aiMatchingEnabled: true, aiSkillExtractionEnabled: false, defaultMatchThreshold: 80, emailEnabled: true, quickSearchDailyLimit: 4, quickSearchAiDailyLimit: 2, quickSearchCompanyLimit: 9 };

describe('Admin APIs with disposable PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const admin = (call: request.Test) => call.auth('admin-test', 'admin-test-password');
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
    if (process.env.JI_DISPOSABLE_DATABASE !== 'true' || url.hostname !== '127.0.0.1' || url.pathname !== '/ji_migration_test' || url.username !== 'ji_test') {
      throw new Error('Run pnpm test:database to provision a disposable local database.');
    }
    const fixture = await Test.createTestingModule({ imports: [PrismaModule, TestConfigurationModule, AdminOperationsModule, CompanyIntelligenceModule, JobCrawlingModule, SettingsModule] }).compile();
    app = fixture.createNestApplication();
    app.useLogger(false); // Expected injected database errors are asserted below.
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.category.upsert({ where: { name: 'Other' }, create: { name: 'Other', type: 'other' }, update: {} });
  });
  beforeEach(async () => {
    await prisma.candidate.deleteMany({ where: { email: { startsWith: 'admin-' } } });
    await prisma.crawlLog.deleteMany();
    await prisma.company.deleteMany({ where: { id: { startsWith: 'admin-' } } });
    await prisma.company.create({ data: { id: 'admin-main', name: 'Admin Alpha', location: 'Dhaka', recommended_action: 'MONITOR_READY', categories: { create: { category: { connect: { name: 'NestJS' } } } } } });
    await prisma.company.create({ data: { id: 'admin-other', name: 'Admin Beta', categories: { create: { category: { connect: { name: 'Other' } } } } } });
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.candidate.deleteMany({ where: { email: { startsWith: 'admin-' } } });
      await prisma.crawlLog.deleteMany();
      await prisma.company.deleteMany({ where: { id: { startsWith: 'admin-' } } });
    }
    await app?.close();
  });

  it.each(['candidates', 'companies', 'categories', 'jobs', 'settings', 'crawl-logs'])('protects admin %s with Basic authentication', async (route) => {
    await api().get(`/api/v1/admin/${route}`).expect(401);
    await api().get(`/api/v1/admin/${route}`).auth('admin-test', 'incorrect').expect(401);
    await admin(api().get(`/api/v1/admin/${route}`)).expect(200);
  });

  it('creates normalized candidates with a hashed default password and no secret exposure', async () => {
    const response = await admin(api().post('/api/v1/admin/candidates')).send(candidateInput).expect(201);
    const id = response.body.id;
    const auth = await prisma.candidateAuth.findUniqueOrThrow({ where: { candidateId: BigInt(id) } });
    expect(auth.mustChangePassword).toBe(true);
    expect(await verifyLegacyScrypt('default-test-password', auth.passwordHash!)).toBe(true);
    const detail = await admin(api().get(`/api/v1/admin/candidates/${id}`)).expect(200);
    expect(detail.body).toMatchObject({ id, name: 'Admin Candidate', email: 'admin-candidate@example.test', hasPassword: true, hasGoogle: false, preferredCategories: 'NestJS', excludedCategories: 'Logistics' });
    expect(JSON.stringify(detail.body)).not.toContain(auth.passwordHash);
    const list = await admin(api().get('/api/v1/admin/candidates')).expect(200);
    expect(JSON.stringify(list.body)).not.toContain(auth.passwordHash);
    expect(list.body).toContainEqual(detail.body);
  });

  it('preserves passwords on profile edits and forces change after explicit reset', async () => {
    const created = await admin(api().post('/api/v1/admin/candidates')).send({ ...candidateInput, newPassword: 'explicit-password' }).expect(201);
    const id = created.body.id;
    const before = await prisma.candidateAuth.update({ where: { candidateId: BigInt(id) }, data: { mustChangePassword: false } });
    await admin(api().put(`/api/v1/admin/candidates/${id}`)).send({ ...candidateInput, name: 'Updated' }).expect(200);
    expect(await prisma.candidateAuth.findUnique({ where: { candidateId: BigInt(id) } })).toMatchObject({ passwordHash: before.passwordHash, mustChangePassword: false });
    await admin(api().put(`/api/v1/admin/candidates/${id}`)).send({ ...candidateInput, newPassword: 'reset-password' }).expect(200);
    const after = await prisma.candidateAuth.findUniqueOrThrow({ where: { candidateId: BigInt(id) } });
    expect(after.mustChangePassword).toBe(true);
    expect(await verifyLegacyScrypt('reset-password', after.passwordHash!)).toBe(true);
  });

  it('rejects duplicate emails on create and update without modifying profiles', async () => {
    const first = await admin(api().post('/api/v1/admin/candidates')).send(candidateInput).expect(201);
    await admin(api().post('/api/v1/admin/candidates')).send({ ...candidateInput, email: candidateInput.email.toUpperCase() }).expect(409);
    const second = await admin(api().post('/api/v1/admin/candidates')).send({ ...candidateInput, email: 'admin-second@example.test' }).expect(201);
    await admin(api().put(`/api/v1/admin/candidates/${second.body.id}`)).send({ ...candidateInput, name: 'Should not persist' }).expect(409);
    expect(await prisma.candidate.count({ where: { id: { in: [BigInt(first.body.id), BigInt(second.body.id)] } } })).toBe(2);
    expect((await prisma.candidate.findUniqueOrThrow({ where: { id: BigInt(second.body.id) } })).name).toBe('Admin Candidate');
  });

  it.each(['abc', '0', '-1', '0x10', '9223372036854775808'])('rejects invalid candidate IDs (%s)', async (id) => {
    await admin(api().get(`/api/v1/admin/candidates/${id}`)).expect(400);
  });

  it('returns 404 for missing candidates and rejects invalid candidate input', async () => {
    await admin(api().get('/api/v1/admin/candidates/9223372036854775807')).expect(404);
    await admin(api().post('/api/v1/admin/candidates')).send({ ...candidateInput, minimumMatchScore: 101 }).expect(400);
    await admin(api().post('/api/v1/admin/candidates')).send({ ...candidateInput, newPassword: 'short' }).expect(400);
    expect(await prisma.candidate.count({ where: { email: 'admin-candidate@example.test' } })).toBe(0);
  });

  it('rolls back candidate creation when authentication persistence fails', async () => {
    await prisma.$executeRaw`ALTER TABLE candidate_auth ADD CONSTRAINT test_reject_password CHECK (password_hash IS NULL) NOT VALID`;
    try {
      await admin(api().post('/api/v1/admin/candidates')).send(candidateInput).expect(500);
      expect(await prisma.candidate.count({ where: { email: 'admin-candidate@example.test' } })).toBe(0);
    } finally { await prisma.$executeRaw`ALTER TABLE candidate_auth DROP CONSTRAINT test_reject_password`; }
  });

  it('rolls back profile edits when password reset persistence fails', async () => {
    const created = await admin(api().post('/api/v1/admin/candidates')).send(candidateInput).expect(201);
    const id = BigInt(created.body.id);
    const auth = await prisma.candidateAuth.findUniqueOrThrow({ where: { candidateId: id } });
    await prisma.$executeRaw`ALTER TABLE candidate_auth ADD CONSTRAINT test_reject_password CHECK (password_hash IS NULL) NOT VALID`;
    try {
      await admin(api().put(`/api/v1/admin/candidates/${id}`)).send({ ...candidateInput, name: 'Should roll back', newPassword: 'reset-password' }).expect(500);
      expect((await prisma.candidate.findUniqueOrThrow({ where: { id } })).name).toBe('Admin Candidate');
      expect((await prisma.candidateAuth.findUniqueOrThrow({ where: { candidateId: id } })).passwordHash).toBe(auth.passwordHash);
    } finally { await prisma.$executeRaw`ALTER TABLE candidate_auth DROP CONSTRAINT test_reject_password`; }
  });

  it('filters company listing and replaces categories with the Other fallback', async () => {
    const list = await admin(api().get('/api/v1/admin/companies?search=admin&category=NestJS&action=MONITOR_READY&pageSize=1')).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.rows[0].id).toBe('admin-main');
    await admin(api().put('/api/v1/admin/companies/admin-main')).send({ name: ' Renamed ', active: false, categories: [] }).expect(200);
    const detail = await admin(api().get('/api/v1/admin/companies/admin-main')).expect(200);
    expect(detail.body).toMatchObject({ name: 'Renamed', active: false, categories: ['Other'] });
  });

  it('rolls back company edits and deleted assignments when category insertion fails', async () => {
    const before = await prisma.company.findUniqueOrThrow({ where: { id: 'admin-main' } });
    await prisma.$executeRaw`ALTER TABLE company_categories ADD CONSTRAINT test_reject_assignment CHECK (company_id <> 'admin-main') NOT VALID`;
    try {
      await admin(api().put('/api/v1/admin/companies/admin-main')).send({ name: 'Should roll back', active: false, categories: ['Other'] }).expect(500);
      expect(await prisma.company.findUnique({ where: { id: 'admin-main' } })).toEqual(before);
      const links = await prisma.companyCategory.findMany({ where: { companyId: 'admin-main' }, include: { category: true } });
      expect(links.map((link) => link.category.name)).toEqual(['NestJS']);
    } finally { await prisma.$executeRaw`ALTER TABLE company_categories DROP CONSTRAINT test_reject_assignment`; }
  });

  it('upserts category types and counts Other-only companies', async () => {
    await admin(api().post('/api/v1/admin/categories')).send({ name: 'Admin Category', type: 'domain' }).expect(201);
    await admin(api().post('/api/v1/admin/categories')).send({ name: 'Admin Category', type: 'sector' }).expect(201);
    const other = await prisma.category.findUniqueOrThrow({ where: { name: 'Other' } });
    await prisma.companyCategory.create({ data: { companyId: 'admin-main', categoryId: other.id } });
    const response = await admin(api().get('/api/v1/admin/categories')).expect(200);
    expect(response.body.find((row: { name: string }) => row.name === 'Admin Category')).toMatchObject({ type: 'sector', companyCount: 0 });
    expect(response.body.find((row: { name: string }) => row.name === 'Other').companyCount).toBe(1);
    await admin(api().post('/api/v1/admin/categories')).send({ name: 'Invalid', type: 'invalid' }).expect(400);
  });

  it('filters jobs and paginates tied discovery times with serialized IDs', async () => {
    const firstSeen = new Date('2026-09-20T00:00:00Z');
    const first = await prisma.job.create({ data: { companyId: 'admin-main', title: 'Admin Engineer', jobHash: 'admin-job-one', first_seen_at: firstSeen, status: 'OPEN' } });
    const second = await prisma.job.create({ data: { companyId: 'admin-main', title: 'Admin Engineer Two', jobHash: 'admin-job-two', first_seen_at: firstSeen, status: 'OPEN' } });
    await prisma.job.create({ data: { companyId: 'admin-main', title: 'Admin Closed', jobHash: 'admin-job-closed', status: 'CLOSED' } });
    const page = await admin(api().get('/api/v1/admin/jobs?search=admin&status=OPEN&pageSize=1')).expect(200);
    expect(page.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(page.body.rows[0]).toMatchObject({ id: second.id.toString(), companyName: 'Admin Alpha', companyCategories: ['NestJS'] });
    const next = await admin(api().get('/api/v1/admin/jobs?search=admin&status=OPEN&pageSize=1&page=2')).expect(200);
    expect(next.body.rows[0].id).toBe(first.id.toString());
    await admin(api().get('/api/v1/admin/jobs?status=INVALID')).expect(400);
    await admin(api().get('/api/v1/admin/jobs?pageSize=101')).expect(400);
  });

  it('excludes unlinked crawl logs and paginates tied timestamps deterministically', async () => {
    const checked = new Date('2026-09-20T00:00:00Z');
    const first = await prisma.crawlLog.create({ data: { company_id: 'admin-main', success: true, jobs_found: 2, checked_at: checked } });
    const second = await prisma.crawlLog.create({ data: { company_id: 'admin-main', success: false, error: 'test timeout', checked_at: checked } });
    await prisma.crawlLog.create({ data: { success: true } });
    const page = await admin(api().get('/api/v1/admin/crawl-logs?pageSize=1')).expect(200);
    expect(page.body.total).toBe(2);
    expect(page.body.rows[0]).toMatchObject({ id: second.id.toString(), companyName: 'Admin Alpha', error: 'test timeout' });
    const next = await admin(api().get('/api/v1/admin/crawl-logs?pageSize=1&page=2')).expect(200);
    expect(next.body.rows[0].id).toBe(first.id.toString());
    await admin(api().get('/api/v1/admin/crawl-logs?page=1.5')).expect(400);
  });

  it('persists only editable settings, trims provider, and validates bounds', async () => {
    await prisma.setting.upsert({ where: { key: 'admin_test_unrelated' }, create: { key: 'admin_test_unrelated', value: 'preserve' }, update: {} });
    await admin(api().put('/api/v1/admin/settings')).send(settingsInput).expect(200);
    const response = await admin(api().get('/api/v1/admin/settings')).expect(200);
    expect(response.body).toEqual({ ...settingsInput, aiProvider: 'test-provider' });
    expect((await prisma.setting.findUniqueOrThrow({ where: { key: 'admin_test_unrelated' } })).value).toBe('preserve');
    await admin(api().put('/api/v1/admin/settings')).send({ ...settingsInput, quickSearchDailyLimit: 21 }).expect(400);
    await admin(api().put('/api/v1/admin/settings')).send({ ...settingsInput, unknown: true }).expect(400);
  });

  it('rolls back all settings when a later setting write fails', async () => {
    await admin(api().put('/api/v1/admin/settings')).send({ ...settingsInput, emailEnabled: false, aiEnabled: false }).expect(200);
    const before = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    await prisma.$executeRaw`ALTER TABLE settings ADD CONSTRAINT test_reject_email CHECK (key <> 'email_enabled' OR value <> 'true') NOT VALID`;
    try {
      await admin(api().put('/api/v1/admin/settings')).send(settingsInput).expect(500);
      expect(await prisma.setting.findMany({ orderBy: { key: 'asc' } })).toEqual(before);
    } finally { await prisma.$executeRaw`ALTER TABLE settings DROP CONSTRAINT test_reject_email`; }
  });
});
