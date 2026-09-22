import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { createTestApp, type TestAppContext } from '../helpers/create-test-app.js';
import { hashLegacyScrypt } from '../../src/features/authentication/services/password.service.js';

describe('Candidate E2E (AppModule + Supertest + real PostgreSQL)', () => {
  let context: TestAppContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let candidateId: bigint;
  const email = `e2e-candidate-${Date.now()}@example.test`;
  const initialPassword = 'initial-secret-password-123';
  const newPassword = 'new-secure-password-456';

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
    prisma = app.get(PrismaService);

    // Create a real candidate with auth record in disposable database
    const passwordHash = await hashLegacyScrypt(initialPassword);
    const candidate = await prisma.candidate.create({
      data: {
        name: 'E2E Candidate',
        email,
        active: true,
        auth: {
          create: {
            passwordHash,
            mustChangePassword: true,
          },
        },
      },
      select: { id: true },
    });
    candidateId = candidate.id;
  });

  afterAll(async () => {
    try {
      if (candidateId && prisma) {
        await prisma.candidateAuth.deleteMany({ where: { candidateId } });
        await prisma.candidate.deleteMany({ where: { id: candidateId } });
      }
    } finally {
      if (app) await app.close();
    }
  });

  it('rejects login with invalid password (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/login')
      .send({ email, password: 'wrong-password-999' })
      .expect(401);
  });

  it('authenticates valid credentials, sets session cookie, but blocks profile when password change is required (403)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/login')
      .send({ email, password: initialPassword })
      .expect(201);

    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const sessionCookie = cookies[0].split(';')[0];
    expect(sessionCookie).toContain('ji_candidate_session=');

    // Accessing identity via me works before password change
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/candidate-auth/me')
      .set('Cookie', sessionCookie)
      .expect(200);
    expect(meRes.body.mustChangePassword).toBe(true);
    expect(meRes.body.id).toBeDefined();

    // Accessing protected profile before password change must be forbidden
    const profileRes = await request(app.getHttpServer())
      .get('/api/v1/candidate/profile')
      .set('Cookie', sessionCookie)
      .expect(403);

    expect(profileRes.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('allows candidate to change initial password and unblock profile access', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/login')
      .send({ email, password: initialPassword })
      .expect(201);
    const sessionCookie = loginRes.headers['set-cookie'][0].split(';')[0];

    // Change password via /api/v1/candidate-auth/change-password
    const changeRes = await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/change-password')
      .set('Cookie', sessionCookie)
      .send({ password: newPassword })
      .expect(201);
    expect(changeRes.body).toEqual({ ok: true });

    // Profile should now be accessible (200)
    const profileRes = await request(app.getHttpServer())
      .get('/api/v1/candidate/profile')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(profileRes.body.email).toBe(email);
    expect(profileRes.body.name).toBe('E2E Candidate');
  });

  it('enforces DTO validation: rejects unknown non-whitelisted properties with HTTP 400', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/login')
      .send({ email, password: newPassword })
      .expect(201);
    const sessionCookie = loginRes.headers['set-cookie'][0].split(';')[0];

    // Attempting to pass rogue properties like candidateId or isAdmin must fail validation
    const response = await request(app.getHttpServer())
      .put('/api/v1/candidate/profile')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Attacker Name',
        minimumMatchScore: 70,
        candidateId: 9999, // Unknown property
        isAdmin: true, // Unknown property
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/property candidateId should not exist/i),
        expect.stringMatching(/property isAdmin should not exist/i),
      ]),
    );
  });

  it('updates profile using session-derived identity, ignoring external tampering', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/candidate-auth/login')
      .send({ email, password: newPassword })
      .expect(201);
    const sessionCookie = loginRes.headers['set-cookie'][0].split(';')[0];

    const updateRes = await request(app.getHttpServer())
      .put('/api/v1/candidate/profile')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Alice E2E Updated',
        skills: 'TypeScript, NestJS, Docker',
        experienceLevel: 'Senior',
        experienceYears: 6,
        minimumMatchScore: 75,
      })
      .expect(200);
    expect(updateRes.body).toEqual({ ok: true });

    // Confirm database update
    const updated = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    expect(updated?.name).toBe('Alice E2E Updated');
    expect(updated?.skills).toBe('TypeScript, NestJS, Docker');
    expect(updated?.experience_years).toBe(6);
    expect(updated?.minimum_match_score).toBe(75);
  });
});
