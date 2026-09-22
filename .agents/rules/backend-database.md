# Single-tenant database rules — Job Intelligence

**Active rules for this application.** Applies to Prisma models, SQL, repositories,
transactions, seeds, and database operations. The separate
[multi-tenant reference](backend-database-multi-tenant.md) applies only to explicitly
scoped multi-tenant work; it does not authorize changing this application's tenancy.

Read [backend scope](../../backend/AGENTS.md),
[Prisma scope](../../backend/prisma/AGENTS.md), and
[transaction rules](backend-transactions.md). Before connecting to a database,
read [database switching](../../docs/DATABASE_SWITCHING.md).

## Architecture and source of truth

Job Intelligence uses **one PostgreSQL database**, Prisma 7, and `PrismaPg`.
The sibling `ferio-nest-prisma` repository supplies a tooling reference, not a
requirement to adopt its commerce models, tenant routing, or platform database.
Inspect installed versions and package scripts before changing tooling; do not
copy dependency versions from the sibling project.

Existing data and documented behavior are authoritative. Preserve mapped table
and column names, bigint IDs, nullability, defaults, foreign keys, deletion rules,
indexes, and database-only constraints. The current baseline has 11 introspected
models; additions require an intentional design, not a blanket prohibition.
Schema fragments describe the intended Prisma model; SQL migrations describe
reviewed database changes. Neither generated types nor successful generation prove
that the deployed database matches either artifact.

## Directory ownership and the complete flow

Paths in this section are relative to this repository unless labeled Ferio.

| Artifact | Ownership and behavior |
| --- | --- |
| `backend/prisma/schema/base/` | Datasource provider and client generator. The URL comes from Prisma config. Keep one datasource/generator definition for the application schema. |
| `backend/prisma/schema/<feature>.module/*.prisma` | Editable domain models: candidate portal, company intelligence, job crawling, notifications, and settings. Place related models in their owning feature; preserve cross-feature relations. |
| `backend/prisma/scripts/build-prisma-schemaV2.js` | Exact Ferio recursive fragment combiner. Preserve byte parity unless changing this compatibility requirement is explicitly in scope. |
| `backend/prisma/schema.prisma` | Generated combined schema with source comments. Never make model edits only here; rebuild and review the tracked output with fragment changes. |
| `backend/prisma/scripts/package.json` | Local ESM boundary for the `.js` builder, without changing the Nest application module format. |
| `backend/prisma/scripts/build-prisma-schema.mjs` | Compatibility entry point that imports V2. Ferio's older nonrecursive `build-prisma-schema.js` is not the active workflow. |
| `backend/prisma.config.ts` | CLI schema, migration path, seed command, and datasource URL configuration. |
| `backend/prisma/migrations/` | Reviewed forward SQL history belongs here. Currently only a README: no reviewed Prisma Migrate baseline exists. |
| `backend/prisma/migration-checksums.json` | Currently `{}`; no backend checksum enforcement is wired. Its existence does not establish migration integrity. |
| `backend/prisma/seed.ts`, `seeds/` | Seed entry point deliberately exits unsuccessfully without writes; the seeds directory documents the restriction. |
| `backend/libs/database/src/prisma.service.ts` | Application-scoped client and PostgreSQL pool lifecycle; runtime uses `DATABASE_URL` with `PrismaPg`. |

The normal model-edit flow is:

1. Inspect the existing model, consumers, database constraints, and migration state.
2. Edit the owning fragment under `backend/prisma/schema/`.
3. Build the combined schema. V2 recursively collects **every** `.prisma` file
   under `schema/`, including nested directories. Do not store scratch schemas or
   duplicate model definitions there.
4. V2 prioritizes paths containing `base/`, `shared/`, `user/`, then `learning/`;
   other paths follow, alphabetically within priority via `localeCompare`.
   It prepends `// Source: ...` and overwrites `schema.prisma`. These are string
   path checks, not dependency resolution; preserve this behavior when comparing
   outputs across environments. Builder input/output paths are script-relative.
5. Validate the assembled schema and generate the client. The builder only joins
   text: it does not validate relations, generate clients, migrate, seed, or update
   checksums. `prisma-client-js` supplies the application client consumed through
   `@prisma/client`; Job Intelligence also enables `partialIndexes`.
6. Review the fragment/generated-schema diff and compile affected consumers.
   A client generated from new fields must not be deployed before those fields
   exist in the target database; use the migration sequence below.

## Exact package scripts and side effects

Definitions from [backend/package.json](../../backend/package.json). Run from
`backend/`, or use `pnpm --dir backend <script>` from the repository root.
Recheck the package file whenever changing commands.

