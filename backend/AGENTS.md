# Backend scope

Read [root instructions](../AGENTS.md) first. This file applies to `backend/`.

## Context to load

- [Developer guide](../docs/BACKEND_DEVELOPER_GUIDE.md): read the affected request/job flow.
- [API compatibility](../docs/BACKEND_API_CONTRACTS.md): route, auth, or response changes.
- [Database architecture](../docs/DATABASE_ARCHITECTURE.md): Prisma tooling or schema work.
- [Project backend workflow](../.agents/skills/job-intelligence-backend/SKILL.md):
  implementation or architectural review.
- [API rules](../.agents/rules/backend-api.md): routes, guards, DTOs, consumers.
- [Database rules](../.agents/rules/backend-database.md): queries, repositories, schema.
- [Transaction rules](../.agents/rules/backend-transactions.md): multi-write/worker changes.
- [Prisma scope](prisma/AGENTS.md): any schema, generation, seed, or migration edit.

- [Capacity rules](../.agents/rules/reliability-capacity.md): workers, external I/O, or scaling decisions.

## Actual architecture

Nest feature modules use strict TypeScript, constructor injection, Prisma 7 with
the PostgreSQL adapter, and `/api/v1`. DTO validation uses class-validator and
class-transformer. There is no platform database, tenant context, Drizzle layer,
Redis cache, global ErrorService, or required queue runtime. Do not introduce
those implicitly from a generic skill.

Controllers handle transport; services own use cases; pure domain helpers own
scoring/parsing policy. Existing services query Prisma directly. For complex SQL,
reusable persistence, or connection ownership, use a focused repository and keep
that use case's database access there. Do not wrap every Prisma method or refactor
untouched services just to manufacture layers. Repositories return domain data
or typed failures; services map them to HTTP errors where relevant.

Export shared feature providers through modules; import those modules rather
than registering duplicate providers. Keep dependency direction explicit and
avoid circular imports. Add only directories with a real responsibility. Existing
regression suites live in `backend/test/`; do not move them to satisfy a template.

## Validation

From the repository root: `pnpm --dir backend typecheck`,
`pnpm --dir backend build`, and `pnpm check:style`. When tests are authorized,
use `test`, `test:database`, or `test:browser` as appropriate; setup and database
isolation are documented in [test README](test/README.md). `typecheck:test` checks
suite types separately. Worker commands without `--help` may perform live writes;
a compiled command is not permission to execute it against configured data.
