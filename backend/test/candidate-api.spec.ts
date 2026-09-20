import 'reflect-metadata';
import { Global, Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { AppConfigService } from '../src/config/config.service';
import { AuthenticationModule } from '../src/features/authentication/authentication.module';
import { CandidatePortalModule } from '../src/features/candidate-portal/candidate-portal.module';
import { CompanyIntelligenceModule } from '../src/features/company-intelligence/company-intelligence.module';
import { hashLegacyScrypt, verifyLegacyScrypt } from '../src/features/authentication/services/password.service';

const prisma = {
  candidate: { findFirst: jest.fn(), updateMany: jest.fn() },
  candidateAuth: { upsert: jest.fn() },
  category: { findMany: jest.fn() },
  company: { count: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
};

// Replace the database at the DI boundary; never load .env or instantiate Prisma.
@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: prisma },
    { provide: AppConfigService, useValue: { app: { adminUsername: 'test-admin', adminPassword: 'test-admin-password' } } },
  ],
  exports: [PrismaService, AppConfigService],
})
class TestInfrastructureModule {}

describe('Candidate and admin HTTP integration (mock database)', () => {
  let app: INestApplication;
  let passwordHash: string;
  const originalSecret = process.env.CANDIDATE_SESSION_SECRET;
  const cookieSecure = process.env.COOKIE_SECURE;
  const candidate = { id: 42n, name: 'Candidate', email: 'candidate@example.test', auth: { passwordHash: '', mustChangePassword: true } };

  beforeAll(async () => {
    process.env.CANDIDATE_SESSION_SECRET = 'isolated-test-session-secret-at-least-32-characters';
    process.env.COOKIE_SECURE = 'false';
    passwordHash = await hashLegacyScrypt('initial-password');
    const fixture = await Test.createTestingModule({
      imports: [TestInfrastructureModule, AuthenticationModule, CandidatePortalModule, CompanyIntelligenceModule],
    }).compile();
    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    candidate.auth = { passwordHash, mustChangePassword: true };
    prisma.candidate.findFirst.mockImplementation(async ({ select }) => select
      ? { name: candidate.name, email: candidate.email, minimum_match_score: 60 }
      : candidate);
    prisma.candidate.updateMany.mockResolvedValue({ count: 1 });
    prisma.category.findMany.mockResolvedValue([{ name: 'TypeScript' }, { name: 'Finance' }]);
    prisma.candidateAuth.upsert.mockImplementation(async ({ update }) => { candidate.auth = update; });
  });
  afterAll(async () => {
    await app?.close();
    if (originalSecret === undefined) delete process.env.CANDIDATE_SESSION_SECRET;
    else process.env.CANDIDATE_SESSION_SECRET = originalSecret;
    if (cookieSecure === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = cookieSecure;
  });

  async function login() {
    const response = await request(app.getHttpServer()).post('/api/v1/candidate-auth/login')
      .send({ email: candidate.email, password: 'initial-password' }).expect(201);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    return { response, cookie: cookies[0].split(';')[0], fullCookie: cookies[0] };
  }

  it('logs in, reads identity, changes the initial password, and clears the cookie', async () => {
    const { response, cookie, fullCookie } = await login();
    expect(response.body.mustChangePassword).toBe(true);
    expect(fullCookie).toContain('HttpOnly');
    expect(fullCookie).toContain('SameSite=Lax');
    await request(app.getHttpServer()).get('/api/v1/candidate-auth/me').set('Cookie', cookie)
      .expect(200, { id: '42', name: candidate.name, email: candidate.email, mustChangePassword: true });
    await request(app.getHttpServer()).post('/api/v1/candidate-auth/change-password').set('Cookie', cookie)
      .send({ password: 'replacement-password' }).expect(201, { ok: true });
    expect(await verifyLegacyScrypt('replacement-password', candidate.auth.passwordHash)).toBe(true);
    expect(candidate.auth.mustChangePassword).toBe(false);
    const logout = await request(app.getHttpServer()).post('/api/v1/candidate-auth/logout').set('Cookie', cookie).expect(201);
    expect(logout.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('rejects invalid credentials and invalid login input', async () => {
    await request(app.getHttpServer()).post('/api/v1/candidate-auth/login')
      .send({ email: candidate.email, password: 'wrong-password' }).expect(401);
    prisma.candidate.findFirst.mockClear();
    await request(app.getHttpServer()).post('/api/v1/candidate-auth/login')
      .send({ email: 'not-an-email', password: 'password' }).expect(400);
    expect(prisma.candidate.findFirst).not.toHaveBeenCalled();
  });

  it.each([undefined, 'ji_candidate_session=invalid', 'ji_candidate_session=%E0%A4%A'])(
    'rejects missing or malformed session cookies (%s)', async (cookie) => {
      const call = request(app.getHttpServer()).get('/api/v1/candidate/profile');
      if (cookie) call.set('Cookie', cookie);
      await call.expect(401);
      expect(prisma.candidate.findFirst).not.toHaveBeenCalled();
    },
  );

  it('rejects a session when the candidate is no longer active', async () => {
    const { cookie } = await login();
    prisma.candidate.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/api/v1/candidate/profile').set('Cookie', cookie).expect(401);
    expect(prisma.candidate.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 42n, active: true } }));
  });

  it('scopes profile access to the session and normalizes preferences with exclusions winning', async () => {
    candidate.auth.mustChangePassword = false;
    const { cookie } = await login();
    await request(app.getHttpServer()).get('/api/v1/candidate/profile').set('Cookie', cookie)
      .expect(200, { name: candidate.name, email: candidate.email, minimum_match_score: 60 });
    await request(app.getHttpServer()).put('/api/v1/candidate/profile').set('Cookie', cookie).send({
      name: '  Example   Candidate ', minimumMatchScore: 70,
      preferredCategories: ['TypeScript', 'Finance', 'Unknown', 'TypeScript'],
      excludedCategories: ['Finance'], preferredWorkModes: ['Remote', 'Remote'],
    }).expect(200, { ok: true });
    expect(prisma.candidate.updateMany).toHaveBeenCalledWith({ where: { id: 42n, active: true }, data: expect.objectContaining({
      name: 'Example Candidate', minimum_match_score: 70, preferred_categories: 'TypeScript', excluded_categories: 'Finance', preferred_work_modes: 'Remote',
    }) });
  });

  it.each([{ email: 'other@example.test' }, { candidateId: '99' }, { minimumMatchScore: 101 }])(
    'rejects profile identity changes and invalid score: %j', async (invalid) => {
      candidate.auth.mustChangePassword = false;
      const { cookie } = await login();
      await request(app.getHttpServer()).put('/api/v1/candidate/profile').set('Cookie', cookie)
        .send({ name: 'Candidate', minimumMatchScore: 60, ...invalid }).expect(400);
      expect(prisma.candidate.updateMany).not.toHaveBeenCalled();
    },
  );

  it('requires admin credentials independently of the candidate session', async () => {
    const { cookie } = await login();
    await request(app.getHttpServer()).get('/api/v1/admin/companies').set('Cookie', cookie).expect(401);
    await request(app.getHttpServer()).get('/api/v1/admin/companies').auth('test-admin', 'wrong').expect(401);
    expect(prisma.company.findMany).not.toHaveBeenCalled();
    prisma.company.count.mockResolvedValue(0);
    prisma.company.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (queries) => Promise.all(queries));
    await request(app.getHttpServer()).get('/api/v1/admin/companies').auth('test-admin', 'test-admin-password').expect(200);
    await request(app.getHttpServer()).get('/api/v1/admin/companies?pageSize=10000').auth('test-admin', 'test-admin-password').expect(400);
  });
});
