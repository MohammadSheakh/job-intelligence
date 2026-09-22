# Prisma scope

Read [root](../../AGENTS.md) and [backend](../AGENTS.md) instructions first.
Applies to schema fragments, generated schema, migrations, seeds, and Prisma tooling.

## Load only the affected concern

- For schema/tooling work, read [database architecture](../../docs/DATABASE_ARCHITECTURE.md).
  For queries and schema design, use [database rules](../../.agents/rules/backend-database.md).

## Local tooling and gotchas

- Edit `schema/` fragments; `schema.prisma` is generated. Use the package's
  `prisma:sync` to rebuild and generate; generation alone does not rebuild fragments.
- Preserve V2 builder byte parity with the reference unless changing that requirement
  is in scope. Keep the application single-tenant and preserve database-only constraints.
- `0_initial` bootstraps empty databases; existing Neon baseline adoption is pending.
  Migration scripts are not permission to apply SQL. Never reset shared data or bypass history with `db push`.
- Seeds preview by default; writes require `--apply` and explicit `SEED_DATABASE_URL`.
  Preserve source data and insert-only behavior. Read [seed/adoption workflow](_doc.md)
  and [database switching](../../docs/DATABASE_SWITCHING.md)
  before any database connection; switching targets does not transfer data.

## Verification

- Schema validation/generation can use an inert URL without a database connection.
  Report runtime evidence separately; generation does not establish deployed parity.
