import 'reflect-metadata';
import { Global, Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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
      useValue: { app: { adminUsername: 'test-admin', adminPassword: 'test-password' } },
    },
  ],
  exports: [AppConfigService],
})
class TestConfigurationModule {}

describe('Candidate portal with disposable PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let firstId: bigint;
  let secondId: bigint;
  let cookie: string;
  let secondCookie: string;

  async function login(email: string, password = 'initial-password') {
    const response = await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/login')
      .send({ email, password })
      .expect(201);
    return response.headers['set-cookie'][0].split(';')[0];
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
    if (
      process.env.JI_DISPOSABLE_DATABASE !== 'true' ||
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/ji_migration_test' ||
      url.username !== 'ji_test'
    ) {
      throw new Error('Run pnpm test:database to provision a disposable local database.');
    }
    const fixture = await Test.createTestingModule({
      imports: [
        PrismaModule,
        TestConfigurationModule,
        CandidatePortalModule,
        CompanyIntelligenceModule,
      ],
    }).compile();
    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hashLegacyScrypt('initial-password');
    const first = await prisma.candidate.create({
      data: {
        name: 'First',
        email: 'first@example.test',
        auth: { create: { passwordHash, mustChangePassword: false } },
      },
    });
    const second = await prisma.candidate.create({
      data: {
        name: 'Second',
        email: 'second@example.test',
        auth: { create: { passwordHash, mustChangePassword: false } },
      },
    });
    firstId = first.id;
    secondId = second.id;
    await prisma.category.createMany({
      skipDuplicates: true,
      data: [
        { name: 'TypeScript', type: 'technology' },
        { name: 'Other', type: 'other' },
      ],
    });
    await prisma.company.create({
      data: {
        id: 'alpha',
        name: 'Alpha',
        location: 'Dhaka',
        categories: {
          create: [
            { category: { connect: { name: 'TypeScript' } } },
            { category: { connect: { name: 'Other' } } },
          ],
        },
      },
    });
    await prisma.company.create({ data: { id: 'beta', name: 'Beta', active: false } });
    cookie = await login(first.email);
    secondCookie = await login(second.email);
  });
  beforeEach(async () => {
    await prisma.candidateAuth.update({
      where: { candidateId: firstId },
      data: { mustChangePassword: false },
    });
    await prisma.candidate_company_state.deleteMany();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('persists normalized profile preferences without changing another candidate', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/candidate/profile')
      .set('Cookie', cookie)
      .send({
        name: ' First   Candidate ',
        minimumMatchScore: 80,
        preferredCategories: ['TypeScript', 'Logistics', 'Other'],
        excludedCategories: ['Logistics'],
      })
      .expect(200);
    const own = await request(app.getHttpServer())
      .get('/api/v1/candidate/profile')
      .set('Cookie', cookie)
      .expect(200);
    expect(own.body).toMatchObject({
      name: 'First Candidate',
      email: 'first@example.test',
      minimum_match_score: 80,
      preferred_categories: 'TypeScript',
      excluded_categories: 'Logistics',
    });
    const other = await prisma.candidate.findUniqueOrThrow({ where: { id: secondId } });
    expect(other.name).toBe('Second');
    expect(other.minimum_match_score).toBe(70);
  });

  it('filters active companies by search/category and returns only the current candidate tracking', async () => {
    await prisma.candidate_company_state.create({
      data: { candidate_id: secondId, company_id: 'alpha', status: 'EXCLUDED', notes: 'private' },
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/candidate/companies?q=dhaka&category=TypeScript&limit=1')
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: 'alpha',
      categories: ['TypeScript'],
      trackingStatus: null,
      notes: null,
    });
    await request(app.getHttpServer())
      .get('/api/v1/candidate/companies?q=beta')
      .set('Cookie', cookie)
      .expect(200, []);
    const other = await request(app.getHttpServer())
      .get('/api/v1/candidate/companies')
      .set('Cookie', secondCookie)
      .expect(200);
    expect(other.body[0]).toMatchObject({ trackingStatus: 'EXCLUDED', notes: 'private' });
  });

  it('returns the category catalog without the Other placeholder', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/candidate/categories')
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toContainEqual({ name: 'TypeScript', type: 'technology' });
    expect(response.body.some((category: { name: string }) => category.name === 'Other')).toBe(
      false,
    );
  });

  it('creates, updates, filters, and removes pipeline state without affecting another candidate', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', secondCookie)
      .send({ companyId: 'alpha', status: 'EXCLUDED' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', cookie)
      .send({ companyId: 'alpha', status: 'PLANNING', notes: ' Research ' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', cookie)
      .send({
        companyId: 'alpha',
        status: 'APPLIED',
        lastAppliedAt: '2026-09-20',
        reapplyCount: 2,
        notes: ' Sent ',
      })
      .expect(201);
    const response = await request(app.getHttpServer())
      .get('/api/v1/candidate/pipeline?status=APPLIED')
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toEqual([
      {
        companyId: 'alpha',
        companyName: 'Alpha',
        status: 'APPLIED',
        lastAppliedAt: '2026-09-20',
        reapplyCount: 2,
        notes: 'Sent',
        categories: ['TypeScript'],
      },
    ]);
    await request(app.getHttpServer())
      .get('/api/v1/candidate/pipeline?status=PLANNING')
      .set('Cookie', cookie)
      .expect(200, []);
    await request(app.getHttpServer())
      .delete('/api/v1/candidate/pipeline/alpha')
      .set('Cookie', cookie)
      .expect(200);
    expect(await prisma.candidate_company_state.count({ where: { candidate_id: firstId } })).toBe(
      0,
    );
    expect(await prisma.candidate_company_state.count({ where: { candidate_id: secondId } })).toBe(
      1,
    );
  });

  it('clears notes and updates the timestamp when a pipeline entry is edited', async () => {
    const old = new Date('2020-01-01T00:00:00Z');
    await prisma.candidate_company_state.create({
      data: {
        candidate_id: firstId,
        company_id: 'alpha',
        status: 'PLANNING',
        notes: 'remove this',
        updated_at: old,
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', cookie)
      .send({ companyId: 'alpha', status: 'PLANNING', notes: ' ' })
      .expect(201);
    const row = await prisma.candidate_company_state.findUniqueOrThrow({
      where: { candidate_id_company_id: { candidate_id: firstId, company_id: 'alpha' } },
    });
    expect(row.notes).toBeNull();
    expect(row.updated_at.getTime()).toBeGreaterThan(old.getTime());
  });

  it('defaults an Applied date and reapply count like the legacy pipeline', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', cookie)
      .send({ companyId: 'alpha', status: 'APPLIED' })
      .expect(201);
    const row = await prisma.candidate_company_state.findUniqueOrThrow({
      where: { candidate_id_company_id: { candidate_id: firstId, company_id: 'alpha' } },
    });
    expect(row.last_applied_at?.toISOString().slice(0, 10)).toBe(
      new Date().toISOString().slice(0, 10),
    );
    expect(row.reapply_count).toBe(0);
  });

  it.each(['profile', 'companies', 'categories', 'pipeline'])(
    'requires password change before accessing %s',
    async (route) => {
      await prisma.candidateAuth.update({
        where: { candidateId: firstId },
        data: { mustChangePassword: true },
      });
      await request(app.getHttpServer())
        .get(`/api/v1/candidate/${route}`)
        .set('Cookie', cookie)
        .expect(403);
      const me = await request(app.getHttpServer())
        .get('/api/v1/candidate-auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(me.body.mustChangePassword).toBe(true);
    },
  );

  it.each(['profile', 'pipeline/company-state', 'pipeline/alpha'])(
    'blocks portal writes before password change (%s)',
    async (route) => {
      await prisma.candidateAuth.update({
        where: { candidateId: firstId },
        data: { mustChangePassword: true },
      });
      const server = request(app.getHttpServer());
      const call =
        route === 'profile'
          ? server.put(`/api/v1/candidate/${route}`)
          : route === 'pipeline/alpha'
            ? server.delete(`/api/v1/candidate/${route}`)
            : server.post(`/api/v1/candidate/${route}`);
      const response = await call
        .set('Cookie', cookie)
        .send({ companyId: 'alpha', status: 'PLANNING' })
        .expect(403);
      expect(response.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      expect(await prisma.candidate_company_state.count()).toBe(0);
    },
  );

  it('allows logout while a password change is required', async () => {
    await prisma.candidateAuth.update({
      where: { candidateId: firstId },
      data: { mustChangePassword: true },
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/logout')
      .set('Cookie', cookie)
      .expect(201);
    expect(response.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('preserves the application date when planning and resets omitted count/notes like legacy', async () => {
    await prisma.candidate_company_state.create({
      data: {
        candidate_id: firstId,
        company_id: 'alpha',
        status: 'APPLIED',
        last_applied_at: new Date('2026-09-01'),
        reapply_count: 3,
        notes: 'old',
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', cookie)
      .send({ companyId: 'alpha', status: 'PLANNING' })
      .expect(201);
    const row = await prisma.candidate_company_state.findUniqueOrThrow({
      where: { candidate_id_company_id: { candidate_id: firstId, company_id: 'alpha' } },
    });
    expect(row.last_applied_at?.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(row.reapply_count).toBe(0);
    expect(row.notes).toBeNull();
  });

  it('allows password change and restores portal access with the existing session', async () => {
    await prisma.candidateAuth.update({
      where: { candidateId: firstId },
      data: { mustChangePassword: true },
    });
    await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/change-password')
      .set('Cookie', cookie)
      .send({ password: 'replacement-password' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/candidate/profile')
      .set('Cookie', cookie)
      .expect(200);
    await login('first@example.test', 'replacement-password');
    await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/login')
      .send({ email: 'first@example.test', password: 'initial-password' })
      .expect(401);
  });

  it.each(['0', '101', '1.5', 'NaN'])('rejects invalid company limits (%s)', async (limit) => {
    await request(app.getHttpServer())
      .get(`/api/v1/candidate/companies?limit=${limit}`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('rejects unknown companies, invalid state, and foreign candidate IDs', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', cookie)
      .send({ companyId: 'missing', status: 'APPLIED' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', cookie)
      .send({ companyId: 'alpha', status: 'INVALID' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/candidate/pipeline/company-state')
      .set('Cookie', cookie)
      .send({ companyId: 'alpha', status: 'APPLIED', candidateId: secondId.toString() })
      .expect(400);
    expect(await prisma.candidate_company_state.count()).toBe(0);
  });
});
