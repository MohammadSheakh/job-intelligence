import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import type { Prisma } from '@prisma/client';
import { hashLegacyScrypt, verifyLegacyScrypt } from './password.service.js';

export interface CandidatePrincipal {
  id: bigint;
  name: string;
  email: string;
  mustChangePassword: boolean;
}

/**
 * Authenticates existing active candidates using legacy-compatible scrypt hashes; it does not
 * register accounts.
 */
@Injectable()
export class CandidateAuthenticationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up an active candidate case-insensitively and return only the principal when the password
   * verifies.
   */
  async authenticate(email: string, password: string): Promise<CandidatePrincipal | null> {
    const row = await this.prisma.candidate.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' }, active: true },
      include: { auth: true },
    });
    if (!row?.auth?.passwordHash || !(await verifyLegacyScrypt(password, row.auth.passwordHash)))
      return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      mustChangePassword: row.auth.mustChangePassword,
    };
  }

  /**
   * Reload account activity and password-change state on each request so admin changes affect
   * existing sessions.
   */
  async getActiveCandidate(candidateId: bigint): Promise<CandidatePrincipal | null> {
    const row = await this.prisma.candidate.findFirst({
      where: { id: candidateId, active: true },
      include: { auth: true },
    });
    return row
      ? {
          id: row.id,
          name: row.name,
          email: row.email,
          mustChangePassword: row.auth?.mustChangePassword ?? false,
        }
      : null;
  }

  /** Set the candidate’s chosen password and clear the mandatory-change flag. */
  async changePassword(candidateId: bigint, password: string): Promise<void> {
    await this.setPassword(candidateId, password, false);
  }

  /**
   * Hash before persistence; an optional transaction lets admin profile and password changes
   * commit or roll back together.
   */
  async setPassword(
    candidateId: bigint,
    password: string,
    mustChangePassword: boolean,
    database: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const passwordHash = await hashLegacyScrypt(password);
    await database.candidateAuth.upsert({
      where: { candidateId },
      create: { candidateId, passwordHash, mustChangePassword },
      update: { passwordHash, mustChangePassword },
    });
  }

  /**
   * Find an active candidate bound to the verified Google account, or bind an existing active
   * candidate matching the email. Rejects binding if email is unbound to any candidate or if
   * candidate is already bound to a different Google sub.
   */
  async findOrBindGoogleCandidate(input: {
    email: string;
    sub: string;
  }): Promise<CandidatePrincipal | null> {
    const existingBound = await this.prisma.candidateAuth.findUnique({
      where: { google_sub: input.sub },
      include: { candidate: true },
    });

    if (existingBound) {
      if (!existingBound.candidate.active) return null;
      return {
        id: existingBound.candidate.id,
        name: existingBound.candidate.name,
        email: existingBound.candidate.email,
        mustChangePassword: existingBound.mustChangePassword,
      };
    }

    const candidate = await this.prisma.candidate.findFirst({
      where: {
        email: { equals: input.email.trim(), mode: 'insensitive' },
        active: true,
      },
      include: { auth: true },
    });

    if (!candidate) return null;

    if (candidate.auth?.google_sub && candidate.auth.google_sub !== input.sub) {
      return null;
    }

    const updatedAuth = await this.prisma.candidateAuth.upsert({
      where: { candidateId: candidate.id },
      create: {
        candidateId: candidate.id,
        google_sub: input.sub,
        google_email: input.email.toLowerCase().trim(),
        mustChangePassword: candidate.auth?.mustChangePassword ?? false,
      },
      update: {
        google_sub: input.sub,
        google_email: input.email.toLowerCase().trim(),
        updated_at: new Date(),
      },
    });

    return {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      mustChangePassword: updatedAuth.mustChangePassword,
    };
  }
}
