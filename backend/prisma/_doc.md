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

## Existing Neon database: separate adoption, no reset

`0_initial` creates the complete current schema, including milestone 22 diagnostics
and five legacy CHECK constraints. It is verified on fresh PostgreSQL, **not** yet
adopted against the existing Neon database. Do not run its create-table SQL there.

Before adopting Prisma Migrate on existing data:

1. Confirm target, backup/restore evidence, and current schema/migration history.
2. Compare the existing database with this baseline, including column types, defaults,
   nullability, indexes, foreign keys, CHECK constraints, and objects Prisma cannot model.
   A Prisma diff alone does not cover every database object.
3. Review and apply only required forward changes. Earlier SQL extensions such as
   `sql/009_crawl_log_diagnostics.sql` may still be unapplied. A fresh baseline already
   includes them; do not blindly apply multiple migration authorities to the same target.
4. **Only after verified equivalence**, record `0_initial` as applied using
   `pnpm exec prisma migrate resolve --applied 0_initial` on that reviewed target.
   This changes migration history; it neither checks parity nor runs baseline SQL.
5. Thereafter deploy reviewed forward migrations through Prisma. Do not seed Neon
   merely to adopt migration history; its existing data remains authoritative.

Never accept a reset prompt on a data-bearing database. New migrations require SQL
review and a matching manifest entry; never rewrite a released migration/checksum to
hide drift. Development commands may require shadow-database creation privileges.
See [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)
and [database switching](../../docs/DATABASE_SWITCHING.md).

## Verification boundary

Verified fresh deploy, seed, zero-insert rerun, preservation of operator-edited company
and setting values, second no-op deploy, status, no-change development migration,
five CHECK constraints, and schema diff on disposable local
PostgreSQL 16. The container was removed afterwards. No Neon connection or mutation
was performed. This does not certify a Neon baseline or application runtime parity.
