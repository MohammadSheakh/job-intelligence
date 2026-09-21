import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { AdminCategoriesController } from './controllers/admin-categories.controller.js';
import { AdminCompaniesController } from './controllers/admin-companies.controller.js';
import { CategoryCatalogService } from './services/category-catalog.service.js';
import { CompanyIntelligenceService } from './services/company-intelligence.service.js';

@Module({
  imports: [AuthenticationModule],
  controllers: [AdminCompaniesController, AdminCategoriesController],
  providers: [CompanyIntelligenceService, CategoryCatalogService],
})
export class CompanyIntelligenceModule {}
