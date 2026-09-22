import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: '../.env' });
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL
      ? env('DATABASE_URL')
      : 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
