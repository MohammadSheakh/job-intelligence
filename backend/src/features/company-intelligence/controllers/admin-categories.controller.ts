import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { CategoryCatalogService } from '../services/category-catalog.service.js';

@Controller('admin/categories')
@UseGuards(AdminBasicAuthGuard)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoryCatalogService) {}
  @Get() list() { return this.categories.list(); }
  @Post() async create(@Body() input: CreateCategoryDto) { await this.categories.create(input); return { ok: true }; }
}