```json
{
  "prisma:schema:build": "node prisma/scripts/build-prisma-schemaV2.js",
  "prisma:generate": "pnpm prisma generate --schema prisma/schema.prisma",
  "prisma:db:pull": "prisma db pull --print",
  "prisma:sync": "pnpm run prisma:schema:build && pnpm run prisma:generate",
  "prisma:seed": "ts-node -r tsconfig-paths/register prisma/seed.ts",
  "prisma:migrate:dev": "pnpm run prisma:schema:build && pnpm prisma migrate dev --schema prisma/schema.prisma",
  "prisma:migrate:status": "pnpm prisma migrate status --schema prisma/schema.prisma",
  "prisma:migrate:deploy": "pnpm prisma migrate deploy --schema prisma/schema.prisma"
}
```

| Operation | Actual effect and boundary |
| --- | --- |
| `prisma:schema:build` | Writes combined schema locally; no database connection. |
| `prisma:generate` | Writes generated client artifacts; does **not** rebuild fragments or apply SQL. |
| `prisma:sync` | Builds then generates. Despite its name, does **not** synchronize the database. |
| `prisma:db:pull` | Connects to configured database and prints introspected schema. Review and reconcile into fragments; do not redirect over the combined schema or run unreviewed `db pull` without `--print`. |
| `prisma:migrate:status` | Connects and inspects migration history; not an offline check or a complete drift audit. |
| `prisma:migrate:dev` | Rebuilds schema then runs development migration workflow; may use a shadow database and request reset. Only for an authorized disposable development target after baseline planning. |
| `prisma:migrate:deploy` | Applies pending migration files; does not create them, rebuild fragments, or generate clients. Not a substitute for drift review. |
| `prisma:seed` | Executes the refusal entry point; exits unsuccessfully without writes. |

Job Intelligence config loads `../.env` relative to the command's working
directory and reads `DATABASE_URL`; execute CLI operations in the backend package.
Existing process environment can override dotenv values: identify the effective
target without exposing credentials. CLI config is not runtime connection setup.
Both `prisma:seed` and Prisma 7 `db seed` use the configured refusal entry point.
Never add a platform command/schema or copy Ferio's seed merely for script parity.

## Persistence boundaries and data correctness

- Use the application-scoped Prisma client; never instantiate one per request or
  repository operation. Existing direct-Prisma services remain valid migration
  code. Introduce a focused repository for substantial/reused queries or connection
  ownership; keep a new use case's persistence there rather than scattering writes.
  No universal repository base class or replacement ORM is required.
- Prefer typed Prisma queries. Use parameterized tagged SQL for operations Prisma
  cannot reasonably express or measured performance needs, with a comment explaining
  why. Never concatenate values. Allowlist dynamic identifiers and sort directions;
  parameters cannot safely substitute SQL identifiers.
- Keep bigint IDs intact until boundary serialization; do not convert to Number.
  Validate ranges, nullability, and date inputs. Use precise database numeric types
  for quantities requiring exact arithmetic, not floating-point approximations.
- Use database unique/check/foreign-key constraints for invariants. A pre-read
  cannot guarantee uniqueness under concurrency. `findUnique` requires an enforced
  unique key; `findFirst` does not repair missing uniqueness. Explicitly review
  compound keys and null semantics when designing uniqueness.
- Preserve actual deletion/cascade behavior. Deleting a candidate/company pipeline
  link must not delete the company. No universal soft-delete or audit columns.
- Preserve database-only checks, including category types, job/pipeline statuses,
  score ranges, and nonnegative reapply counts. Inspect SQL and authorized database
  metadata; Prisma model validation alone cannot prove these survived.
- Prefer database defaults/time for new persisted audit/quota timestamps. Preserve
  existing application-date contracts. Date-only values, UTC instants, Asia/Dhaka
  quota-day bounds, and elapsed transport deadlines are different concepts.
- Scope reads and writes to the authenticated principal or authorized admin use
  case. A single-tenant database still requires candidate-level ownership checks.
  Project only needed fields; never expose password hashes or secrets through a
  convenient full-model response or log.

## Transactions, concurrency, and failure handling

- Define the invariant before opening a transaction. Prefer nested writes when
  they express one atomic unit; otherwise use an explicit short transaction and
  pass its typed client to **every** participating query. No silent fallback to
  the global client. Follow [transaction rules](backend-transactions.md).
- Keep HTTP, AI, email, queue publication, file I/O, sleeps, and long parsing outside
  transactions. Set appropriate timeouts and batch bounds. Commit before external
  delivery; use a durable outbox only when reliable asynchronous delivery requires it.
