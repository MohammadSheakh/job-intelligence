import { randomBytes, scrypt as callback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

type ScryptAsync = (
  password: string | Buffer,
  salt: string | Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;
const scrypt = promisify(callback) as unknown as ScryptAsync;
const parameters = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Verify legacy-encoded scrypt credentials; malformed records and derivation failures return
 * false.
 */
export async function verifyLegacyScrypt(password: string, encoded: string): Promise<boolean> {
  try {
    const [kind, n, r, p, salt, hash] = encoded.split('$');
    if (kind !== 'scrypt' || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'hex');
    const actual = (await scrypt(password, Buffer.from(salt, 'hex'), expected.length, {
      ...parameters,
      N: Number(n),
      r: Number(r),
      p: Number(p),
    })) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Create a random-salted scrypt record using the legacy encoding so existing and migrated
 * authentication remain compatible.
 */
export async function hashLegacyScrypt(password: string): Promise<string> {
  if (password.length < 8 || password.length > 256)
    throw new Error('Password must be 8–256 characters.');
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64, parameters)) as Buffer;
  return `scrypt$${parameters.N}$${parameters.r}$${parameters.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}
