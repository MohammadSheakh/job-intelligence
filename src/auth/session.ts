import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const value = process.env.CANDIDATE_SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error('CANDIDATE_SESSION_SECRET must be set to at least 32 characters.');
  return value;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSignedSession(candidateId: number): { token: string; expiresAt: Date } {
  const days = Math.max(1, Math.min(90, Number(process.env.CANDIDATE_SESSION_DAYS ?? '30') || 30));
  const expiresAt = new Date(Date.now() + days * 86400000);
  const payload = `${candidateId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifySignedSession(token: string): number | null {
  try {
    const [idRaw, expRaw, sig] = token.split('.');
    if (!idRaw || !expRaw || !sig) return null;
    const payload = `${idRaw}.${expRaw}`;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const exp = Number(expRaw);
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
    return id;
  } catch {
    return null;
  }
}
