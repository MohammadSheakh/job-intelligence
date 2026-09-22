# Prisma scope

Read [root](../../AGENTS.md) and [backend](../AGENTS.md) instructions first.
Applies to schema fragments, generated schema, migrations, seeds, and Prisma tooling.

- For schema/tooling work, read [database architecture](../../docs/DATABASE_ARCHITECTURE.md).
  For queries and schema design, use [database rules](../../.agents/rules/backend-database.md).
- Edit `schema/` fragments; `schema.prisma` is generated. Use the package's
  `prisma:sync` to rebuild and generate; generation alone does not rebuild fragments.
- Preserve V2 builder byte parity with the reference unless changing that requirement
  is in scope. Keep the application single-tenant and preserve database-only constraints.
- Existing data has no reviewed Prisma Migrate baseline. Migration scripts are not
  permission to apply SQL. Never reset shared data or bypass history with `db push`.
- Seeds deliberately refuse writes. Preserve that behavior until a specific dataset
  and target are authorized. Read [database switching](../../docs/DATABASE_SWITCHING.md)
  before any database connection; switching targets does not transfer data.
- Schema validation/generation can use an inert URL without a database connection.
  Report runtime evidence separately; generation does not establish deployed parity.
