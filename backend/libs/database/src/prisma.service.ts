import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

/** Owns the single-tenant Prisma client and PostgreSQL pool for the Nest application lifecycle. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');

    const maxPool = parseInt(process.env.DATABASE_POOL_MAX || '10', 10);
    const idleTimeout = parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000', 10);
    const connTimeout = parseInt(process.env.DATABASE_CONN_TIMEOUT_MS || '5000', 10);

    const pool = new Pool({
      connectionString: databaseUrl,
      max: Number.isInteger(maxPool) && maxPool > 0 ? maxPool : 10,
      idleTimeoutMillis: Number.isInteger(idleTimeout) ? idleTimeout : 30_000,
      connectionTimeoutMillis: Number.isInteger(connTimeout) ? connTimeout : 5_000,
    });

    pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client pool', err);
    });

    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  /** Establish the database connection when Nest initializes the provider. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Close both Prisma and the underlying PostgreSQL pool during application shutdown. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
