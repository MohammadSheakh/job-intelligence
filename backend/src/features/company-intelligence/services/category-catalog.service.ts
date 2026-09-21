import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateCategoryDto } from '../dto/create-category.dto.js';

@Injectable()
export class CategoryCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const [categories, otherOnlyCount] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        include: { _count: { select: { companies: true } } },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.company.count({
        where: {
          categories: {
            some: { category: { name: 'Other' } },
            none: { category: { name: { not: 'Other' } } },
          },
        },
      }),
    ]);
    const order = { technology: 1, domain: 2, sector: 3, other: 4 } as const;
    return categories
      .sort(
        (left, right) =>
          order[left.type as keyof typeof order] - order[right.type as keyof typeof order] ||
          left.name.localeCompare(right.name),
      )
      .map((category) => ({
        id: category.id.toString(),
        name: category.name,
        type: category.type,
        companyCount: category.name === 'Other' ? otherOnlyCount : category._count.companies,
      }));
  }

  async create(input: CreateCategoryDto): Promise<void> {
    const name = input.name.trim();
    if (!name) return;
    await this.prisma.category.upsert({
      where: { name },
      create: { name, type: input.type },
      update: { type: input.type },
    });
  }
}
