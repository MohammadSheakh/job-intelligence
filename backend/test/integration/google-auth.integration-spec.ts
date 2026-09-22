import 'reflect-metadata';
import { Global, Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { AppConfigService } from '../../src/config/config.service';
import { AuthenticationModule } from '../../src/features/authentication/authentication.module';
import { GoogleOAuthService } from '../../src/features/authentication/services/google-oauth.service';
import { CandidateAuthenticationService } from '../../src/features/authentication/services/candidate-authentication.service';

const prisma = {
  candidate: { findFirst: jest.fn(), updateMany: jest.fn() },
  candidateAuth: { findUnique: jest.fn(), upsert: jest.fn() },
  $transaction: jest.fn(),
};

@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: prisma },
    {
      provide: AppConfigService,
      useValue: { app: { adminUsername: 'test-admin', adminPassword: 'test-admin-password' } },
    },
  ],
  exports: [PrismaService, AppConfigService],
})
class TestInfrastructureModule {}

describe('Google OAuth Service and Integration', () => {
  let app: INestApplication;
  let googleService: GoogleOAuthService;
  let candidateAuthService: CandidateAuthenticationService;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.CANDIDATE_SESSION_SECRET = 'isolated-test-session-secret-at-least-32-characters';
    process.env.COOKIE_SECURE = 'false';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:4000/api/v1/candidate-auth/google/callback';
    process.env.FRONTEND_ORIGIN = 'http://localhost:3000';

    const fixture = await Test.createTestingModule({
      imports: [TestInfrastructureModule, AuthenticationModule],
    }).compile();

    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    googleService = app.get(GoogleOAuthService);
    candidateAuthService = app.get(CandidateAuthenticationService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    process.env = originalEnv;
  });

  describe('GoogleOAuthService unit tests', () => {
    it('reports enabled when all three environment variables are configured', () => {
      expect(googleService.isEnabled()).toBe(true);
      expect(googleService.getConfig()).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:4000/api/v1/candidate-auth/google/callback',
      });
    });

    it('reports disabled when environment variables are missing', () => {
      const emptyService = new GoogleOAuthService();
      const saved = process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;
      expect(emptyService.isEnabled()).toBe(false);
      expect(emptyService.getConfig()).toBeNull();
      process.env.GOOGLE_CLIENT_ID = saved;
    });

    it('generates a valid authorization URL containing expected OAuth parameters', () => {
      const authUrl = googleService.getAuthorizationUrl('random-state-123');
      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('state=random-state-123');
      expect(authUrl).toContain('prompt=select_account');
      expect(authUrl).toContain('scope=openid+email+profile');
    });

    it('exchanges code for user profile successfully', async () => {
      const mockFetch = jest.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'fake-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'google-sub-123',
            email: 'user@example.test',
            email_verified: true,
            name: 'Test User',
          }),
        });

      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        const profile = await googleService.exchangeCode('valid-code');
        expect(profile).toEqual({
          sub: 'google-sub-123',
          email: 'user@example.test',
          emailVerified: true,
          name: 'Test User',
        });
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('throws when email is not verified by Google', async () => {
      const mockFetch = jest.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'fake-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'google-sub-123',
            email: 'unverified@example.test',
            email_verified: false,
          }),
        });

      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        await expect(googleService.exchangeCode('unverified-code')).rejects.toThrow(
          'Google email is not verified',
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('throws when token exchange endpoint returns an error', async () => {
      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        await expect(googleService.exchangeCode('bad-code')).rejects.toThrow(
          'Google token exchange failed (400).',
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('findOrBindGoogleCandidate unit tests', () => {
    it('returns existing candidate when google_sub matches directly', async () => {
      const candidateRecord = {
        id: 101n,
        email: 'candidate@example.test',
        name: 'Candidate One',
        active: true,
      };
      prisma.candidateAuth.findUnique.mockResolvedValueOnce({
        candidate: candidateRecord,
        mustChangePassword: false,
      });

      const result = await candidateAuthService.findOrBindGoogleCandidate({
        sub: 'google-sub-101',
        email: 'candidate@example.test',
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(101n);
      expect(result!.email).toBe('candidate@example.test');
      expect(prisma.candidateAuth.upsert).not.toHaveBeenCalled();
    });

    it('returns null for inactive candidate even if google_sub matches', async () => {
      const candidateRecord = {
        id: 101n,
        email: 'candidate@example.test',
        name: 'Candidate One',
        active: false,
      };
      prisma.candidateAuth.findUnique.mockResolvedValueOnce({
        candidate: candidateRecord,
        mustChangePassword: false,
      });

      const result = await candidateAuthService.findOrBindGoogleCandidate({
        sub: 'google-sub-inactive',
        email: 'inactive@example.test',
      });

      expect(result).toBeNull();
    });

    it('binds candidate when matching email exists without google_sub', async () => {
      prisma.candidateAuth.findUnique.mockResolvedValueOnce(null);
      const candidateByEmail = {
        id: 102n,
        email: 'candidate2@example.test',
        name: 'Candidate Two',
        active: true,
        auth: null,
      };
      prisma.candidate.findFirst.mockResolvedValueOnce(candidateByEmail);
      prisma.candidateAuth.upsert.mockResolvedValueOnce({
        mustChangePassword: false,
      });

      const result = await candidateAuthService.findOrBindGoogleCandidate({
        sub: 'google-sub-102',
        email: 'candidate2@example.test',
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(102n);
      expect(prisma.candidateAuth.upsert).toHaveBeenCalledWith({
        where: { candidateId: 102n },
        create: {
          candidateId: 102n,
          google_sub: 'google-sub-102',
          google_email: 'candidate2@example.test',
          mustChangePassword: false,
        },
        update: {
          google_sub: 'google-sub-102',
          google_email: 'candidate2@example.test',
          updated_at: expect.any(Date),
        },
      });
    });

    it('returns null when email exists but already bound to a different google_sub', async () => {
      prisma.candidateAuth.findUnique.mockResolvedValueOnce(null);
      const candidateByEmail = {
        id: 103n,
        email: 'candidate3@example.test',
        name: 'Candidate Three',
        active: true,
        auth: { google_sub: 'already-bound-sub' },
      };
      prisma.candidate.findFirst.mockResolvedValueOnce(candidateByEmail);

      const result = await candidateAuthService.findOrBindGoogleCandidate({
        sub: 'attacker-sub',
        email: 'candidate3@example.test',
      });

      expect(result).toBeNull();
    });

    it('returns null when no candidate account exists with the given email', async () => {
      prisma.candidateAuth.findUnique.mockResolvedValueOnce(null);
      prisma.candidate.findFirst.mockResolvedValueOnce(null);

      const result = await candidateAuthService.findOrBindGoogleCandidate({
        sub: 'google-sub-unknown',
        email: 'unknown@example.test',
      });

      expect(result).toBeNull();
    });
  });

  describe('HTTP Controller OAuth endpoints', () => {
    it('GET /api/v1/candidate-auth/google/status returns enabled: true', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/candidate-auth/google/status')
        .expect(200);

      expect(res.body).toEqual({ enabled: true });
    });

    it('GET /api/v1/candidate-auth/google/start sets state cookie and redirects to Google', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/candidate-auth/google/start')
        .expect(302);

      expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('ji_google_state='))).toBe(true);
      expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    });

    it('GET /api/v1/candidate-auth/google/callback redirects with error when state is missing or mismatched', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/candidate-auth/google/callback?code=some-code&state=bad-state')
        .set('Cookie', 'ji_google_state=expected-state')
        .expect(302);

      expect(res.headers.location).toBe(
        'http://localhost:3000/candidate/login?error=Invalid%20OAuth%20state',
      );
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.includes('ji_google_state=;'))).toBe(true);
    });

    it('GET /api/v1/candidate-auth/google/callback handles OAuth error param from Google', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/candidate-auth/google/callback?error=access_denied&state=my-state')
        .set('Cookie', 'ji_google_state=my-state')
        .expect(302);

      expect(res.headers.location).toBe(
        'http://localhost:3000/candidate/login?error=access_denied',
      );
    });

    it('GET /api/v1/candidate-auth/google/callback handles missing code', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/candidate-auth/google/callback?state=my-state')
        .set('Cookie', 'ji_google_state=my-state')
        .expect(302);

      expect(res.headers.location).toBe(
        'http://localhost:3000/candidate/login?error=Missing%20authorization%20code',
      );
    });

    it('GET /api/v1/candidate-auth/google/callback successfully logs in and sets session cookie', async () => {
      const state = 'oauth-state-xyz';
      jest.spyOn(googleService, 'exchangeCode').mockResolvedValueOnce({
        sub: 'google-sub-success',
        email: 'success@example.test',
        emailVerified: true,
        name: 'Success Candidate',
      });

      prisma.candidateAuth.findUnique.mockResolvedValueOnce({
        candidate: {
          id: 77n,
          email: 'success@example.test',
          name: 'Success Candidate',
          active: true,
        },
        mustChangePassword: false,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/candidate-auth/google/callback?code=good-code&state=${state}`)
        .set('Cookie', `ji_google_state=${state}`)
        .expect(302);

      expect(res.headers.location).toBe('http://localhost:3000/candidate');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.includes('ji_candidate_session='))).toBe(true);
      expect(cookies.some((c) => c.includes('ji_google_state=;'))).toBe(true);
    });

    it('GET /api/v1/candidate-auth/google/callback redirects to change-password if mustChangePassword is true', async () => {
      const state = 'oauth-state-must-change';
      jest.spyOn(googleService, 'exchangeCode').mockResolvedValueOnce({
        sub: 'google-sub-pwd-change',
        email: 'mustchange@example.test',
        emailVerified: true,
      });

      prisma.candidateAuth.findUnique.mockResolvedValueOnce({
        candidate: {
          id: 88n,
          email: 'mustchange@example.test',
          name: 'Must Change Candidate',
          active: true,
        },
        mustChangePassword: true,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/candidate-auth/google/callback?code=good-code&state=${state}`)
        .set('Cookie', `ji_google_state=${state}`)
        .expect(302);

      expect(res.headers.location).toBe('http://localhost:3000/candidate/change-password');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.includes('ji_candidate_session='))).toBe(true);
    });

    it('GET /api/v1/candidate-auth/google/callback redirects to login with error when candidate is not found', async () => {
      const state = 'oauth-state-notfound';
      jest.spyOn(googleService, 'exchangeCode').mockResolvedValueOnce({
        sub: 'google-sub-notfound',
        email: 'notfound@example.test',
        emailVerified: true,
      });

      prisma.candidateAuth.findUnique.mockResolvedValueOnce(null);
      prisma.candidate.findFirst.mockResolvedValueOnce(null);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/candidate-auth/google/callback?code=good-code&state=${state}`)
        .set('Cookie', `ji_google_state=${state}`)
        .expect(302);

      expect(res.headers.location).toBe(
        'http://localhost:3000/candidate/login?error=Your+Google+email+is+not+an+active+candidate+account',
      );
    });
  });
});
