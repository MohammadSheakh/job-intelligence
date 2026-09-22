import { hashLegacyScrypt, verifyLegacyScrypt } from './password.service.js';

describe('password.service (pure unit test)', () => {
  it('hashes password and verifies it successfully', async () => {
    const raw = 'my-secure-password-123';
    const hash = await hashLegacyScrypt(raw);

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);

    const valid = await verifyLegacyScrypt(raw, hash);
    expect(valid).toBe(true);

    const invalid = await verifyLegacyScrypt('wrong-password', hash);
    expect(invalid).toBe(false);
  });

  it('rejects passwords shorter than 8 characters', async () => {
    await expect(hashLegacyScrypt('short')).rejects.toThrow(/8–256 characters/);
  });

  it('rejects passwords longer than 256 characters', async () => {
    const huge = 'a'.repeat(257);
    await expect(hashLegacyScrypt(huge)).rejects.toThrow(/8–256 characters/);
  });

  it('returns false safely on malformed hash strings without throwing', async () => {
    expect(await verifyLegacyScrypt('password', 'not-a-hash')).toBe(false);
    expect(await verifyLegacyScrypt('password', 'scrypt$invalid$format')).toBe(false);
    expect(await verifyLegacyScrypt('password', '')).toBe(false);
  });
});
