# Prisma scope

Read [root](../../AGENTS.md) and [backend](../AGENTS.md) instructions first.
This file applies to schema fragments, builder scripts, migrations, and seeds.

- Read [ownership and commands](_doc.md) and
  [database switching](../../docs/DATABASE_SWITCHING.md) before database operations.
- Edit models in `schema/`; `schema.prisma` is generated. Run
  `pnpm --dir backend prisma:sync` from the repository root to rebuild and generate.
  `prisma:generate` alone does not rebuild fragments.
- `scripts/build-prisma-schemaV2.js` is intentionally byte-identical to the Ferio
  reference. Preserve it unless changing that compatibility requirement is in scope.
- Preserve the 11-model introspected schema's existing mapped names, bigint IDs,
  nullability, relations, constraints, and data. Additions need an explicit design;
  no commerce/platform models or seed data belong here.
- Existing Neon data has no reviewed Prisma Migrate baseline. Migration commands
  being present does not make them safe to run. Preserve database check constraints
  that Prisma cannot express. Plan additive/backfill/constraint changes and rollback
  before deployment; never accept a reset prompt as a migration repair.
- Seed entry points deliberately refuse writes. Keep that behavior until a
  specific seed design and target are authorized. Local and Neon data are separate.
- Generation/validation can use an explicit inert DATABASE_URL; they need no live
  database connection. Migration/seed/crawl commands have different side effects.
- Do not edit a shared applied migration. Record forward changes and baseline
  prerequisites; check generated model differences before claiming schema parity.
