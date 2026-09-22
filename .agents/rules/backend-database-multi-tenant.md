# Multi-tenant database rules — reference only

**Not active for Job Intelligence runtime work.** This application follows
[single-tenant database rules](backend-database.md). Load this document only for
an explicitly requested multi-tenant design or work in a multi-tenant repository.
Its own scoped instructions and architecture decisions remain authoritative.
Creating this reference does not authorize adding tenant/platform infrastructure.

## Applicability and evidence

The Prisma layout and scripts below were inspected in the sibling
`ferio-nest-prisma` repository. They describe observed tooling, not a certification
of its runtime isolation. The subsequent design rules are requirements to evaluate
when implementing multi-tenancy, not claims that Ferio already implements them.
All Ferio paths below are relative to that repository, which need not be present
in every checkout. Reinspect its files before acting; do not run these commands
inside Job Intelligence's backend package.

Choose and record an isolation model before implementation: database per tenant,
schema per tenant, or shared tables with tenant keys. Do not silently mix models.
This reference's primary flow is Ferio's separate platform database and tenant
commerce databases. Shared-table and schema isolation require the additional
controls below, not a copy of the same client routing implementation.

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

## Trusted tenant resolution and authorization

1. Authenticate the actor and resolve a canonical tenant identifier through a
   trusted registry. A header, hostname, route parameter, or job payload is a
   routing hint, not proof of tenant membership. Validate domain ownership and
   membership/role before permitting tenant operations.
2. Resolve database credentials server-side from trusted configuration or a secret
   store. Never accept a connection URL, database name, schema name, or secret
   reference directly from the caller. Restrict database destinations and privileges.
3. Establish immutable tenant context for the operation and fail closed when it is
   missing, unknown, suspended, or incompatible with the required schema version.
   Never fall back to a default tenant or platform database on routing failure.
4. Pass context explicitly or through a reviewed request-context mechanism that
   preserves isolation across asynchronous execution. Never switch a singleton
   client's connection URL or process environment per request.
5. Enforce resource-level authorization within the tenant too. Platform operators
   are not automatically tenant users; support access needs explicit scope,
   expiration, and an audit trail. Keep secrets and sensitive data out of audit logs.

## Client ownership and connection budgets

- Platform metadata (organizations, routing, provisioning state, plans) belongs to
  the platform client. Tenant business records belong to the resolved tenant client.
  Do not copy business data into platform tables merely to avoid a boundary.
- Manage tenant clients in a bounded registry keyed by canonical tenant identity
  and connection configuration/version. Deduplicate concurrent client creation;
  evict only idle clients with no active operations and close pools on eviction,
  credential rotation, failure, and shutdown. No new client per query or unbounded
  permanent client per discovered tenant.
- Budget active tenant pools × per-pool size × replicas, plus platform, worker,
  migration, and dedicated-lock connections. Bound acquisition waits, concurrency,
  queues, retries, and per-tenant work to prevent one tenant exhausting capacity.
- Use least-privilege runtime credentials, separate operational migration rights,
  TLS, and reviewed rotation/revocation behavior. Never log connection strings.
  Verify pooler semantics before relying on session state or advisory locks.

## Tenant-scoped persistence and transactions

- Use typed queries or parameterized SQL, explicit projections, bounded batches,
  stable pagination, and predicate-driven indexes. Preserve exact numeric values,
  identifier ranges, nullability, time semantics, and deletion contracts.
- Enforce uniqueness and invariants in database constraints; use atomic conditional
  writes or scoped locks for races. Document idempotency and bounded conflict
  retries. Propagate unexpected failures rather than returning partial success.
- A transaction belongs to one tenant database/client. Every participating query
  must use its transaction client. Keep external I/O outside its lifetime.
- A tenant transaction cannot atomically commit platform or another tenant's
  database writes. Use durable orchestration/outbox events with idempotent consumers,
  checkpoints, retries, and compensation when cross-database consistency is needed.
  Do not imply a Prisma transaction is a distributed transaction.
- Include canonical tenant identity in job envelopes, cache keys, deduplication
  keys, locks, exports, and storage paths. Validate producer authority and resolve
  current routing at execution; never serialize credentials into jobs. Recheck
  lifecycle/access state for delayed work. Design cache invalidation for moves,
  credential rotation, suspension, and deletion.

## Additional controls for other isolation models

For **shared tables**, make tenant keys required on tenant-owned rows. Scope all
reads, counts, writes, relation traversal, bulk operations, and raw SQL. Use
compound unique keys and foreign keys that prevent cross-tenant references where
relationships require them; global uniqueness must be an intentional requirement.
An ORM query wrapper alone is not sufficient evidence of isolation.

If using PostgreSQL row-level security, define read and write policies and enforce
them with runtime roles that cannot bypass them. Owners normally bypass RLS;
superusers and `BYPASSRLS` roles bypass it. Set any policy context within the same
transaction/connection used by the protected queries, with no pooled-session
leakage. Review privileged paths and backups separately. See
[PostgreSQL row-security semantics](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

For **schema per tenant**, use trusted schema identifiers, explicit privileges,
and a reviewed search-path strategy. Never derive raw SQL identifiers from user
input or leave tenant session state on pooled connections. Document how the
installed Prisma client maps schemas; schema isolation is not automatically
provided by selecting an arbitrary runtime schema name.

## Fleet migrations and tenant lifecycle

- Keep platform and tenant migration chains separate, immutable after release, and
  checksum-verified. Review baseline equivalence before marking existing schemas
  applied. Never hide drift by rewriting checksums or reset a data-bearing target.
- Generate/review tenant migrations once against a disposable development database;
  deploy the same approved artifacts across the fleet. Do not run `migrate dev`
  separately per production tenant or from a request handler.
- Plan compatibility across platform version, application/client version, and tenant
  schema versions. Use expand/backfill/validate/contract and delay destructive changes
  until all dependent readers/writers have moved. Quarantine incompatible tenants
  explicitly instead of retrying unknown SQL failures indefinitely.
- Roll out to a canary tenant, then bounded waves. Serialize migrations per target;
  persist per-tenant version, attempt, outcome, and sanitized error. Define stop
  thresholds, resume behavior, timeouts, and rollback/forward-repair procedures.
  A successful migration on one tenant does not mean fleet completion.
- Provision through explicit durable states: reserve identity/routing, create the
  database, apply the approved schema, apply any authorized idempotent bootstrap,
  verify readiness, then activate routing. Prevent duplicate provisioning; retain
  recoverable failure state and clean up only resources owned by that attempt.
- Design suspension, export, move, restore, retention, and deletion explicitly.
  Verify tenant identity before restoration; coordinate registry and database state,
  revoke credentials, invalidate clients/caches, and prevent stale queued work from
  resurrecting deleted data. Define backup retention and demonstrate restore on an
  isolated target. Do not assume platform backups include tenant databases.

## Verification and delivery evidence

For documentation changes, check links, scripts, config selection, and scope.
For implementation, when runtime verification is authorized, cover at least two
tenants with overlapping local IDs, concurrent context resolution, unauthorized
resource IDs, missing context, raw/bulk/relation paths, background jobs, cache
isolation, credential rotation, pool eviction, partial provisioning, and a failed
migration wave. Verify RLS using the actual runtime role when applicable.

Respect explicitly deferred tests and record the evidence gap. Static checks do
not prove tenant isolation. Report which tenancy model and targets were inspected,
what was verified, any mutations, and remaining operational prerequisites. This
document does not authorize fleet deployment, seeding, or architectural migration.
