import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { hashLegacyScrypt, verifyLegacyScrypt } from './password.service.js';

export interface CandidatePrincipal { id: bigint; name: string; email: string; mustChangePassword: boolean; }

@Injectable()
export class CandidateAuthenticationService {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(email: string, password: string): Promise<CandidatePrincipal | null> {
    const row = await this.prisma.candidate.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' }, active: true }, include: { auth: true } });
    if (!row?.auth?.passwordHash || !await verifyLegacyScrypt(password, row.auth.passwordHash)) return null;
    return { id: row.id, name: row.name, email: row.email, mustChangePassword: row.auth.mustChangePassword };
  }
  async getActiveCandidate(candidateId: bigint): Promise<CandidatePrincipal | null> {
    const row = await this.prisma.candidate.findFirst({ where: { id: candidateId, active: true }, include: { auth: true } });
    return row ? { id: row.id, name: row.name, email: row.email, mustChangePassword: row.auth?.mustChangePassword ?? false } : null;
  }
  async changePassword(candidateId: bigint, password: string): Promise<void> {
    const passwordHash = await hashLegacyScrypt(password);
    await this.prisma.candidateAuth.upsert({ where: { candidateId }, create: { candidateId, passwordHash, mustChangePassword: false }, update: { passwordHash, mustChangePassword: false } });
  }
}
