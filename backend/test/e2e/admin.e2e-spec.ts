import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { createTestApp, type TestAppContext } from '../helpers/create-test-app.js';
import { AppConfigService } from '../../src/config/config.service.js';

describe('Admin E2E (AppModule + Supertest + real PostgreSQL)', () => {
  let context: TestAppContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let config: AppConfigService;
  let adminAuthHeader: string;
  let createdCategoryId: bigint;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
    prisma = app.get(PrismaService);
    config = app.get(AppConfigService);

    const { adminUsername, adminPassword } = config.app;
    adminAuthHeader = `Basic ${Buffer.from(`${adminUsername}:${adminPassword}`).toString('base64')}`;
  });

  afterAll(async () => {
    try {
      if (createdCategoryId && prisma) {
        await prisma.category.deleteMany({ where: { id: createdCategoryId } });
      }
    } finally {
      if (app) await app.close();
    }
  });

  it('rejects unauthenticated requests to admin dashboard with HTTP 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/dashboard').expect(401);
  });

  it('rejects requests with invalid Basic Auth credentials with HTTP 401', async () => {
    const badAuth = `Basic ${Buffer.from('admin:wrong-password').toString('base64')}`;
    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', badAuth)
      .expect(401);
  });

  it('strictly rejects candidate session cookies on admin endpoints (candidate/admin separation)', async () => {
    // Synthetic candidate session cookie
    const candidateCookie = 'ji_candidate_session=some-signed-candidate-token-value';

    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Cookie', candidateCookie)
      .expect(401);
  });

  it('authenticates valid admin credentials and returns dashboard metrics with HTTP 200', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', adminAuthHeader)
      .expect(200);

    expect(response.body).toHaveProperty('stats');
    expect(response.body.stats).toHaveProperty('companies');
    expect(response.body.stats).toHaveProperty('jobs');
    expect(response.body.stats).toHaveProperty('candidates');
  });

  it('rejects rogue non-whitelisted properties in admin payloads with HTTP 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', adminAuthHeader)
      .send({
        name: 'Valid Name',
        type: 'technology',
        isSuperUser: true, // Rogue field
        extraField: 123, // Rogue field
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/property isSuperUser should not exist/i),
        expect.stringMatching(/property extraField should not exist/i),
      ]),
    );
  });

  it('creates category with valid DTO payload and returns HTTP 201', async () => {
    const categoryName = `E2E Category ${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', adminAuthHeader)
      .send({ name: categoryName, type: 'technology' })
      .expect(201);

    expect(response.body).toEqual({ ok: true });

    // Verify record in database
    const inDb = await prisma.category.findUnique({
      where: { name: categoryName },
    });
    expect(inDb?.name).toBe(categoryName);
    expect(inDb?.type).toBe('technology');
    if (inDb) createdCategoryId = inDb.id;
    expect(inDb?.name).toBe(categoryName);
  });
});
