import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';

/** Provides selectable profile categories; Other is a placeholder, not a candidate preference. */
@Injectable()
export class CandidateCategoryCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Project category names/types in stable type/name order without exposing database identifiers.
   */
  async list(): Promise<Array<{ name: string; type: string }>> {
    return this.prisma.category.findMany({
      where: { name: { not: 'Other' } },
      select: { name: true, type: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }
}
