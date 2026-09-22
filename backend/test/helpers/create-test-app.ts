import 'reflect-metadata';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';

export interface TestAppContext {
  app: INestApplication;
  module: TestingModule;
}

/**
 * Boots the full Nest AppModule with identical runtime pipes, prefixes, and filters
 * for Supertest HTTP E2E tests against real disposable PostgreSQL.
 */
export async function createTestApp(): Promise<TestAppContext> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return { app, module };
}
