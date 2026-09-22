# Ferio Prisma tooling reference

Read only when comparing the sibling `ferio-nest-prisma` tooling or explicitly
working on its tenant/platform setup. Paths below are relative to that repository.
This snapshot does not authorize adding tenancy to Job Intelligence or prove
runtime isolation. Reinspect the source files before operations.

For this application use [database architecture](DATABASE_ARCHITECTURE.md).
For portable isolation policies use [multi-tenant rules](../.agents/rules/backend-database-multi-tenant.md).

## Observed Ferio Prisma flow

Ferio's `prisma/schema/` uses the same base/shared/user/feature fragment convention
and V2 builder for its **tenant commerce** `schema.prisma`. Its separate
`prisma/platform.prisma` is authored outside that fragment tree and generates to
`src/platform/generated/platform-client`. V2 does not assemble the platform file.

Ferio's root `prisma.config.ts` loads `dotenv/config`, uses `DATABASE_URL`, selects
`prisma/migrations`, and conditionally accepts `SHADOW_DATABASE_URL`.
`prisma/platform.config.ts` selects `PLATFORM_DATABASE_URL`, `platform.prisma`,
and `platform-migrations` relative to that config. Platform deployment explicitly
uses `--config prisma/platform.config.ts`. **Selecting `--schema` alone is not a
switch to the platform datasource or migration configuration.**

Ferio has separate tenant/platform SQL histories and a checksum manifest checked
by `scripts/validate-migration-integrity.mjs`. Job Intelligence has neither those
histories nor that validator. Prisma's own migration history/checksums are a
separate mechanism; never edit a checksum to disguise modified applied SQL.
Ferio's `seed.ts` writes commerce/bootstrap data (including users, delivery zones,
providers, and warehouses). Neither its seeds nor its migration chains belong in
Job Intelligence. Folder/tooling similarity does not mean database parity.


## Exact Ferio package scripts

Run from the Ferio package root. This is a snapshot of its `package.json`.

```json
{
  "prisma:schema:build": "node prisma/scripts/build-prisma-schemaV2.js",
  "prisma:generate": "pnpm prisma generate --schema prisma/schema.prisma && pnpm prisma generate --schema prisma/platform.prisma",
  "prisma:sync": "pnpm run prisma:schema:build && pnpm run prisma:generate",
  "prisma:seed": "ts-node -r tsconfig-paths/register prisma/seed.ts",
  "prisma:migrate:dev": "pnpm run prisma:schema:build && pnpm prisma migrate dev --schema prisma/schema.prisma",
  "prisma:migrate:status": "pnpm prisma migrate status --schema prisma/schema.prisma",
  "prisma:migrate:deploy": "pnpm prisma migrate deploy --schema prisma/schema.prisma",
  "prisma:generate:platform": "pnpm prisma generate --schema prisma/platform.prisma",
  "prisma:migrate:platform": "pnpm exec prisma migrate deploy --config prisma/platform.config.ts"
}
```

`prisma:schema:build` recursively combines tenant fragments with V2: base, shared,
user, learning, then other paths, alphabetically within priority. Source comments
identify fragment ownership. Edit fragments, rebuild `schema.prisma`, validate,
then generate both clients. Edit `platform.prisma` separately for platform models.
The builder neither discovers platform migrations nor generates SQL/checksums.

`prisma:generate` does not rebuild fragments. `prisma:sync` builds and generates;
it does not synchronize any database. Generating two clients does not provision
a tenant or migrate either database. Keep client imports and generated outputs
separate so platform repositories cannot accidentally receive a tenant client.

`prisma:migrate:dev` rebuilds and acts on the configured tenant development target;
its shadow/reset behavior is unsuitable for shared production data.
`prisma:migrate:status` connects to one configured tenant target.
`prisma:migrate:deploy` applies pending tenant migrations to **one configured
database**, not the entire fleet. `prisma:migrate:platform` applies the separate
platform chain through its explicit config. Neither deploy command generates
clients or proves drift-free state. The seed command performs real writes; it
must not run automatically during requests, migrations, or tenant discovery.

Config-relative schema/migration paths and explicit `--config` selection are
specified by [Prisma config documentation](https://docs.prisma.io/docs/orm/reference/prisma-config-reference).
Inspect the installed Prisma version rather than assuming newer CLI behavior.

