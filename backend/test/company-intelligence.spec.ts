import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database';
import { CompanyIntelligenceService } from '../src/features/company-intelligence/services/company-intelligence.service';

describe('Company category replacement', () => {
  let module: TestingModule;
  let service: CompanyIntelligenceService;
  const transaction = {
    company: { findUnique: jest.fn(), update: jest.fn() },
    category: { findMany: jest.fn() },
    companyCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    transaction.company.findUnique.mockResolvedValue({ id: 'company-1' });
    transaction.category.findMany.mockResolvedValue([{ id: 7n }]);
    module = await Test.createTestingModule({ providers: [CompanyIntelligenceService, {
      provide: PrismaService, useValue: { $transaction: jest.fn(async (work) => work(transaction)) },
    }] }).compile();
    service = module.get(CompanyIntelligenceService);
  });
  afterEach(async () => module.close());

  it('normalizes categories and replaces assignments through the transaction', async () => {
    await service.update('company-1', { name: ' Example ', active: true, categories: [' TypeScript ', 'TypeScript'] });
    expect(transaction.category.findMany).toHaveBeenCalledWith({ where: { name: { in: ['TypeScript'] } }, select: { id: true } });
    expect(transaction.company.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Example' }) }));
    expect(transaction.companyCategory.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'company-1' } });
    expect(transaction.companyCategory.createMany).toHaveBeenCalledWith({ data: [{ companyId: 'company-1', categoryId: 7n, source: 'admin' }] });
  });

  it('uses Other when all categories are removed', async () => {
    await service.update('company-1', { name: 'Example', active: true, categories: [] });
    expect(transaction.category.findMany).toHaveBeenCalledWith({ where: { name: { in: ['Other'] } }, select: { id: true } });
  });

  it('rejects unknown categories before changing the company or its assignments', async () => {
    transaction.category.findMany.mockResolvedValue([]);
    await expect(service.update('company-1', { name: 'Example', active: true, categories: ['Unknown'] })).rejects.toMatchObject({ status: 404 });
    expect(transaction.company.update).not.toHaveBeenCalled();
    expect(transaction.companyCategory.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a missing company without writing', async () => {
    transaction.company.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'Example', active: true, categories: [] })).rejects.toMatchObject({ status: 404 });
    expect(transaction.company.update).not.toHaveBeenCalled();
  });
});
