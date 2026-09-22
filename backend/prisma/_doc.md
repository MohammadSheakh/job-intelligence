# Prisma schema, migrations, and seeds

Job Intelligence stays single-tenant. Edit `schema/` fragments; the byte-identical
Ferio V2 builder produces `schema.prisma`. Source data under root `data/` is read-only.

Run these commands from `backend/` (or prefix with `pnpm --dir backend` at root):

| Command | Effect |
| --- | --- |
| `pnpm prisma:schema:build` | Assemble fragments locally. |
| `pnpm prisma:generate` | Generate the application client; no database/schema update. |
| `pnpm prisma:sync` | Build fragments then generate; **no migrations or seed writes**. |
| `pnpm prisma:seed` | Validate source data and print counts/hashes without connecting. |
| `pnpm prisma:seed --apply` | Insert missing seed records into explicit `SEED_DATABASE_URL`. |
| `pnpm prisma:migrations:check` | Verify committed migration files against SHA-256 manifest. |
| `pnpm prisma:migrate:status` | Inspect history using configured `DATABASE_URL`. |
| `pnpm prisma:migrate:deploy` | Check migration integrity, then apply pending migrations. |
| `pnpm prisma:migrate:dev` | Rebuild schema and develop migrations on an intended disposable dev target. |
| `pnpm typecheck:prisma` | Typecheck config and seed source separately from application code. |

## Fresh database workflow

Explicitly set `DATABASE_URL` to the intended **empty** development database before
running migrations. Prisma config otherwise loads root `.env`, which may point at Neon.

```sh
pnpm prisma:sync
pnpm prisma:migrate:deploy
pnpm prisma:seed
# After reviewing the target, explicitly give the seed that same connection:
SEED_DATABASE_URL="$DATABASE_URL" pnpm prisma:seed --apply
pnpm prisma:migrate:status
```

The seed intentionally does not inherit `DATABASE_URL`. Plain seed previews data;
`--apply` without `SEED_DATABASE_URL` fails before opening a connection. The Prisma
CLI entrypoint is also supported: `pnpm exec prisma db seed -- --apply` with an
explicit seed target. No seeding is attached to startup, sync, or deploy.

## Dataset and rerun policy

- `data/clean_company_candidates.csv`: 1,051 company identities and research fields.
- `sql/004_categories_and_assignments.sql`: 34 categories and 1,188 assignments.
  The loader parses only known VALUES blocks; it does not execute the SQL's updates.
- Ten legacy settings defaults, with AI/email disabled. Existing settings win.
- Pilot/assessment CSVs are historical subsets, not additional company imports.
  Verified-pilot job SQL is historical, not a source of currently open jobs.
- No candidate accounts, credentials, jobs, notifications, or crawl history are seeded.

All sources are validated before connecting. Counts and SHA-256 source fingerprints
are printed for review, without record contents or credentials. Companies are keyed
by stable CSV ID, categories by name, relations by compound key, settings by key.
Bounded insert batches use `skipDuplicates` within one transaction and a seed-specific
advisory lock. Existing fields and relationships are never overwritten or deleted;
missing relationships are added. A rerun is not a mirror sync or an enrichment job.
NHPF research hints become `NO_HIRING_PAGE_FOUND` only for newly inserted companies.
An intentionally removed assignment will be inserted again on an explicit seed rerun.

## Neon database baseline and future migrations

The Neon PostgreSQL database has been verified and baselined with Prisma Migrate:

1. **Schema parity achieved**: Forward columns (`jobs.application_deadline`, `candidates.experience_years`, and `crawl_logs` diagnostics) were applied non-destructively without altering existing company, candidate, or job rows.
2. **Baselined with Prisma**: `0_initial` was marked as applied via `prisma migrate resolve --applied 0_initial`. `pnpm prisma:migrate:status` confirms `Database schema is up to date!`.
3. **Idempotent seed verified**: Running `pnpm prisma:seed --apply` directly against Neon executes safely with `skipDuplicates: true` and advisory transaction locking, preserving all existing records.

### Workflow for future field/model changes

When modifying a field name, adding a column, or creating a model as per a feature request:

1. **Edit modular fragments**: Update the appropriate file under `backend/prisma/schema/<module>.module/<model>.prisma`.
2. **Synchronize Prisma schema and client**:
   ```sh
   pnpm run prisma:sync
   ```
   This rebuilds `backend/prisma/schema.prisma` and regenerates `@prisma/client`.
3. **Create the migration**:
   Create a new migration directory `backend/prisma/migrations/<timestamp>_<feature_name>/migration.sql` with the forward DDL (e.g. `ALTER TABLE ...`), and register its SHA-256 in `backend/prisma/migration-checksums.json`.
4. **Deploy migration to Neon**:
   ```sh
   pnpm run prisma:migrate:deploy
   ```
   This runs the checksum integrity check and applies the new migration to Neon safely without touching existing data.
5. **Verify status**:
   ```sh
   pnpm run prisma:migrate:status
   ```


## Verification boundary

Verified fresh deploy, seed, zero-insert rerun, preservation of operator-edited company
and setting values, second no-op deploy, status, no-change development migration,
five CHECK constraints, and schema diff on disposable local
PostgreSQL 16. The container was removed afterwards. No Neon connection or mutation
was performed. This does not certify a Neon baseline or application runtime parity.
