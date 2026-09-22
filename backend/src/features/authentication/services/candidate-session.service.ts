import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface VerifiedSessionPayload {
  candidateId: bigint;
  tokenVersion: number;
}

/**
 * Creates and verifies stateless, HMAC-signed candidate cookies with versioning support;
 * account activity and token revocation are checked by the guard.
 */
@Injectable()
export class CandidateSessionService {
  /**
   * Sign the candidate ID, token version, and a 30-day Unix expiry; preserve bigint precision
   * in the token payload.
   */
  create(candidateId: bigint, tokenVersion: number = 1): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const payload = `${candidateId}.${tokenVersion}.${Math.floor(expiresAt.getTime() / 1000)}`;
    const signature = createHmac('sha256', this.secret()).update(payload).digest('base64url');
    return { token: `${payload}.${signature}`, expiresAt };
  }

  /**
   * Return verified payload containing candidate ID and token version.
   * Supports both 4-part versioned tokens and backward-compatible 3-part legacy tokens.
   */
  verifyPayload(token: string): VerifiedSessionPayload | null {
    const parts = token.split('.');
    if (parts.length === 4) {
      const [id, version, expiry, signature] = parts;
      if (
        !id ||
        !version ||
        !expiry ||
        !signature ||
        !/^\d+$/.test(id) ||
        !/^\d+$/.test(version) ||
        !/^\d+$/.test(expiry)
      ) {
        return null;
      }
      const expected = createHmac('sha256', this.secret())
        .update(`${id}.${version}.${expiry}`)
        .digest('base64url');
      const received = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);
      if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) {
        return null;
      }
      return Number(expiry) > Math.floor(Date.now() / 1000)
        ? { candidateId: BigInt(id), tokenVersion: Number(version) }
        : null;
    }

    if (parts.length === 3) {
      const [id, expiry, signature] = parts;
      if (!id || !expiry || !signature || !/^\d+$/.test(id) || !/^\d+$/.test(expiry)) return null;
      const expected = createHmac('sha256', this.secret())
        .update(`${id}.${expiry}`)
        .digest('base64url');
      const received = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);
      if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer))
        return null;
      return Number(expiry) > Math.floor(Date.now() / 1000)
        ? { candidateId: BigInt(id), tokenVersion: 1 }
        : null;
    }

    return null;
  }

  /**
   * Return the candidate ID only for an untampered, unexpired token.
   * Backward-compatible convenience wrapper for callers needing only the ID.
   */
  verify(token: string): bigint | null {
    return this.verifyPayload(token)?.candidateId ?? null;
  }

  /** Fail closed when the configured signing secret is missing or too short. */
  private secret(): string {
    const secret = process.env.CANDIDATE_SESSION_SECRET;
    if (!secret || secret.length < 32)
      throw new Error('CANDIDATE_SESSION_SECRET must be at least 32 characters.');
    return secret;
  }
}
