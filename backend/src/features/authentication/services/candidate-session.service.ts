import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CandidateSessionService {
  create(candidateId: bigint): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const payload = `${candidateId}.${Math.floor(expiresAt.getTime() / 1000)}`;
    const signature = createHmac('sha256', this.secret()).update(payload).digest('base64url');
    return { token: `${payload}.${signature}`, expiresAt };
  }

  verify(token: string): bigint | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [id, expiry, signature] = parts;
    if (!id || !expiry || !signature || !/^\d+$/.test(id) || !/^\d+$/.test(expiry)) return null;
    const expected = createHmac('sha256', this.secret())
      .update(`${id}.${expiry}`)
      .digest('base64url');
    const received = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer))
      return null;
    return Number(expiry) > Math.floor(Date.now() / 1000) ? BigInt(id) : null;
  }

  private secret(): string {
    const secret = process.env.CANDIDATE_SESSION_SECRET;
    if (!secret || secret.length < 32)
      throw new Error('CANDIDATE_SESSION_SECRET must be at least 32 characters.');
    return secret;
  }
}