- Choose isolation/atomic conditional updates/locks for the actual race. Do not
  assume a read followed by a write at default isolation is atomic. Keep a consistent
  lock order; define bounded retries with backoff for retryable transaction conflicts.
  Retry the whole atomic unit only when safe, never arbitrary external effects.
- Design duplicate execution with database-backed idempotency where required.
  An upsert does not make network side effects exactly-once. Translate known
  constraint conflicts at the boundary; propagate unexpected errors and preserve
  sanitized diagnostics. Never catch failures merely to return success.
- Document lock scope: transaction advisory locks end with the transaction;
  session locks require a dedicated session-preserving connection and explicit
  cleanup. Transaction pooling is incompatible with session-lock ownership.
  In-process limits do not coordinate replicas; advisory locks are not fencing.

## Query and connection capacity

- Bound collection reads and writes. Select needed columns, avoid broad relation
  graphs/N+1 queries, and prefer set-based or bounded batch work when semantics allow.
- Use stable ordering with a unique tie-breaker. Prefer keyset pagination for long
  scans; bound offset pagination for UI needs. Consider concurrent inserts/updates
  and state the scan's consistency and remaining complexity honestly.
- Design indexes from actual filter/join/order predicates and write costs. Review
  composite order, partial predicates, and foreign-key access paths; do not add an
  index to every field. Use query-plan evidence on an authorized representative
  target; `EXPLAIN ANALYZE` executes the statement and is not automatically safe.
- The current runtime pool has max 5, idle timeout 30 seconds, and connection timeout
  5 seconds per application instance. Budget replicas, workers, dedicated lock
  sessions, and operational connections against database capacity before tuning.
  Preserve lifecycle shutdown and release owned resources on failure.
- Log operation names, latency, counts, and sanitized failure codes where useful;
  avoid credentials, candidate data, and raw SQL parameters. Diagnose slow queries
  and contention before adding caching. Redis is not current MVP infrastructure;
  caching requires identity-safe keys, expiry, and invalidation design.

## Safe schema evolution and delivery

1. Confirm the intended target, existing SQL history, migration baseline, and data
   ownership. Local and Neon are separate datasets; changing configuration neither
   copies data nor authorizes mutations. Do not live-migrate/reset/seed as validation.
2. For existing data, first design a reviewed baseline preserving tables, indexes,
   constraints, and other database objects. Marking a baseline applied requires
   verified equivalence; never execute create-table baseline SQL on existing tables.
   Do not introduce a second uncoordinated migration authority beside legacy SQL.
3. Prefer expand → bounded resumable backfill → validate → contract. Deploy compatible
   schema additions before dependent clients; remove old fields only after every
   legacy/new reader and writer is migrated. Review defaults, nullability changes,
   table rewrites, lock duration, index build strategy, and transaction restrictions.
4. Review generated SQL before applying it. Use a deliberately separate disposable
   shadow database where required, never the data-bearing target. Do not accept a
   reset prompt or use `db push` to bypass migration history on shared data.
5. Never rewrite shared/applied migrations. Add forward corrections. Specify backup
   and restore evidence, operational recovery, and any irreversible data loss;
   application rollback alone cannot reverse a destructive schema change.
6. Keep seeds disabled until a specific dataset and target are authorized. Any future
   seed must have environment guards, stable keys, repeatable/idempotent behavior,
   bounded work, no embedded credentials, and explicit partial-failure handling.
7. Review source fragments, combined schema, SQL, generated-client compatibility,
   affected consumers, and docs together. Generated clients stay out of source
   control; the tracked combined schema is a separate reviewed artifact.

## Verification and handoff

For documentation-only changes, compare commands to the backend package file, inspect
actual scripts/configs, and check local links and contradictions. Do not run live
commands merely to document them.

For schema/tooling changes, build and validate the schema, generate the client,
and run relevant static checks. Validation/generation need no live database;
provide an explicit inert `DATABASE_URL` if config loading requires it. Keep
migration status/introspection distinct: both connect to a database. When runtime
checks are authorized, use an isolated disposable target for migration replay,
constraints, rollback, race, and retry cases. If tests are deferred, record that
runtime behavior remains unverified; compile success is not migration evidence.

Report what changed, commands actually run, database connections/mutations (if
any), and remaining baseline/deployment prerequisites. Update
[Prisma ownership docs](../../backend/prisma/_doc.md) and the
[developer guide](../../docs/BACKEND_DEVELOPER_GUIDE.md) when their described flow
changes. Documentation alone does not complete a product migration milestone.
