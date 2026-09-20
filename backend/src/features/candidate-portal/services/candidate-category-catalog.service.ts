import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
@Injectable()
export class CandidateCategoryCatalogService {
  constructor(private readonly prisma: PrismaService) {}
  async list(): Promise<Array<{ name: string; type: string }>> {
    return this.prisma.category.findMany({ where: { name: { not: 'Other' } }, select: { name: true, type: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  }
}
