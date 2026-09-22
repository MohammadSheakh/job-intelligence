# Database and persistence rules

Applies to database access, Prisma/ORM queries, SQL, repositories, concurrency,
transactions, connection management, and persistence design.

## Persistence boundaries

- Use an application-scoped database/ORM client. Never create a client per request
  or repository operation.
- Keep database access out of transport/controller layers.
- Introduce repositories when persistence logic is substantial, reused, owns complex
  SQL, or manages connection lifecycles.
- Do not introduce repository abstractions solely for architectural symmetry.
- Keep a new use case's persistence approach consistent; avoid scattered writes
  across unrelated boundaries.

## Query design

- Fetch only fields required by the use case.
- Avoid broad relation graphs and N+1 query patterns.
- Bound every potentially unbounded collection read.
- Use deterministic ordering with a unique tie-breaker.
- Prefer keyset/cursor pagination for long or frequently changing scans.
- Use bounded offset pagination when it is appropriate for UI use cases.
- Prefer set-based or bounded batch operations over sequential queries in loops.
- Do not load entire result sets merely to slice them in application memory.

## Integrity

- Use database constraints for invariants that must hold under concurrency.
- Application validation does not replace unique, foreign-key, check, or nullability constraints.
- Do not implement uniqueness solely as `read -> check -> insert`.
- Use unique-query APIs only when backed by an actual database uniqueness constraint.
- Preserve actual deletion and cascade semantics.
- Avoid universal soft-delete/audit patterns unless the domain requires them.

## Transactions

- Define the invariant before opening a transaction.
- Use a transaction only when operations must succeed or fail atomically.
- Prefer ORM-native nested writes when they clearly express the atomic operation.
- Keep interactive transactions short.
- Pass the transaction client through every participating persistence operation.
- Never accidentally use the global client inside an active transaction.
- Keep HTTP, AI, email, queues, file I/O, sleeps, and slow external work outside
  database transactions.
- Retry only well-defined retryable database conflicts and only when replaying the
  full atomic operation is safe.

## Concurrency and idempotency

- Never assume a read followed by a write is atomic.
- Choose conditional updates, isolation levels, locks, or retries according to
  the actual race being protected.
- Use a consistent lock order when multiple locks are required.
- Design duplicate/retried execution explicitly.
- Use database-backed idempotency where duplicate execution would be unsafe.
- An upsert does not make external side effects exactly-once.

## Raw SQL

- Prefer typed ORM APIs when they express the operation clearly.
- Use raw SQL when the ORM cannot reasonably express the operation or measured
  performance justifies it.
- Parameterize all data values.
- Validate dynamic identifiers, column names, and sort directions against explicit allowlists.
- Never concatenate untrusted input into SQL.
- Document why substantial raw SQL is necessary.

## Types and serialization

- Preserve database numeric precision.
- Do not convert bigint identifiers to JavaScript `Number`.
- Distinguish date-only values, timestamps/instants, and elapsed durations.
- Normalize timezone behavior deliberately.
- Validate ranges and nullability at boundaries.

## Performance and indexes

- Design indexes from actual filter, join, and ordering predicates.
- Do not add indexes indiscriminately; consider write/storage cost.
- Use representative query-plan evidence before major optimization.
- Remember that diagnostic commands such as `EXPLAIN ANALYZE` may execute queries.
- State remaining scan complexity honestly instead of claiming scalability without evidence.

## Connections

- Keep connection ownership bounded.
- Reuse application-scoped pools/clients.
- Budget application replicas, workers, dedicated sessions, and operational connections
  against database capacity.
- Release owned connections and resources on failure/shutdown.
- Treat pool exhaustion as an architectural problem, not something solved by creating
  more clients.

## Errors and observability

- Translate expected database conflicts into appropriate application errors.
- Propagate unexpected database failures.
- Never catch a database failure merely to return success.
- Log operation names, latency, counts, and sanitized diagnostics where useful.
- Never log credentials, tokens, sensitive records, or raw secret-bearing parameters.

## Caching

- Add caching only for a demonstrated need.
- Define cache identity, expiry, invalidation, and consistency requirements before use.
- Do not introduce Redis or another cache merely because a template includes it.

## Schema evolution

- Understand the active target, migration history, and data ownership before changing schema.
- Prefer expand -> bounded backfill -> validate -> contract for risky changes.
- Deploy compatible schema additions before code that requires them.
- Remove old fields only after all readers and writers have migrated.
- Review nullability changes, defaults, table rewrites, lock duration, and index-build behavior.
- Never rewrite shared/applied migrations; correct forward.
