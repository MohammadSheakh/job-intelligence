import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { scryptSync } from 'node:crypto';
import { CandidateSessionService } from '../../src/features/authentication/services/candidate-session.service';
import {
  hashLegacyScrypt,
  verifyLegacyScrypt,
} from '../../src/features/authentication/services/password.service';

describe('Candidate authentication primitives', () => {
  let module: TestingModule;
  let sessions: CandidateSessionService;
  const originalSecret = process.env.CANDIDATE_SESSION_SECRET;

  beforeAll(async () => {
    process.env.CANDIDATE_SESSION_SECRET = 'test-only-session-secret-at-least-32-characters';
    module = await Test.createTestingModule({ providers: [CandidateSessionService] }).compile();
    sessions = module.get(CandidateSessionService);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await module.close();
    if (originalSecret === undefined) delete process.env.CANDIDATE_SESSION_SECRET;
    else process.env.CANDIDATE_SESSION_SECRET = originalSecret;
  });

  it('accepts a legacy scrypt record and rejects an incorrect password', async () => {
    const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const hash = scryptSync('legacy-password', salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
    const encoded = `scrypt$16384$8$1$${salt.toString('hex')}$${hash}`;
    expect(await verifyLegacyScrypt('legacy-password', encoded)).toBe(true);
    expect(await verifyLegacyScrypt('incorrect-password', encoded)).toBe(false);
  });

  it('salts new passwords and enforces password length', async () => {
    const first = await hashLegacyScrypt('new-password');
    expect(await hashLegacyScrypt('new-password')).not.toBe(first);
    expect(await verifyLegacyScrypt('new-password', first)).toBe(true);
    await expect(hashLegacyScrypt('short')).rejects.toThrow();
    await expect(hashLegacyScrypt('x'.repeat(257))).rejects.toThrow();
  });

  it('rejects malformed password hashes', async () => {
    expect(await verifyLegacyScrypt('password', 'not-a-hash')).toBe(false);
  });

  it('preserves large candidate IDs and rejects tampered sessions', () => {
    const id = 9007199254740993n;
    const { token } = sessions.create(id);
    expect(sessions.verify(token)).toBe(id);
    expect(sessions.verify(token.replace(id.toString(), '2'))).toBeNull();
    expect(sessions.verify(`${token}.extra`)).toBeNull();
    expect(sessions.verify('invalid')).toBeNull();
  });

  it('supports versioned session tokens and returns payload metadata', () => {
    const id = 12345n;
    const { token } = sessions.create(id, 3);
    const payload = sessions.verifyPayload(token);
    expect(payload).toEqual({ candidateId: id, tokenVersion: 3 });
    expect(sessions.verify(token)).toBe(id);
  });

  it('rejects a session at its expiry boundary', () => {
    const { token, expiresAt } = sessions.create(1n);
    jest.spyOn(Date, 'now').mockReturnValue(expiresAt.getTime());
    expect(sessions.verify(token)).toBeNull();
  });
});
