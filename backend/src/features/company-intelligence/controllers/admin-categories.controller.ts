import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { CategoryCatalogService } from '../services/category-catalog.service.js';

/** Basic-authenticated maintenance of the shared company category catalog. */
@Controller('admin/categories')
@UseGuards(AdminBasicAuthGuard)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoryCatalogService) {}

  /** Return category summaries and company counts. */
  @Get()
  list() {
    return this.categories.list();
  }

  /** Create a category or update its type by name without replacing its identity. */
  @Post()
  async create(
    @Body()
    input: CreateCategoryDto,
  ) {
    await this.categories.create(input);
    return { ok: true };
  }
}
